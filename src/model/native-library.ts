import { has } from '../actions/climate';
import { MEDIA_FEATURE } from '../actions/media';
import type { HassEntityState, HomeAssistant } from '../ha/types';
import { MEDIA } from '../strings';

/** One line of what a player can play on its own: a folder, a station, a preset, a song. */
export interface NativeItem {
  /** `media_content_id`; empty for the folder of presets of some players, so it is sent as it came. */
  id: string;
  /** `media_content_type`. */
  type: string;
  title: string;
  /** A cover or a logo: an address of the web, or a path of Home Assistant that has to be signed first. */
  image: string | null;
  canPlay: boolean;
  canExpand: boolean;
}

export interface NativeFolder {
  title: string;
  items: NativeItem[];
}

/**
 * The libraries of audio that Home Assistant's media sources add to the root of every player. The rest of
 * them (text-to-speech, camera, image, image upload, AI images, the local folder) is not music and stays
 * out: a resident would find it among the radios. A new audio library is one more line here.
 */
const AUDIO_SOURCES: ReadonlySet<string> = new Set(['media-source://dlna_dms', 'media-source://radio_browser']);

/**
 * The name a player gives to a preset it knows nothing about ("Preset 7"). The WiiM integration lists
 * twenty slots whatever the device holds, and a device that does not tell the names (an AudioCast, a
 * LinkPlay) leaves all twenty like that: they say nothing, and one of them may play nothing.
 */
const PLACEHOLDER = /^preset\s*\d+$/i;

/**
 * The folders Radio Browser opens with, by their id: it names them in English ("Local stations") and the
 * id stays the same in any language. Its languages come as the radio directory has them: free text with no
 * code ("brazilian portuguese"), so there is nothing to translate them by.
 */
const RADIO_FOLDERS: Readonly<Record<string, string>> = {
  'media-source://radio_browser/popular': MEDIA.radioPopular,
  'media-source://radio_browser/tag': MEDIA.radioByCategory,
  'media-source://radio_browser/language': MEDIA.radioByLanguage,
  'media-source://radio_browser/local': MEDIA.radioLocal,
};

/** A country Radio Browser lists after its four folders, named in English ("Brazil"); the id carries its code. */
const COUNTRY = /^media-source:\/\/radio_browser\/country\/([A-Z]{2})$/;

/** The names of countries in Portuguese, or null on a browser that has none: the name then stays in English. */
let regions: Intl.DisplayNames | null | undefined;

function countryName(id: string): string | null {
  const code = COUNTRY.exec(id)?.[1];
  if (!code) return null;
  if (regions === undefined) {
    try {
      regions = new Intl.DisplayNames(['pt-BR'], { type: 'region', fallback: 'none' });
    } catch {
      regions = null;
    }
  }
  try {
    return regions?.of(code) ?? null;
  } catch {
    return null;
  }
}

const text = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v : null);

/**
 * "Tocar algo" without Music Assistant needs the player to play what is picked and to list what it has;
 * a TV lists its apps and inputs instead, which is not what the name promises.
 */
export function canBrowseNative(st: HassEntityState | undefined): boolean {
  return has(st, MEDIA_FEATURE.playMedia) && has(st, MEDIA_FEATURE.browseMedia) && st?.attributes.device_class !== 'tv';
}

/** The folder a player answered: what can be played or opened, and nothing else. */
export function parseFolder(raw: unknown): NativeFolder {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const items: NativeItem[] = [];
  for (const c of Array.isArray(r.children) ? (r.children as Record<string, unknown>[]) : []) {
    const title = text(c?.title);
    const canPlay = c?.can_play === true;
    const canExpand = c?.can_expand === true;
    if (!title || (!canPlay && !canExpand)) continue;
    const id = typeof c.media_content_id === 'string' ? c.media_content_id : '';
    const image = text(c.thumbnail);
    const item: NativeItem = {
      id,
      type: typeof c.media_content_type === 'string' ? c.media_content_type : '',
      title: RADIO_FOLDERS[id] ?? countryName(id) ?? title,
      image: image && brandImage(image),
      canPlay,
      canExpand,
    };
    if (item.type === 'preset' && PLACEHOLDER.test(title.trim())) continue;
    items.push(item);
  }
  // The countries came in the order of their English names: named in Portuguese, they are put in order again,
  // each in a place a country held, so the four folders stay on top.
  const slots = items.flatMap((it, i) => (COUNTRY.test(it.id) ? [i] : []));
  const countries = slots.map((i) => items[i]!).sort((a, b) => a.title.localeCompare(b.title, 'pt-BR'));
  slots.forEach((slot, k) => (items[slot] = countries[k]!));
  return { title: text(r.title) ?? '', items };
}

