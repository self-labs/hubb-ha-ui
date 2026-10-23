import { afterEach, describe, expect, it } from 'vitest';
import { MEDIA_FEATURE } from '../../src/actions/media';
import '../../src/elements/nav-bar';
import type { HubbNavBar } from '../../src/elements/nav-bar';
import type { Shared } from '../../src/model/types';
import '../../src/screens/media-screen';
import '../../src/screens/room-screen';
import type { HubbMediaScreen } from '../../src/screens/media-screen';
import { generateDashboard } from '../../src/strategy/generate';
import { area, device, makeHass, type FakeEntity, type FakeHass } from '../helpers/fake-hass';

const F = MEDIA_FEATURE;
const LIA = 'u_lia';
const CAIXA = 'media_player.caixa_sala';
const CAIXA_MA = 'media_player.caixa_sala_2';
const TV = 'media_player.tv_quarto';
const VARANDA = 'media_player.caixa_varanda';

/** Three rooms with sound: the Caixa plays by Music Assistant, the TV by itself, the Varanda is paused. */
function house(states: Partial<Record<string, string>> = {}, user?: { id: string; name: string; is_admin: boolean }): FakeHass {
  const player = (entity_id: string, device_id: string, platform: string, name: string, extra: Partial<FakeEntity> = {}): FakeEntity => ({
    entity_id,
    device_id,
    platform,
    name,
    state: states[entity_id] ?? 'playing',
    attributes: { supported_features: F.pause | F.play | F.volumeSet, media_title: `Música de ${name}` },
    ...extra,
  });
  return makeHass({
    ...(user ? { user } : {}),
    areas: [area('sala', 'Sala'), area('quarto', 'Quarto'), area('varanda', 'Varanda')],
    devices: [device('d_caixa', 'sala', 'Caixa Sala'), device('d_caixa_ma', null, 'Caixa Sala'), device('d_tv', 'quarto', 'TV Quarto'), device('d_var', 'varanda', 'Caixa Varanda')],
    entities: [
      player(CAIXA, 'd_caixa', 'wiim', 'Caixa Sala'),
      player(CAIXA_MA, 'd_caixa_ma', 'music_assistant', 'Caixa Sala MA', { attributes: { mass_player_type: 'player', supported_features: F.pause | F.play, media_title: 'Sultans of Swing' } }),
      player(TV, 'd_tv', 'webostv', 'TV Quarto'),
      player(VARANDA, 'd_var', 'wiim', 'Caixa Varanda'),
    ],
  });
}

const viewOf = (h: FakeHass, config = {}) => generateDashboard(config, h).views.find((v) => v.path === 'midia')!;
const sharedOf = (h: FakeHass, config = {}) => generateDashboard(config, h).views[0]!.cards[0]!.shared as Shared;

async function mount(h: FakeHass): Promise<HubbMediaScreen> {
  const el = document.createElement('hubb-media-screen') as HubbMediaScreen;
  el.setConfig(viewOf(h).cards[0] as never);
  el.hass = h;
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}

