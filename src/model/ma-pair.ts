import type { HomeAssistant } from '../ha/types';
import type { PanelConfig } from './config';

/** The integration of Music Assistant: a second `media_player` for every device it plays on. */
export const MA_PLATFORM = 'music_assistant';

/** Players that are never the speaker of a room: the Alexa, the Spotify app, a browser. */
const NOT_SPEAKERS = new Set([MA_PLATFORM, 'alexa_media', 'alexa_devices', 'spotify', 'browser_mod']);

const isPlayer = (id: string): boolean => id.startsWith('media_player.');
const norm = (v: string | null | undefined): string => (v ?? '').trim().toLocaleLowerCase('pt-BR');

/** How Music Assistant starts the id of a sync group and of a universal group (`SGP_PREFIX`, `UGP_PREFIX`). */
const GROUP_PREFIXES = ['syncgroup_', 'ugp_'];

/**
 * A group of Music Assistant (a fixed sync group, a universal group): no device behind it. Unavailable,
 * the player loses `mass_player_type`, and its device still carries the id Music Assistant gave it.
 */
export function isMaGroup(hass: HomeAssistant, entityId: string): boolean {
  const reg = hass.entities[entityId];
  if (reg?.platform !== MA_PLATFORM) return false;
  if (hass.states[entityId]?.attributes.mass_player_type === 'group') return true;
  const ids = reg.device_id ? hass.devices[reg.device_id]?.identifiers : undefined;
  return !!ids?.some(([domain, id]) => domain === MA_PLATFORM && GROUP_PREFIXES.some((p) => id.startsWith(p)));
}

/**
 * WiiM's "Group Master" player, which repeats the leader of a group. Unavailable, it loses its
 * attributes, and its id (`<speaker>_group_master`) still says what it is.
 */
export function isGroupMaster(hass: HomeAssistant, entityId: string): boolean {
  const a = hass.states[entityId]?.attributes ?? {};
  return ('group_leader' in a && 'group_status' in a) || (hass.entities[entityId]?.platform === 'wiim' && entityId.endsWith('_group_master'));
}

/**
 * Each speaker and the player Music Assistant made for it, which the registry keeps on a device of its
 * own. They share the device's name, and its model when both say one; the pair only stands when that
 * leaves a single speaker (spec Multiroom, Section 4.1). `entities.<speaker>.music_assistant` in the
 * editor forces a pair, or turns it off with an empty value. Hidden players pair too: the card is the
 * speaker's, and its visibility decides (Section 4.5).
 */
export function maPairs(hass: HomeAssistant, cfg: PanelConfig): ReadonlyMap<string, string> {
  const pairs = new Map<string, string>();
  const forced = new Set<string>();
  for (const [id, s] of Object.entries(cfg.entities)) {
    if (s.musicAssistant === undefined) continue;
    forced.add(id);
    if (s.musicAssistant) pairs.set(id, s.musicAssistant);
  }
  const taken = new Set(pairs.values());
  const deviceOf = (id: string) => {
    const deviceId = hass.entities[id]?.device_id;
    return deviceId ? hass.devices[deviceId] : undefined;
  };
  const speakers = Object.values(hass.entities).filter(
    (e) => isPlayer(e.entity_id) && !NOT_SPEAKERS.has(e.platform ?? '') && !isGroupMaster(hass, e.entity_id) && !forced.has(e.entity_id),
  );
  for (const reg of Object.values(hass.entities)) {
    const ma = reg.entity_id;
    if (!isPlayer(ma) || reg.platform !== MA_PLATFORM || isMaGroup(hass, ma) || taken.has(ma)) continue;
    const dev = deviceOf(ma);
    const name = norm(dev?.name_by_user ?? dev?.name);
    if (!name) continue;
    const byName = speakers.filter((s) => norm(deviceOf(s.entity_id)?.name_by_user ?? deviceOf(s.entity_id)?.name) === name);
    const model = norm(dev?.model);
    const sameModel = model ? byName.filter((s) => norm(deviceOf(s.entity_id)?.model) === model) : [];
    const pick = sameModel.length ? sameModel : byName;
    if (pick.length === 1 && !pairs.has(pick[0]!.entity_id)) pairs.set(pick[0]!.entity_id, ma);
  }
  return pairs;
}
