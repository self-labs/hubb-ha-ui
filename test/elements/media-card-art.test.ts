import { afterEach, describe, expect, it } from 'vitest';
import '../../src/elements/media-card';
import { HubbMediaCard } from '../../src/elements/media-card';
import { MEDIA_FEATURE } from '../../src/actions/media';
import { device, makeHass, type FakeEntity, type FakeHass } from '../helpers/fake-hass';

const FEATURES = MEDIA_FEATURE.pause | MEDIA_FEATURE.play | MEDIA_FEATURE.grouping;

function house(state: string, attributes: Record<string, unknown> = {}, more: FakeEntity[] = [], spotify?: Record<string, unknown>): FakeHass {
  return makeHass({
    devices: [device('d_sala', null, 'Caixa Sala')],
    entities: [
      { entity_id: 'media_player.caixa_sala', device_id: 'd_sala', platform: 'wiim', name: 'Caixa Sala', state, attributes: { supported_features: FEATURES, ...attributes } },
      ...more,
      ...(spotify
        ? [{ entity_id: 'media_player.spotify_lia', platform: 'spotify', name: 'Spotify', state: 'playing', attributes: { supported_features: FEATURES, source: 'Caixa Sala', ...spotify } } as FakeEntity]
        : []),
    ],
  });
}

const speaker = (id: string, name: string): FakeEntity => ({ entity_id: id, platform: 'wiim', name, state: 'playing', attributes: { supported_features: FEATURES } });

async function mount(h: FakeHass): Promise<HubbMediaCard> {
  const el = document.createElement('hubb-media-card') as HubbMediaCard;
  el.hass = h;
  el.item = { entityId: 'media_player.caixa_sala', name: 'Caixa Sala' };
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}

const $ = (el: HubbMediaCard, sel: string) => el.shadowRoot!.querySelector(sel);
const stateText = (el: HubbMediaCard) => $(el, '.state')!.textContent!.trim();

