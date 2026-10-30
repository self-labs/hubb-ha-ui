import { afterEach, describe, expect, it, vi } from 'vitest';
import { resetRestForTests } from '../../src/actions/rest';
import { MEDIA_FEATURE } from '../../src/actions/media';
import '../../src/elements/media-card';
import type { HubbMediaCard } from '../../src/elements/media-card';
import '../../src/elements/mini-player';
import type { HubbMiniPlayer } from '../../src/elements/mini-player';
import { buildHouse } from '../../src/model/build-house';
import { nowPlaying } from '../../src/model/media';
import type { HubbScreen } from '../../src/screens/base';
import '../../src/screens/home-screen';
import { generateDashboard } from '../../src/strategy/generate';
import { MEDIA } from '../../src/strings';
import { area, device, makeHass, type FakeHass } from '../helpers/fake-hass';

const F = MEDIA_FEATURE;
const SPEAKER = 'media_player.caixa_sala';
const MA = 'media_player.caixa_sala_2';

/** A speaker playing by DLNA, which only sees a stream, and its Music Assistant player with the song. */
function house(maState = 'playing', user?: { id: string; name: string; is_admin: boolean }): FakeHass {
  return makeHass({
    ...(user ? { user } : {}),
    areas: [area('sala', 'Sala')],
    devices: [device('d_caixa', 'sala', 'Caixa Sala'), device('d_caixa_ma', null, 'Caixa Sala')],
    entities: [
      { entity_id: SPEAKER, device_id: 'd_caixa', platform: 'wiim', state: 'playing', attributes: { supported_features: F.pause | F.play | F.turnOff | F.volumeSet } },
      {
        entity_id: MA,
        device_id: 'd_caixa_ma',
        platform: 'music_assistant',
        state: maState,
        attributes: {
          mass_player_type: 'player',
          supported_features: F.pause | F.play | F.next | F.previous | F.seek,
          media_title: 'Sultans of Swing',
          media_artist: 'Dire Straits',
          entity_picture: '/api/ma/capa.jpg',
        },
      },
    ],
  });
}

async function mount<T extends HTMLElement & { updateComplete: Promise<unknown> }>(tag: string, h: FakeHass): Promise<T> {
  const el = document.createElement(tag) as T;
  Object.assign(el, { hass: h, item: { entityId: SPEAKER, name: 'Caixa Sala', ma: MA } });
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}

const calls = (h: FakeHass) => h.calls.map((c) => [c.service, c.target?.entity_id]);

