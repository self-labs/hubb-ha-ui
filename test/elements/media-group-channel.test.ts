import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MEDIA_FEATURE } from '../../src/actions/media';
import '../../src/elements/media-card';
import type { HubbMediaCard } from '../../src/elements/media-card';
import '../../src/elements/media-group';
import type { HubbMediaGroup } from '../../src/elements/media-group';
import '../../src/elements/media-panel';
import type { HubbMediaPanel } from '../../src/elements/media-panel';
import { area, device, makeHass, type FakeEntity, type FakeHass } from '../helpers/fake-hass';

const F = MEDIA_FEATURE;
const GROUPS = F.grouping | F.volumeSet | F.play | F.pause | F.next | F.previous | F.repeat | F.shuffle | F.source;
const SALA = 'media_player.caixa_sala';
const QUARTO = 'media_player.caixa_quarto';
const VARANDA = 'media_player.caixa_varanda';

interface Speaker {
  id: string;
  room: string;
  name: string;
  channel?: string;
  attributes?: Record<string, unknown>;
}

/** WiiM speakers, each with its channel select; the first leads when `grouped` has more than one. */
function house(speakers: Speaker[], grouped: string[] = []): FakeHass {
  const entities: FakeEntity[] = [];
  for (const [n, s] of speakers.entries()) {
    const deviceId = `d_${s.room}`;
    entities.push({
      entity_id: s.id,
      device_id: deviceId,
      area_id: s.room,
      platform: 'wiim',
      name: s.name,
      state: 'playing',
      attributes: {
        supported_features: GROUPS,
        volume_level: 0.4,
        source: 'Spotify',
        source_list: ['Spotify', 'Line In'],
        ...(grouped.includes(s.id) ? { group_members: grouped, group_role: n === 0 ? 'master' : 'slave' } : {}),
        ...s.attributes,
      },
    });
    entities.push({
      entity_id: `select.${s.id.slice('media_player.'.length)}_channel`,
      device_id: deviceId,
      platform: 'wiim',
      translation_key: 'output_channel',
      entity_category: 'config',
      state: s.channel ?? 'Stereo',
      attributes: { options: ['Stereo', 'Left', 'Right'] },
    });
  }
  return makeHass({
    areas: speakers.map((s) => area(s.room, s.room)),
    devices: speakers.map((s) => device(`d_${s.room}`, s.room, s.name)),
    entities,
  });
}

const pair = (sala = 'Stereo', quarto = 'Stereo', own: { sala?: Record<string, unknown>; quarto?: Record<string, unknown> } = {}, grouped = true) =>
  house(
    [
      { id: SALA, room: 'sala', name: 'Caixa Sala', channel: sala, attributes: own.sala },
      { id: QUARTO, room: 'quarto', name: 'Caixa Quarto', channel: quarto, attributes: own.quarto },
    ],
    grouped ? [SALA, QUARTO] : [],
  );

async function mount<T extends HTMLElement & { updateComplete: Promise<unknown> }>(tag: string, props: Record<string, unknown>): Promise<T> {
  const el = document.createElement(tag) as T;
  Object.assign(el, props);
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}

const group = (h: FakeHass, entityId: string, visible = [SALA, QUARTO, VARANDA]) => mount<HubbMediaGroup>('hubb-media-group', { hass: h, entityId, visible });
const panel = (h: FakeHass, entityId: string) => mount<HubbMediaPanel>('hubb-media-panel', { hass: h, entityId, visible: [SALA, QUARTO] });
const calls = (h: FakeHass) => h.calls.map((c) => [`${c.domain}.${c.service}`, c.data, c.target?.entity_id]);
const stereo = (id: string) => ['select.select_option', { option: 'Stereo' }, id];
const click = (el: HTMLElement, sel: string) => (el.shadowRoot!.querySelector(sel) as HTMLButtonElement).click();