async function ask(hass: HomeAssistant, entityId: string, from: NativeItem | null): Promise<NativeFolder> {
  if (!hass.callWS) throw new Error('no WebSocket');
  const msg: Record<string, unknown> = { type: 'media_player/browse_media', entity_id: entityId };
  if (from) [msg.media_content_id, msg.media_content_type] = [from.id, from.type];
  return parseFolder(await hass.callWS(msg));
}

/** What is inside a folder of the root, or of a folder inside it. */
export const browseFolder = ask;

/**
 * The root of a player: what it keeps itself (its presets, favorites and playlists) and the audio libraries
 * of Home Assistant. A folder of presets with nothing but placeholders is left out: it would open to
 * nothing, or to a slot that plays nothing.
 */
export async function browseRoot(hass: HomeAssistant, entityId: string): Promise<NativeFolder> {
  const root = await ask(hass, entityId, null);
  const kept = root.items.filter((it) => !it.id.startsWith('media-source://') || AUDIO_SOURCES.has(it.id));
  const worth = await Promise.all(
    kept.map(async (it) => it.type !== 'presets' || ((await ask(hass, entityId, it).catch(() => null))?.items.length ?? 0) > 0),
  );
  return { title: root.title, items: kept.filter((_, i) => worth[i]) };
}

/** Plays an item on the player that listed it, in place of what it plays. */
export async function playNative(hass: HomeAssistant, entityId: string, item: NativeItem): Promise<void> {
  await hass.callService('media_player', 'play_media', { media_content_id: item.id, media_content_type: item.type }, { entity_id: entityId });
}

/** Where Home Assistant serves the pictures of its integrations: its own path, or the public brands site. */
const BRAND = /^(?:\/api\/brands\/|https:\/\/brands\.home-assistant\.io\/)/;

/** Whether a picture is the brand of an integration: the sheet shows it on a light tile. */
export const isBrand = (src: string): boolean => BRAND.test(src);

/**
 * The picture of a library: the square icon of its integration, the one drawn for a light background. Home
 * Assistant hands each one the wide logo, and the square of the row cut DLNA's to "dl", in black letters
 * nearly invisible on the dark sheet. The dark variant does not help: DLNA and Radio Browser have none, Home
 * Assistant answers with the light picture, and Radio Browser's black headphones vanished; so the light icon
 * goes on a light tile in either theme. Any other picture (the cover of a radio, of a song) stays as it came.
 */
export function brandImage(src: string): string {
  return isBrand(src) ? src.replace(/\/(?:dark_)?(?:icon|logo)(@2x)?\.png(?=$|[?#])/, '/icon$1.png') : src;
}

/**
 * An address a picture can load from. Players hand over their own pictures as web addresses, and Home
 * Assistant its logos as paths that answer 403 until they are signed, the way the frontend signs its own
 * thumbnails. Null when it cannot be signed: the note stands in for it.
 */
export async function signedImage(hass: HomeAssistant, src: string): Promise<string | null> {
  if (/^https?:\/\//i.test(src)) return src;
  if (!src.startsWith('/') || !hass.callWS) return null;
  try {
    const r = await hass.callWS<{ path?: string }>({ type: 'auth/sign_path', path: src });
    return typeof r?.path === 'string' && r.path ? r.path : null;
  } catch {
    return null;
  }
}
