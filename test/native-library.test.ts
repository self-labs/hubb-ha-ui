import { describe, expect, it, vi } from 'vitest';
import { MEDIA_FEATURE } from '../src/actions/media';
import { brandImage, browseFolder, browseRoot, canBrowseNative, parseFolder, playNative, signedImage, type NativeItem } from '../src/model/native-library';
import { makeHass, type FakeHass } from './helpers/fake-hass';

const SPEAKER = 'media_player.caixa_sala';

const app = (name: string, id: string) => ({
  title: name,
  media_class: 'app',
  media_content_type: 'app',
  media_content_id: id,
  can_play: false,
  can_expand: true,
  thumbnail: `/api/brands/integration/${id.replace('media-source://', '')}/logo.png`,
});
const presetsEntry = { title: 'Presets', media_class: 'directory', media_content_type: 'presets', media_content_id: '', can_play: false, can_expand: true, thumbnail: null };
const presetsOf = (names: string[]) => ({
  title: 'Presets',
  media_class: 'directory',
  media_content_type: 'presets',
  media_content_id: '',
  can_play: false,
  can_expand: true,
  children: names.map((title, i) => ({ title, media_class: 'music', media_content_type: 'preset', media_content_id: String(i + 1), can_play: true, can_expand: false })),
});

/** The root a WiiM player answers (captured from an AudioCast), with every source Home Assistant adds. */
const ROOT = {
  title: 'Caixa Sala',
  media_class: 'directory',
  media_content_id: '',
  media_content_type: '',
  can_play: false,
  can_expand: true,
  children: [
    presetsEntry,
    app('AI generated images', 'media-source://ai_task'),
    app('Camera', 'media-source://camera'),
    app('DLNA Servers', 'media-source://dlna_dms'),
    app('Image', 'media-source://image'),
    app('Image upload', 'media-source://image_upload'),
    app('My media', 'media-source://media_source'),
    app('Radio Browser', 'media-source://radio_browser'),
    app('Text-to-speech', 'media-source://tts'),
  ],
};
const GENERIC = Array.from({ length: 20 }, (_, i) => `Preset ${i + 1}`);

/** A player answering the root and the folder of presets it is asked for. */
function house(presets: ReturnType<typeof presetsOf> | Error = presetsOf(GENERIC), root: unknown = ROOT): FakeHass {
  const h = makeHass({});
  h.callWS = vi.fn((msg: Record<string, unknown>) => {
    if (msg.media_content_type === 'presets') return presets instanceof Error ? Promise.reject(presets) : Promise.resolve(presets);
    return Promise.resolve(root);
  }) as FakeHass['callWS'];
  return h;
}

const titles = (items: readonly NativeItem[]) => items.map((i) => i.title);
const item = (extra: Partial<NativeItem> = {}): NativeItem => ({ id: 'media-source://radio_browser/1', type: 'audio/mpeg', title: 'Rádio', image: null, canPlay: true, canExpand: false, ...extra });