describe('the channels of a group', () => {
  beforeEach(() => vi.useFakeTimers({ now: Date.parse('2026-10-19T12:00:00Z') }));
  afterEach(() => {
    vi.useRealTimers();
    document.body.replaceChildren();
  });

  it('lets the leader pick the channel of each speaker in the group', async () => {
    const h = pair('Left', 'Right');
    const el = await group(h, SALA);
    const select = el.shadowRoot!.querySelector('select.member-channel') as HTMLSelectElement;
    expect([...select.options].map((o) => o.textContent!.trim())).toEqual(['Estéreo', 'Esquerdo', 'Direito']);
    expect(select.querySelector('[selected]')!.getAttribute('value')).toBe('Right');
    expect(select.getAttribute('aria-label')).toBe('Canal de Caixa Quarto');
    select.value = 'Left';
    select.dispatchEvent(new Event('change'));
    expect(calls(h)).toEqual([['select.select_option', { option: 'Left' }, 'select.caixa_quarto_channel']]);
  });

  it('makes a stereo pair of two speakers in one tap, and hides it once they are one, either way round', async () => {
    const h = pair();
    const el = await group(h, SALA);
    click(el, '.pair');
    expect(calls(h)).toEqual([
      ['select.select_option', { option: 'Left' }, 'select.caixa_sala_channel'],
      ['select.select_option', { option: 'Right' }, 'select.caixa_quarto_channel'],
    ]);
    for (const [sala, quarto] of [
      ['Left', 'Right'],
      ['Right', 'Left'],
    ]) {
      document.body.replaceChildren();
      expect((await group(pair(sala, quarto), SALA)).shadowRoot!.querySelector('.pair')).toBeNull();
    }
  });

  it('offers no pair with a speaker the resident cannot see, nor while a speaker is leaving', async () => {
    expect((await group(pair(), SALA, [SALA])).shadowRoot!.querySelector('.pair')).toBeNull();
    document.body.replaceChildren();
    const el = await group(pair('Left', 'Stereo'), SALA);
    click(el, '[role="switch"]');
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.pair')).toBeNull();
  });

  it('puts both back in stereo once the last member has left, from either sheet', async () => {
    const h = pair('Left', 'Right');
    const member = await group(h, QUARTO);
    click(member, '.leave');
    expect(calls(h)).toEqual([['media_player.unjoin', undefined, QUARTO]]);
    await vi.advanceTimersByTimeAsync(0);
    expect(calls(h)).toEqual([['media_player.unjoin', undefined, QUARTO], stereo('select.caixa_quarto_channel'), stereo('select.caixa_sala_channel')]);
    document.body.replaceChildren();
    const h2 = pair('Left', 'Right');
    const leader = await group(h2, SALA);
    click(leader, '[role="switch"]');
    await vi.advanceTimersByTimeAsync(0);
    expect(calls(h2)).toEqual([['media_player.unjoin', undefined, QUARTO], stereo('select.caixa_quarto_channel'), stereo('select.caixa_sala_channel')]);
  });

  it('counts the speakers already leaving, so two quick leaves still put the leader back in stereo', async () => {
    const h = house(
      [
        { id: SALA, room: 'sala', name: 'Caixa Sala', channel: 'Left' },
        { id: QUARTO, room: 'quarto', name: 'Caixa Quarto', channel: 'Right' },
        { id: VARANDA, room: 'varanda', name: 'Caixa Varanda' },
      ],
      [SALA, QUARTO, VARANDA],
    );
    const el = await group(h, SALA);
    const switches = el.shadowRoot!.querySelectorAll<HTMLButtonElement>('[role="switch"]');
    switches[0]!.click();
    switches[1]!.click();
    await vi.advanceTimersByTimeAsync(0);
    expect(calls(h)).toEqual([
      ['media_player.unjoin', undefined, QUARTO],
      ['media_player.unjoin', undefined, VARANDA],
      stereo('select.caixa_quarto_channel'),
      stereo('select.caixa_sala_channel'),
    ]);
  });

  it('keeps the channels when the unjoin fails, and leaves one already in stereo alone', async () => {
    const h = pair('Left', 'Right');
    h.callService = vi.fn(() => Promise.reject(new Error('down'))) as unknown as FakeHass['callService'];
    const member = await group(h, QUARTO);
    click(member, '.leave');
    await vi.advanceTimersByTimeAsync(0);
    expect((h.callService as unknown as { mock: { calls: unknown[][] } }).mock.calls.map((c) => c[1])).toEqual(['unjoin']);
    document.body.replaceChildren();
    const h2 = pair();
    click(await group(h2, QUARTO), '.leave');
    await vi.advanceTimersByTimeAsync(0);
    expect(calls(h2)).toEqual([['media_player.unjoin', undefined, QUARTO]]);
  });
});

describe('a member of a group', () => {
  afterEach(() => document.body.replaceChildren());

  it('shows and commands the music of the leader on its sheet, not its own stale copy', async () => {
    const h = pair('Stereo', 'Stereo', { sala: { repeat: 'off', shuffle: false, media_title: 'Música' }, quarto: { repeat: 'all', shuffle: true, media_title: 'Música' } });
    h.states[SALA] = { ...h.states[SALA]!, state: 'paused' };
    const el = await panel(h, QUARTO);
    const repeat = el.shadowRoot!.querySelector('.repeat')!;
    expect(repeat.getAttribute('aria-label')).toBe('Repetir: desligado');
    expect(el.shadowRoot!.querySelector('.shuffle')!.getAttribute('aria-pressed')).toBe('false');
    expect(el.shadowRoot!.querySelector('.play')!.getAttribute('aria-label')).toBe('Tocar');
    (repeat as HTMLButtonElement).click();
    click(el, '.next');
    expect(calls(h)).toEqual([
      ['media_player.repeat_set', { repeat: 'all' }, SALA],
      ['media_player.media_next_track', undefined, SALA],
    ]);
  });

  it('plays and pauses the leader from its card', async () => {
    const h = pair();
    const card = await mount<HubbMediaCard>('hubb-media-card', { hass: h, item: { entityId: QUARTO, name: 'Caixa Quarto' } });
    click(card, '.play');
    expect(calls(h)).toEqual([['media_player.media_play_pause', undefined, SALA]]);
  });

  it('offers no source on its sheet, which would take it out of the group', async () => {
    expect((await panel(pair(), QUARTO)).shadowRoot!.querySelector('select.source')).toBeNull();
    document.body.replaceChildren();
    expect((await panel(pair(), SALA)).shadowRoot!.querySelector('select.source')).not.toBeNull();
  });
});