describe('the card and the mini player follow Music Assistant', () => {
  afterEach(() => document.body.replaceChildren());

  it('shows and commands the Music Assistant song on the card', async () => {
    const h = house();
    const el = await mount<HubbMediaCard>('hubb-media-card', h);
    expect(el.shadowRoot!.querySelector('.state')!.textContent).toContain('Sultans of Swing');
    expect((el.shadowRoot!.querySelector('img.art') as HTMLImageElement).getAttribute('src')).toBe('/api/ma/capa.jpg');
    (el.shadowRoot!.querySelector('.play') as HTMLButtonElement).click();
    (el.shadowRoot!.querySelector('.power') as HTMLButtonElement).click();
    expect(calls(h)).toEqual([
      ['media_play_pause', MA],
      ['turn_off', SPEAKER],
    ]);
  });

  it('keeps play when Music Assistant stopped the queue 30 s after a pause, and resumes it', async () => {
    // Seen 27/10: 30 s after a pause Music Assistant stopped the queue and stayed idle on the song, the
    // speaker idle on DLNA, and the card lost play: only power was left.
    const h = house('idle');
    h.states[MA] = { ...h.states[MA]!, attributes: { ...h.states[MA]!.attributes, active_queue: 'caixa_sala' } };
    h.states[SPEAKER] = { ...h.states[SPEAKER]!, state: 'idle', attributes: { ...h.states[SPEAKER]!.attributes, source: 'DLNA' } };
    const el = await mount<HubbMediaCard>('hubb-media-card', h);
    const play = el.shadowRoot!.querySelector<HTMLButtonElement>('.play');
    expect(play?.getAttribute('aria-label')).toBe(MEDIA.play);
    play!.click();
    expect(calls(h)).toEqual([['media_play_pause', MA]]);
  });

  it('offers no play for a stopped Music Assistant with no queue to resume', async () => {
    const h = house('idle');
    h.states[SPEAKER] = { ...h.states[SPEAKER]!, state: 'idle', attributes: { ...h.states[SPEAKER]!.attributes, source: 'DLNA' } };
    const el = await mount<HubbMediaCard>('hubb-media-card', h);
    expect(el.shadowRoot!.querySelector('.play')).toBeNull();
  });

  it('the mini player plays the next song on Music Assistant', async () => {
    const h = house();
    const el = await mount<HubbMiniPlayer>('hubb-mini-player', h);
    expect(el.shadowRoot!.querySelector('.title')!.textContent).toBe('Sultans of Swing');
    (el.shadowRoot!.querySelector('.next') as HTMLButtonElement).click();
    expect(calls(h)).toEqual([['media_next_track', MA]]);
  });

  it('nowPlaying finds a speaker whose music plays on Music Assistant', () => {
    const h = house();
    h.states[SPEAKER] = { ...h.states[SPEAKER]!, state: 'idle' };
    expect(nowPlaying(buildHouse(h, {}), h, null)?.entityId).toBe(SPEAKER);
  });

  it('names the speakers it plays with, never their Music Assistant players', async () => {
    const TV = 'media_player.tv_quarto';
    const TV_MA = 'media_player.tv_quarto_2';
    const group = [MA, TV_MA];
    const h = makeHass({
      // A forced pair: Music Assistant kept the name the TV gave itself.
      devices: [device('d_caixa', 'sala', 'Caixa Sala'), device('d_caixa_ma', null, 'Caixa Sala'), device('d_tv', null, 'TV Quarto'), device('d_tv_ma', null, 'LG webOS TV')],
      entities: [
        { entity_id: SPEAKER, device_id: 'd_caixa', platform: 'wiim', state: 'playing', attributes: { supported_features: F.pause | F.play } },
        { entity_id: TV, device_id: 'd_tv', platform: 'webostv', name: 'TV Quarto', state: 'on', attributes: { supported_features: F.pause | F.play } },
        { entity_id: MA, device_id: 'd_caixa_ma', platform: 'music_assistant', state: 'playing', attributes: { mass_player_type: 'player', group_members: group, media_title: 'Sultans of Swing' } },
        { entity_id: TV_MA, device_id: 'd_tv_ma', platform: 'music_assistant', state: 'playing', attributes: { mass_player_type: 'player', group_members: group, media_title: 'Sultans of Swing' } },
      ],
    });
    const el = document.createElement('hubb-media-card') as HubbMediaCard;
    Object.assign(el, { hass: h, item: { entityId: SPEAKER, name: 'Caixa Sala', ma: MA }, pairs: { [SPEAKER]: MA, [TV]: TV_MA } });
    document.body.appendChild(el);
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.grouped')!.getAttribute('aria-label')).toBe('Tocando junto com TV Quarto');
  });

  it('the rest screen of a tablet names the song of Music Assistant', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
    try {
      const h = house('playing', { id: 'u_lia', name: 'Tablet', is_admin: false });
      const card = generateDashboard({ tablets: { u_lia: { room: 'sala' } } }, h).views.find((v) => v.path === 'home')!.cards[0]!;
      const el = document.createElement('hubb-home-screen') as HubbScreen & { setConfig(c: unknown): void };
      el.setConfig(card);
      el.hass = h;
      document.body.appendChild(el);
      await el.updateComplete;
      vi.advanceTimersByTime(5 * 60_000);
      await el.updateComplete;
      const rest = el.shadowRoot!.querySelector('hubb-rest-screen') as (HTMLElement & { line: string }) | null;
      expect(rest?.line).toContain('Sultans of Swing');
    } finally {
      vi.useRealTimers();
      resetRestForTests();
    }
  });
});