describe('the media card', () => {
  afterEach(() => document.body.replaceChildren());

  it('shows the cover instead of the icon, and the icon again when the image fails', async () => {
    const el = await mount(house('playing', { entity_picture: '/api/media_player_proxy/x' }));
    expect(($(el, 'img.art') as HTMLImageElement).getAttribute('src')).toBe('/api/media_player_proxy/x');
    expect($(el, '.icon')).toBeNull();
    $(el, 'img.art')!.dispatchEvent(new Event('error'));
    await el.updateComplete;
    expect($(el, 'img.art')).toBeNull();
    expect($(el, '.icon')).not.toBeNull();
  });

  it('takes the cover from the Spotify playing on it', async () => {
    const el = await mount(house('playing', {}, [], { entity_picture: '/api/spotify.jpg' }));
    expect(($(el, 'img.art') as HTMLImageElement).getAttribute('src')).toBe('/api/spotify.jpg');
  });

  it('keeps the icon on a speaker that is off, whatever cover it still reports', async () => {
    const el = await mount(house('off', { entity_picture: '/api/velha.jpg' }));
    expect($(el, 'img.art')).toBeNull();
    expect($(el, '.icon')).not.toBeNull();
  });

  it('scrolls a line longer than its place, and keeps a short one still', async () => {
    const el = await mount(house('playing', { media_title: 'Um nome de música bem comprido', media_artist: 'Banda' }));
    const box = $(el, '.state')!;
    const text = $(el, '.state .run') as HTMLElement;
    Object.defineProperty(box, 'clientWidth', { configurable: true, value: 120 });
    Object.defineProperty(text, 'scrollWidth', { configurable: true, value: 300 });
    el.hass = house('playing', { media_title: 'Outro nome de música bem comprido', media_artist: 'Banda' });
    await el.updateComplete;
    expect(box.classList.contains('scroll')).toBe(true);
    expect(text.style.getPropertyValue('--shift')).toBe('-180px');
    Object.defineProperty(text, 'scrollWidth', { configurable: true, value: 100 });
    el.hass = house('playing', { media_title: 'Curta', media_artist: 'Banda' });
    await el.updateComplete;
    expect(box.classList.contains('scroll')).toBe(false);
    const css = ([] as unknown[]).concat(HubbMediaCard.styles).map((s) => (s as { cssText: string }).cssText).join('\n');
    // The text is a box of its own, cut with an ellipsis, so a browser can measure it and a still line reads.
    expect(css).toMatch(/\.state \.run\s*\{[^}]*display: inline-block[^}]*text-overflow: ellipsis/);
    // A few rounds, then it rests at the start: moving text that never stops is not for everyone.
    expect(css).toMatch(/\.state\.scroll \.run\s*\{[^}]*animation: hubb-marquee [^;]* 6 alternate/);
    expect(css).toMatch(/prefers-reduced-motion: reduce\)\s*\{[^}]*\.run[^{]*\{[^}]*animation: none/);
  });

  it('measures the line again only when it changes, not on every update of the house', async () => {
    const h = house('playing', { media_title: 'Uma música', media_artist: 'Banda' });
    const el = await mount(h);
    const text = $(el, '.state .run') as HTMLElement;
    let reads = 0;
    Object.defineProperty(text, 'scrollWidth', { configurable: true, get: () => (reads++, 10) });
    el.hass = { ...h, states: { ...h.states } };
    await el.updateComplete;
    expect(reads).toBe(0);
  });

  it('keeps the icon with no cover', async () => {
    const el = await mount(house('playing'));
    expect($(el, 'img.art')).toBeNull();
    expect($(el, '.icon')).not.toBeNull();
  });

  it('moves the bars only while playing, and stills them when the phone asks for less motion', async () => {
    expect($(await mount(house('playing')), '.bars')).not.toBeNull();
    document.body.replaceChildren();
    expect($(await mount(house('paused')), '.bars')).toBeNull();
    const css = ([] as unknown[]).concat(HubbMediaCard.styles).map((s) => (s as { cssText: string }).cssText).join('\n');
    expect(css).toMatch(/prefers-reduced-motion: reduce\)\s*\{[^}]*\.bars i\s*\{[^}]*animation: none/);
  });

  it('says the music in a group too, and who it plays with on the group mark', async () => {
    const ids = ['media_player.caixa_sala', 'media_player.caixa_cozinha', 'media_player.caixa_quarto', 'media_player.caixa_varanda'];
    const others = [speaker(ids[1]!, 'Caixa Cozinha'), speaker(ids[2]!, 'Caixa Quarto'), speaker(ids[3]!, 'Caixa Varanda')];
    const cases: [number, string][] = [
      [2, 'Tocando junto com Caixa Cozinha'],
      [3, 'Tocando junto com Caixa Cozinha e Caixa Quarto'],
      [4, 'Tocando junto com Caixa Cozinha, Caixa Quarto e +1'],
    ];
    for (const [n, expected] of cases) {
      const el = await mount(house('playing', { group_members: ids.slice(0, n), media_title: 'Soul Food', media_artist: 'Plüm' }, others));
      expect(stateText(el)).toBe('Soul Food · Plüm');
      expect($(el, '.grouped')!.getAttribute('aria-label')).toBe(expected);
      document.body.replaceChildren();
    }
  });

  it('sends play and pause to whoever has them', async () => {
    const h = makeHass({
      devices: [device('d_sala', null, 'Caixa Sala')],
      entities: [
        { entity_id: 'media_player.caixa_sala', device_id: 'd_sala', platform: 'wiim', name: 'Caixa Sala', state: 'playing', attributes: { supported_features: MEDIA_FEATURE.grouping } },
        { entity_id: 'media_player.spotify_lia', platform: 'spotify', name: 'Spotify', state: 'playing', attributes: { supported_features: FEATURES, source: 'Caixa Sala' } },
      ],
    });
    const el = await mount(h);
    ($(el, '.play') as HTMLButtonElement).click();
    expect(h.calls.map((c) => [c.service, c.target])).toEqual([['media_play_pause', { entity_id: 'media_player.spotify_lia' }]]);
  });
});
