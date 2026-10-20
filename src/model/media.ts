import type { HassEntityState, HomeAssistant } from '../ha/types';
import { areaOf } from './classify';
import { displayName } from './names';

/**
 * What a speaker plays, as the card and the sheet show it: the speaker's own words first, the Spotify
 * playing on it for what the speaker does not say (decision A, spec Mídia, Section 5).
 */
export interface MediaView {
  entityId: string;
  state: string;
  title: string | null;
  artist: string | null;
  album: string | null;
  picture: string | null;
  duration: number | null;
  position: number | null;
  /** When `position` was true, in ms since the epoch; null when the player does not say. */
  positionAt: number | null;
  shuffle: boolean | null;
  repeat: 'off' | 'all' | 'one' | null;
  /** The Spotify player playing on this speaker, if any. */
  spotify: string | null;
}

const domainOf = (id: string): string => id.slice(0, id.indexOf('.'));
const norm = (v: unknown): string => (typeof v === 'string' ? v.trim().toLocaleLowerCase('pt-BR') : '');
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v : null);
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const features = (st: HassEntityState | undefined): number => Number(st?.attributes.supported_features ?? 0);

/** The names a speaker answers to in Spotify's source list: its device's, and its own. */
function namesOf(hass: HomeAssistant, speakerId: string): Set<string> {
  const reg = hass.entities[speakerId];
  const dev = reg?.device_id ? hass.devices[reg.device_id] : undefined;
  return new Set([norm(dev?.name_by_user), norm(dev?.name), norm(reg?.name), norm(hass.states[speakerId]?.attributes.friendly_name)].filter(Boolean));
}

/**
 * The Spotify player on this speaker: its `source` is the speaker's name. A paused one counts only
 * while the speaker is paused too; a speaker that moved on (Line In, its radio) keeps its own words.
 */
export function linkedSpotify(hass: HomeAssistant, speakerId: string): string | null {
  const names = namesOf(hass, speakerId);
  const speakerPaused = hass.states[speakerId]?.state === 'paused';
  for (const reg of Object.values(hass.entities)) {
    if (reg.platform !== 'spotify' || domainOf(reg.entity_id) !== 'media_player') continue;
    const st = hass.states[reg.entity_id];
    if (!st || !(st.state === 'playing' || (st.state === 'paused' && speakerPaused))) continue;
    if (names.has(norm(st.attributes.source))) return reg.entity_id;
  }
  return null;
}

export function mediaView(hass: HomeAssistant, speakerId: string): MediaView {
  const own = hass.states[speakerId]?.attributes ?? {};
  const spotify = linkedSpotify(hass, speakerId);
  const other = spotify ? (hass.states[spotify]?.attributes ?? {}) : {};
  const pick = <T>(read: (v: unknown) => T | null, key: string): T | null => read(own[key]) ?? read(other[key]);
  // Position and its time travel together: from the one that gave the position.
  const fromOwn = num(own.media_position) !== null;
  const at = str((fromOwn ? own : other).media_position_updated_at);
  const repeat = pick(str, 'repeat');
  const shuffle = typeof own.shuffle === 'boolean' ? own.shuffle : typeof other.shuffle === 'boolean' ? other.shuffle : null;
  return {
    entityId: speakerId,
    state: hass.states[speakerId]?.state ?? 'unavailable',
    title: pick(str, 'media_title'),
    artist: pick(str, 'media_artist'),
    album: pick(str, 'media_album_name'),
    picture: pick(str, 'entity_picture'),
    duration: pick(num, 'media_duration'),
    position: pick(num, 'media_position'),
    positionAt: at && Number.isFinite(Date.parse(at)) ? Date.parse(at) : null,
    shuffle,
    repeat: repeat === 'off' || repeat === 'all' || repeat === 'one' ? repeat : null,
    spotify,
  };
}

/** Who takes a command: the speaker when it has the feature, else the Spotify on it, else nobody. */
export function commandTarget(hass: HomeAssistant, view: MediaView, feature: number): string | null {
  if (features(hass.states[view.entityId]) & feature) return view.entityId;
  if (view.spotify && features(hass.states[view.spotify]) & feature) return view.spotify;
  return null;
}

/**
 * The group a speaker is in: its leader and the others; alone when none. The leader is the one the
 * integration calls `master` (WiiM's `group_role`), else the first of `group_members`.
 */
export function groupOf(hass: HomeAssistant, speakerId: string): { leader: string | null; members: string[] } {
  const raw = hass.states[speakerId]?.attributes.group_members;
  const all = Array.isArray(raw) ? raw.filter((m): m is string => typeof m === 'string') : [];
  if (all.length < 2 || !all.includes(speakerId)) return { leader: null, members: [] };
  const leader = all.find((m) => hass.states[m]?.attributes.group_role === 'master') ?? all[0]!;
  return { leader, members: all.filter((m) => m !== speakerId) };
}

/** The translation key of the channel select the WiiM integration gives a speaker (pywiim `output_channel`). */
export const CHANNEL_KEY = 'output_channel';

/** The channel select on the speaker's device, found by its translation key, never by its id. */
export function channelSelect(hass: HomeAssistant, speakerId: string): string | null {
  const deviceId = hass.entities[speakerId]?.device_id;
  if (!deviceId) return null;
  const found = Object.values(hass.entities).find(
    (e) => e.device_id === deviceId && domainOf(e.entity_id) === 'select' && e.translation_key === CHANNEL_KEY && hass.states[e.entity_id],
  );
  return found?.entity_id ?? null;
}

/**
 * The speakers that can play together with this one: visible to the resident, of the same integration
 * (Home Assistant only groups within one) and able to group.
 */
export function groupCandidates(
  hass: HomeAssistant,
  speakerId: string,
  visible: readonly string[],
): { entityId: string; name: string; areaName: string | null; joined: boolean }[] {
  const platform = hass.entities[speakerId]?.platform;
  const { members } = groupOf(hass, speakerId);
  return visible
    .filter((id) => id !== speakerId && hass.entities[id]?.platform === platform && features(hass.states[id]) & 524288)
    .map((id) => {
      const areaId = areaOf(hass, id);
      return { entityId: id, name: displayName(hass, id, null), areaName: areaId ? (hass.areas[areaId]?.name ?? null) : null, joined: members.includes(id) };
    });
}