describe('Tocar algo without Music Assistant', () => {
  it('needs a player that plays media and lists it, and is not a TV', () => {
    const st = (supported_features: number, extra: Record<string, unknown> = {}) => ({ entity_id: SPEAKER, state: 'on', attributes: { supported_features, ...extra } });
    const both = MEDIA_FEATURE.playMedia | MEDIA_FEATURE.browseMedia;
    expect(canBrowseNative(st(both))).toBe(true);
    expect(canBrowseNative(st(both, { device_class: 'speaker' }))).toBe(true);
    expect(canBrowseNative(st(MEDIA_FEATURE.playMedia))).toBe(false);
    expect(canBrowseNative(st(MEDIA_FEATURE.browseMedia))).toBe(false);
    expect(canBrowseNative(st(both, { device_class: 'tv' }))).toBe(false);
    expect(canBrowseNative(undefined)).toBe(false);
  });

  it('keeps what can be played or opened, and the id and type as the player gave them', () => {
    const folder = parseFolder({
      title: 'Favoritos',
      children: [
        { title: 'Jazz', media_content_id: 'fav:1', media_content_type: 'favorite_item_id', can_play: true, can_expand: false, thumbnail: 'https://cdn.example/jazz.png' },
        { title: 'Pasta', media_content_id: '', media_content_type: 'dir', can_play: false, can_expand: true },
        { title: 'Aba solta', media_content_id: 'x', media_content_type: 'x', can_play: false, can_expand: false },
        { title: '  ', media_content_id: 'y', media_content_type: 'y', can_play: true, can_expand: false },
        null,
      ],
    });
    expect(folder.title).toBe('Favoritos');
    expect(folder.items).toEqual([
      { id: 'fav:1', type: 'favorite_item_id', title: 'Jazz', image: 'https://cdn.example/jazz.png', canPlay: true, canExpand: false },
      { id: '', type: 'dir', title: 'Pasta', image: null, canPlay: false, canExpand: true },
    ]);
    expect(parseFolder(null)).toEqual({ title: '', items: [] });
    expect(parseFolder({ children: 'nope' }).items).toEqual([]);
  });

  it('drops the presets the player only names by number, and keeps the ones with a name', () => {
    expect(titles(parseFolder(presetsOf(['Preset 1', 'Jazz FM', 'preset 3', 'Preset 20'])).items)).toEqual(['Jazz FM']);
    // Only a preset is a placeholder: a folder or a song called "Preset 2" is what its owner named it.
    const song = { title: 'Preset 2', media_content_id: 's', media_content_type: 'music', can_play: true, can_expand: false };
    expect(titles(parseFolder({ children: [song] }).items)).toEqual(['Preset 2']);
  });

  it('names the four folders Radio Browser opens with in Portuguese, by their id', () => {
    // The root of Radio Browser as the homelab answered it (11/11): the four folders, then the countries.
    const folder = (title: string, id: string) => ({ title, media_content_id: `media-source://radio_browser/${id}`, media_content_type: 'music', can_play: false, can_expand: true });
    const root = { title: 'Radio Browser', children: [folder('Popular', 'popular'), folder('By Category', 'tag'), folder('By Language', 'language'), folder('Local stations', 'local'), folder('Brazil', 'country/BR')] };
    expect(titles(parseFolder(root).items)).toEqual(['Populares', 'Por categoria', 'Por idioma', 'Emissoras locais', 'Brazil']);
    // The name alone translates nothing: a station called "Popular" stays as it is.
    const song = { title: 'Popular', media_content_id: 'media-source://radio_browser/0b1c', media_content_type: 'audio/mpeg', can_play: true, can_expand: false };
    expect(titles(parseFolder({ children: [song] }).items)).toEqual(['Popular']);
  });

  it('opens the root with the libraries of audio and none of the other sources', async () => {
    const h = house(presetsOf(['Preset 1', 'Jazz FM']));
    const root = await browseRoot(h, SPEAKER);
    expect(titles(root.items)).toEqual(['Presets', 'DLNA Servers', 'Radio Browser']);
    expect(h.callWS).toHaveBeenCalledWith({ type: 'media_player/browse_media', entity_id: SPEAKER });
  });

  it('leaves the presets out of the root while they are twenty placeholders', async () => {
    const h = house();
    const root = await browseRoot(h, SPEAKER);
    expect(titles(root.items)).toEqual(['DLNA Servers', 'Radio Browser']);
    // The check opened the folder of presets as the player listed it: empty id, type "presets".
    expect(h.callWS).toHaveBeenCalledWith({ type: 'media_player/browse_media', entity_id: SPEAKER, media_content_id: '', media_content_type: 'presets' });
  });

  it('leaves the presets out when their folder cannot be opened', async () => {
    const root = await browseRoot(house(new Error('boom')), SPEAKER);
    expect(titles(root.items)).toEqual(['DLNA Servers', 'Radio Browser']);
  });

  it('has an empty root when the player keeps nothing and the house has no library', async () => {
    const bare = { ...ROOT, children: [presetsEntry, app('Camera', 'media-source://camera'), app('Text-to-speech', 'media-source://tts')] };
    expect((await browseRoot(house(presetsOf(GENERIC), bare), SPEAKER)).items).toEqual([]);
  });

  it('keeps what a player lists itself, even when its id looks like a path', async () => {
    const own = { ...ROOT, children: [{ title: 'Favoritos', media_content_id: 'favorites', media_content_type: 'favorites', can_play: false, can_expand: true }, app('Image', 'media-source://image')] };
    expect(titles((await browseRoot(house(presetsOf(GENERIC), own), SPEAKER)).items)).toEqual(['Favoritos']);
  });

  it('asks for the inside of a folder with its own id and type', async () => {
    const h = house();
    await browseFolder(h, SPEAKER, item({ id: 'media-source://dlna_dms/uuid', type: 'app', canPlay: false, canExpand: true }));
    expect(h.callWS).toHaveBeenCalledWith({ type: 'media_player/browse_media', entity_id: SPEAKER, media_content_id: 'media-source://dlna_dms/uuid', media_content_type: 'app' });
  });

  it('plays an item with the id and type the player gave it, on that player', async () => {
    const h = house();
    await playNative(h, SPEAKER, item({ id: '3', type: 'preset' }));
    expect(h.calls).toEqual([{ domain: 'media_player', service: 'play_media', data: { media_content_id: '3', media_content_type: 'preset' }, target: { entity_id: SPEAKER } }]);
  });

  it('signs the paths of Home Assistant, takes the web addresses as they are, and gives up quietly', async () => {
    const h = makeHass({});
    h.callWS = vi.fn(() => Promise.resolve({ path: '/api/brands/x?authSig=abc' })) as FakeHass['callWS'];
    expect(await signedImage(h, '/api/brands/x')).toBe('/api/brands/x?authSig=abc');
    expect(h.callWS).toHaveBeenCalledWith({ type: 'auth/sign_path', path: '/api/brands/x' });
    expect(await signedImage(h, 'https://cdn.example/a.png')).toBe('https://cdn.example/a.png');
    expect(await signedImage(h, 'data:image/png;base64,AAA')).toBeNull();
    h.callWS = vi.fn(() => Promise.reject(new Error('no'))) as FakeHass['callWS'];
    expect(await signedImage(h, '/api/brands/x')).toBeNull();
  });

  it('shows a library by the square icon of its brand, drawn for the theme, as the frontend does', () => {
    // DLNA's logo is wide with black letters: cropped to a square it read "dl", nearly invisible on a dark sheet.
    expect(brandImage('/api/brands/integration/dlna_dms/logo.png', true)).toBe('/api/brands/integration/dlna_dms/dark_icon.png');
    expect(brandImage('/api/brands/integration/dlna_dms/logo.png', false)).toBe('/api/brands/integration/dlna_dms/icon.png');
    expect(brandImage('/api/brands/integration/radio_browser/dark_logo@2x.png', false)).toBe('/api/brands/integration/radio_browser/icon@2x.png');
    expect(brandImage('https://brands.home-assistant.io/_/dlna_dms/logo.png', true)).toBe('https://brands.home-assistant.io/_/dlna_dms/dark_icon.png');
    // A cover of the speaker or of a radio is not a brand: it stays as it came.
    expect(brandImage('https://cdn.example/logo.png', true)).toBe('https://cdn.example/logo.png');
    expect(brandImage('/api/media_player_proxy/media_player.sala?token=x', true)).toBe('/api/media_player_proxy/media_player.sala?token=x');
  });
});
