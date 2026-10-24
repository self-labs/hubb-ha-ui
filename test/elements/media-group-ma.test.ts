import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MEDIA_FEATURE } from '../../src/actions/media';
import '../../src/elements/media-group';
import type { HubbMediaGroup } from '../../src/elements/media-group';
import { area, device, makeHass, type FakeEntity, type FakeHass } from '../helpers/fake-hass';

const F = MEDIA_FEATURE;
const CAIXA = 'media_player.caixa_sala';
const CAIXA_MA = 'media_player.caixa_sala_2';
const TV = 'media_player.tv_quarto';
const TV_MA = 'media_player.tv_quarto_2';
const VARANDA = 'media_player.caixa_varanda';
const VARANDA_MA = 'media_player.caixa_varanda_2';
const PAIRS = { [CAIXA]: CAIXA_MA, [TV]: TV_MA, [VARANDA]: VARANDA_MA };

/** An AudioCast, a TV of another brand and a second AudioCast, each with its Music Assistant player. */
function house(group: string[] = [], channels: Record<string, string> = {}): FakeHass {
  const ma = (entity_id: string, device_id: string): FakeEntity => ({
    entity_id,
    device_id,
    platform: 'music_assistant',
    state: 'playing',
    attributes: { mass_player_type: 'player', supported_features: F.grouping | F.volumeSet, ...(group.includes(entity_id) ? { group_members: group } : {}) },
  });
  const native = (entity_id: string, device_id: string, platform: string, area_id: string, name: string): FakeEntity => ({
    entity_id,
    device_id,
    area_id,
    platform,
    name,
    state: 'playing',
    attributes: { supported_features: platform === 'wiim' ? F.grouping | F.volumeSet : F.volumeSet, volume_level: 0.3 },
  });
  const channel = (entity_id: string, device_id: string): FakeEntity => ({
    entity_id,
    device_id,
    platform: 'wiim',
    translation_key: 'output_channel',
    state: channels[entity_id] ?? 'Stereo',
    attributes: { options: ['Stereo', 'Left', 'Right'] },
  });
  return makeHass({
    areas: [area('sala', 'Sala'), area('quarto', 'Quarto'), area('varanda', 'Varanda')],
    devices: [
      device('d_caixa', 'sala', 'Caixa Sala'),
      device('d_caixa_ma', null, 'Caixa Sala'),
      device('d_tv', 'quarto', 'TV Quarto'),
      device('d_tv_ma', null, 'TV Quarto'),
      device('d_var', 'varanda', 'Caixa Varanda'),
      device('d_var_ma', null, 'Caixa Varanda'),
    ],
    entities: [
      native(CAIXA, 'd_caixa', 'wiim', 'sala', 'Caixa Sala'),
      native(TV, 'd_tv', 'webostv', 'quarto', 'TV Quarto'),
      native(VARANDA, 'd_var', 'wiim', 'varanda', 'Caixa Varanda'),
      ma(CAIXA_MA, 'd_caixa_ma'),
      ma(TV_MA, 'd_tv_ma'),
      ma(VARANDA_MA, 'd_var_ma'),
      channel('select.caixa_sala_canal', 'd_caixa'),
      channel('select.caixa_varanda_canal', 'd_var'),
    ],
  });
}

async function mount(h: FakeHass, pairs: Record<string, string> = PAIRS): Promise<HubbMediaGroup> {
  const el = document.createElement('hubb-media-group') as HubbMediaGroup;
  el.hass = h;
  el.entityId = CAIXA;
  el.visible = [CAIXA, TV, VARANDA];
  el.pairs = pairs;
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}

const calls = (h: FakeHass) => h.calls.map((c) => [`${c.domain}.${c.service}`, c.data, c.target?.entity_id]);
const rows = (el: HubbMediaGroup) => [...el.shadowRoot!.querySelectorAll('.member .name')].map((n) => n.textContent!.trim());
const switchOf = (el: HubbMediaGroup, name: string) =>
  [...el.shadowRoot!.querySelectorAll<HTMLButtonElement>('.member [role="switch"]')].find((b) => b.getAttribute('aria-label')!.startsWith(name))!;

describe('playing together across brands', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    document.body.replaceChildren();
  });

  it('offers speakers of any brand through Music Assistant', async () => {
    const h = house();
    const el = await mount(h);
    expect(rows(el)).toEqual(['TV Quarto', 'Caixa Varanda']);
    switchOf(el, 'TV Quarto').click();
    expect(calls(h)).toEqual([['media_player.join', { group_members: [TV_MA] }, CAIXA_MA]]);
  });

  it('keeps a TV that is off from joining, and says so', async () => {
    // Seen 23/10: the TV joined while off, Music Assistant moved the group to AirPlay and nothing played.
    const h = house();
    h.states[TV] = { ...h.states[TV]!, state: 'unavailable' };
    const el = await mount(h);
    const tv = switchOf(el, 'TV Quarto');
    expect(tv.disabled).toBe(true);
    expect(tv.closest('.member')!.querySelector('.area')!.textContent!.trim()).toBe('Quarto · Desligado');
    tv.click();
    expect(calls(h)).toEqual([]);
  });

  it('reads who plays together from Music Assistant and lets one leave there', async () => {
    const h = house([CAIXA_MA, TV_MA]);
    const el = await mount(h);
    expect(switchOf(el, 'TV Quarto').getAttribute('aria-checked')).toBe('true');
    switchOf(el, 'TV Quarto').click();
    await vi.advanceTimersByTimeAsync(0);
    expect(calls(h)[0]).toEqual(['media_player.unjoin', undefined, TV_MA]);
  });

  it("keeps the integration's own grouping for a speaker with no pair", async () => {
    const h = house();
    const el = await mount(h, {});
    expect(rows(el)).toEqual(['Caixa Varanda']);
    switchOf(el, 'Caixa Varanda').click();
    expect(calls(h)).toEqual([['media_player.join', { group_members: [VARANDA] }, CAIXA]]);
  });

  it('keeps the Channel and the stereo pair on the speakers themselves', async () => {
    const h = house([CAIXA_MA, VARANDA_MA]);
    const el = await mount(h);
    const select = el.shadowRoot!.querySelector('select.member-channel') as HTMLSelectElement;
    select.value = 'Right';
    select.dispatchEvent(new Event('change'));
    (el.shadowRoot!.querySelector('.pair') as HTMLButtonElement).click();
    expect(calls(h)).toEqual([
      ['select.select_option', { option: 'Right' }, 'select.caixa_varanda_canal'],
      ['select.select_option', { option: 'Left' }, 'select.caixa_sala_canal'],
      ['select.select_option', { option: 'Right' }, 'select.caixa_varanda_canal'],
    ]);
  });
});