describe('the Mídia tab', () => {
  afterEach(() => document.body.replaceChildren());

  it('offers the Mídia tab with two or more speakers the viewer sees', async () => {
    expect(sharedOf(house()).mediaTab).toBe(true);
    expect(viewOf(house()).cards[0]!.type).toBe('custom:hubb-media-screen');
    const lone = makeHass({ areas: [area('sala', 'Sala')], entities: [{ entity_id: CAIXA, area_id: 'sala', platform: 'wiim', state: 'idle' }] });
    expect(sharedOf(lone).mediaTab).toBe(false);
    expect(viewOf(lone).cards[0]!.type).toBe('custom:hubb-redirect-card');
    const lia = house({}, { id: LIA, name: 'Lia', is_admin: false });
    expect(sharedOf(lia, { tabs: { media: { hidden_for: [LIA] } } }).mediaTab).toBe(false);
    const nav = document.createElement('hubb-nav-bar') as HubbNavBar;
    nav.security = true;
    nav.media = true;
    document.body.appendChild(nav);
    await nav.updateComplete;
    expect([...nav.shadowRoot!.querySelectorAll('nav button span')].map((s) => s.textContent)).toEqual(['Casa', 'Cenas', 'Mídia', 'Segurança']);
  });

  it('lists every room with its speakers, in the order of the house', async () => {
    const el = await mount(house());
    expect([...el.shadowRoot!.querySelectorAll('h2')].map((h) => h.textContent!.trim())).toEqual(['Quarto', 'Sala', 'Varanda']);
    expect(el.shadowRoot!.querySelectorAll('hubb-media-card')).toHaveLength(3);
    expect(el.shadowRoot!.querySelector('hubb-nav-bar')!.getAttribute('current')).toBe('midia');
  });

  it('says how many play and pauses them all', async () => {
    const h = house({ [VARANDA]: 'paused' });
    const el = await mount(h);
    expect(el.shadowRoot!.querySelector('.status')!.textContent!.trim()).toBe('2 tocando');
    (el.shadowRoot!.querySelector('.pause-all') as HTMLButtonElement).click();
    expect(h.calls.map((c) => [c.service, c.target?.entity_id]).sort()).toEqual([
      ['media_pause', CAIXA_MA],
      ['media_pause', TV],
    ]);
    document.body.replaceChildren();
    const quiet = await mount(house({ [CAIXA]: 'idle', [CAIXA_MA]: 'idle', [TV]: 'idle', [VARANDA]: 'idle' }));
    expect(quiet.shadowRoot!.querySelector('.status')!.textContent!.trim()).toBe('Nada tocando');
    expect(quiet.shadowRoot!.querySelector('.pause-all')).toBeNull();
  });

  it('opens the sheet of a speaker in place', async () => {
    const el = await mount(house());
    el.shadowRoot!.querySelector('hubb-media-card')!.dispatchEvent(new CustomEvent('hubb-open-media', { detail: { entityId: TV }, bubbles: true, composed: true }));
    await el.updateComplete;
    const panel = el.shadowRoot!.querySelector('hubb-sheet.media hubb-media-panel') as HTMLElement & { entityId: string };
    expect(panel.entityId).toBe(TV);
  });

  it('counts and pauses what the cards show: the Spotify on a TV, a member through its leader, never an infrared TV', async () => {
    const IR = 'media_player.tv_escritorio';
    const SPOTIFY = 'media_player.spotify_lia';
    const grouped = { group_members: [CAIXA, VARANDA] };
    const h = makeHass({
      areas: [area('sala', 'Sala'), area('quarto', 'Quarto'), area('varanda', 'Varanda'), area('escritorio', 'Escritório')],
      devices: [device('d_caixa', 'sala', 'Caixa Sala'), device('d_tv', 'quarto', 'TV Quarto'), device('d_var', 'varanda', 'Caixa Varanda'), device('d_ir', 'escritorio', 'TV Escritório')],
      entities: [
        { entity_id: CAIXA, device_id: 'd_caixa', platform: 'wiim', state: 'playing', attributes: { supported_features: F.pause | F.play, ...grouped, group_role: 'master', media_title: 'Sultans of Swing' } },
        // The member's own copy goes stale: it still says paused while it plays the leader's song.
        { entity_id: VARANDA, device_id: 'd_var', platform: 'wiim', state: 'paused', attributes: { supported_features: F.pause | F.play, ...grouped, group_role: 'slave' } },
        // The TV only lends its name to the Spotify playing on it.
        { entity_id: TV, device_id: 'd_tv', platform: 'webostv', state: 'on', attributes: { supported_features: F.volumeSet } },
        { entity_id: SPOTIFY, platform: 'spotify', state: 'playing', attributes: { supported_features: F.pause | F.play, source: 'TV Quarto', media_title: 'Lia' } },
        // By infrared the state is the last command sent, not what the TV does.
        { entity_id: IR, device_id: 'd_ir', platform: 'tasmota_ir', state: 'playing', attributes: { supported_features: F.pause | F.play } },
      ],
    });
    const el = await mount(h);
    expect(el.shadowRoot!.querySelector('.status')!.textContent!.trim()).toBe('3 tocando');
    (el.shadowRoot!.querySelector('.pause-all') as HTMLButtonElement).click();
    expect(h.calls.map((c) => [c.service, c.target?.entity_id]).sort()).toEqual([
      ['media_pause', CAIXA],
      ['media_pause', SPOTIFY],
    ]);
  });

  it('gives every card the pairs of Music Assistant, on the tab and in the room', async () => {
    const h = house();
    const tab = await mount(h);
    expect((tab.shadowRoot!.querySelector('hubb-media-card') as HTMLElement & { pairs: unknown }).pairs).toEqual({ [CAIXA]: CAIXA_MA });
    const room = document.createElement('hubb-room-screen') as HTMLElement & { setConfig(c: unknown): void; hass: FakeHass; updateComplete: Promise<unknown> };
    room.setConfig(generateDashboard({}, h).views.find((v) => v.path === 'sala')!.cards[0]);
    room.hass = h;
    document.body.appendChild(room);
    await room.updateComplete;
    expect((room.shadowRoot!.querySelector('hubb-media-card') as HTMLElement & { pairs: unknown }).pairs).toEqual({ [CAIXA]: CAIXA_MA });
  });
});
