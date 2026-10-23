import type { HomeAssistant } from '../ha/types';

/** A song, an artist, an album or a playlist of Music Assistant, as "Tocar algo" lists it. */
export interface LibraryItem {
  uri: string;
  mediaType: string;
  name: string;
  /** The artists of a song or an album; null for the rest. */
  subtitle: string | null;
  image: string | null;
}

/** How many come back: the recent songs, the playlists, and each kind of a search. */
const RECENT = 8;
const PLAYLISTS = 20;
const PER_KIND = 5;
/** The kinds of a search, in the order the sheet shows them. */
const SEARCH_ORDER = ['tracks', 'artists', 'albums', 'playlists'] as const;

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v : null);

/** The items of a Music Assistant answer; one with no address cannot be played and stays out. */
export function parseItems(raw: unknown): LibraryItem[] {
  if (!Array.isArray(raw)) return [];
  const items: LibraryItem[] = [];
  for (const it of raw as Record<string, unknown>[]) {
    const uri = str(it?.uri);
    const name = str(it?.name);
    if (!uri || !name) continue;
    const artists = Array.isArray(it.artists) ? (it.artists as Record<string, unknown>[]).map((a) => str(a?.name)).filter(Boolean) : [];
    items.push({ uri, mediaType: str(it.media_type) ?? 'track', name, subtitle: artists.length ? artists.join(', ') : null, image: str(it.image) });
  }
  return items;
}

/** A search answer of Music Assistant, flattened: songs, artists, albums, playlists. */
export function parseSearch(raw: unknown): LibraryItem[] {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return SEARCH_ORDER.flatMap((kind) => parseItems(r[kind]));
}

/**
 * The entry of the Music Assistant integration, which its library actions ask for. `config_entries/get`
 * answers a resident too (no administrator needed). One question per connection: the frontend keeps
 * `callService` across states, like the volume targets.
 */
const entries = new WeakMap<HomeAssistant['callService'], Promise<string | null>>();

export function maEntryId(hass: HomeAssistant): Promise<string | null> {
  const known = entries.get(hass.callService);
  if (known) return known;
  const asked = (async () => {
    if (!hass.callWS) return null;
    const list = await hass.callWS<{ entry_id: string; state?: string }[]>({ type: 'config_entries/get', domain: 'music_assistant' });
    const entry = (Array.isArray(list) ? list : []).find((e) => e.state === undefined || e.state === 'loaded');
    return entry?.entry_id ?? null;
  })();
  entries.set(hass.callService, asked);
  // A failed question is asked again next time, not remembered.
  asked.catch(() => entries.delete(hass.callService));
  return asked;
}

/** A Music Assistant action that answers (its library and its search). */
async function ask(hass: HomeAssistant, service: string, data: Record<string, unknown>): Promise<unknown> {
  const entry = await maEntryId(hass);
  if (!entry || !hass.callWS) return null;
  const result = await hass.callWS<{ response?: unknown }>({
    type: 'call_service',
    domain: 'music_assistant',
    service,
    service_data: { config_entry_id: entry, ...data },
    return_response: true,
  });
  return result?.response ?? null;
}

/** The songs played last, or the playlists of the house's Spotify. */
export async function library(hass: HomeAssistant, kind: 'recent' | 'playlists'): Promise<LibraryItem[]> {
  const data = kind === 'recent' ? { media_type: 'track', order_by: 'last_played_desc', limit: RECENT } : { media_type: 'playlist', order_by: 'name', limit: PLAYLISTS };
  const response = (await ask(hass, 'get_library', data)) as { items?: unknown } | null;
  return parseItems(response?.items);
}

export async function search(hass: HomeAssistant, text: string): Promise<LibraryItem[]> {
  return parseSearch(await ask(hass, 'search', { name: text, limit: PER_KIND }));
}

/** Plays an item on a Music Assistant player, in place of what it plays. */
export async function playItem(hass: HomeAssistant, ma: string, item: LibraryItem): Promise<void> {
  await hass.callService('music_assistant', 'play_media', { media_id: item.uri, media_type: item.mediaType }, { entity_id: ma });
}
