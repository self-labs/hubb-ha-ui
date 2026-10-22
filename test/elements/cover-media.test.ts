import { afterEach, describe, expect, it, vi } from 'vitest';
import '../../src/elements/cover-tile';
import type { HubbCoverTile } from '../../src/elements/cover-tile';
import '../../src/elements/cover-panel';
import type { HubbCoverPanel } from '../../src/elements/cover-panel';
import '../../src/elements/fan-tile';
import type { HubbFanTile } from '../../src/elements/fan-tile';
import '../../src/elements/media-card';
import type { HubbMediaCard } from '../../src/elements/media-card';
import '../../src/elements/media-panel';
import type { HubbMediaPanel } from '../../src/elements/media-panel';
import { makeHass, type FakeHass } from '../helpers/fake-hass';

async function mount<T extends HTMLElement & { updateComplete: Promise<unknown> }>(tag: string, props: Record<string, unknown>): Promise<T> {
  const el = document.createElement(tag) as T;
  Object.assign(el, props);
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}

const text = (el: Element, sel: string) => el.shadowRoot!.querySelector(sel)?.textContent?.replace(/\s+/g, ' ').trim() ?? null;
const services = (h: FakeHass) => h.calls.map((c) => [`${c.domain}.${c.service}`, c.data]);
const click = (el: Element, sel: string) => (el.shadowRoot!.querySelector(sel) as HTMLElement).click();

describe('curtains', () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  const cortina = (state: string, attributes: Record<string, unknown> = {}) =>
    makeHass({ entities: [{ entity_id: 'cover.cortina', state, attributes: { supported_features: 1 | 2 | 4 | 8, ...attributes } }] });
  const tile = (h: FakeHass) => mount<HubbCoverTile>('hubb-cover-tile', { hass: h, item: { entityId: 'cover.cortina', name: 'Cortina' } });

  it('says how open it is, and a tap opens, closes or stops it', async () => {
    const closed = cortina('closed');
    const el = await tile(closed);
    expect(text(el, '.state')).toBe('Fechada');
    click(el, 'button');
    await el.updateComplete;
    expect(text(el, '.state')).toBe('Abrindo…');
    expect(services(closed)).toEqual([['cover.open_cover', undefined]]);
    document.body.replaceChildren();
    const half = cortina('open', { current_position: 40 });
    const el2 = await tile(half);
    expect(text(el2, '.state')).toBe('40% aberta');
    click(el2, 'button');
    expect(services(half)).toEqual([['cover.close_cover', undefined]]);
    document.body.replaceChildren();
    const moving = cortina('opening');
    click(await tile(moving), 'button');
    expect(services(moving)).toEqual([['cover.stop_cover', undefined]]);
  });

  it('opens its sheet with a right click, where it goes to a position', async () => {
    const h = cortina('open', { current_position: 100 });
    const el = await tile(h);
    let asked: string | null = null;
    document.body.addEventListener('hubb-open-cover', (e) => (asked = (e as CustomEvent<{ entityId: string }>).detail.entityId), { once: true });
    el.shadowRoot!.querySelector('button')!.dispatchEvent(new Event('contextmenu', { bubbles: true, cancelable: true }));
    expect(asked).toBe('cover.cortina');
    const panel = await mount<HubbCoverPanel>('hubb-cover-panel', { hass: h, entityId: 'cover.cortina' });
    expect([...panel.shadowRoot!.querySelectorAll('.position')].map((b) => b.textContent!.trim())).toEqual(['0%', '25%', '50%', '75%', '100%']);
    (panel.shadowRoot!.querySelectorAll('.position')[2] as HTMLButtonElement).click();
    click(panel, '.stop');
    expect(services(h)).toEqual([
      ['cover.set_cover_position', { position: 50 }],
      ['cover.stop_cover', undefined],
    ]);
  });
});

describe('fans', () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it('switches through the fan domain and opens its sheet when it has speeds', async () => {
    const h = makeHass({ entities: [{ entity_id: 'fan.teto', state: 'off', attributes: { supported_features: 1 | 16 | 32 } }] });
    const el = await mount<HubbFanTile>('hubb-fan-tile', { hass: h, item: { entityId: 'fan.teto', name: 'Ventilador', kind: 'fan' } });
    expect(text(el, '.state')).toBe('Desligado');
    click(el, 'button');
    expect(services(h)).toEqual([['fan.turn_on', undefined]]);
    let asked: string | null = null;
    document.body.addEventListener('hubb-open-climate', (e) => (asked = (e as CustomEvent<{ entityId: string }>).detail.entityId), { once: true });
    el.shadowRoot!.querySelector('button')!.dispatchEvent(new Event('contextmenu', { bubbles: true, cancelable: true }));
    expect(asked).toBe('fan.teto');
  });
});

describe('media', () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  const ALL = 1 | 4 | 8 | 16 | 32 | 128 | 256 | 1024 | 2048 | 16384;
  const tv = (state: string, attributes: Record<string, unknown> = {}) =>
    makeHass({
      entities: [
        {
          entity_id: 'media_player.tv',
          state,
          attributes: { supported_features: ALL, volume_level: 0.4, is_volume_muted: false, source: 'HDMI 1', source_list: ['HDMI 1', 'Netflix'], ...attributes },
        },
      ],
    });

  it('says what is on, and plays, pauses and turns it off from the card', async () => {
    const h = tv('playing', { media_title: 'Jornal', app_name: 'Globoplay' });
    const el = await mount<HubbMediaCard>('hubb-media-card', { hass: h, item: { entityId: 'media_player.tv', name: 'TV' } });
    expect(text(el, '.state')).toBe('Jornal');
    click(el, '.play');
    click(el, '.power');
    expect(services(h)).toEqual([
      ['media_player.media_play_pause', undefined],
      ['media_player.turn_off', undefined],
    ]);
    document.body.replaceChildren();
    const off = tv('off');
    const el2 = await mount<HubbMediaCard>('hubb-media-card', { hass: off, item: { entityId: 'media_player.tv', name: 'TV' } });
    expect(text(el2, '.state')).toBe('Desligado');
    expect(el2.shadowRoot!.querySelector('.play')).toBeNull();
  });

  it('changes the volume, the sound and the source in its sheet', async () => {
    vi.useFakeTimers();
    try {
      const h = tv('on');
      const el = await mount<HubbMediaPanel>('hubb-media-panel', { hass: h, entityId: 'media_player.tv' });
      expect(text(el, '.volume')).toBe('40%');
      click(el, '.louder');
      click(el, '.mute');
      const source = el.shadowRoot!.querySelector<HTMLSelectElement>('select.source')!;
      source.value = 'Netflix';
      source.dispatchEvent(new Event('change'));
      click(el, '.next');
      // The volume waits 300 ms for more taps before it leaves, so it arrives after the others.
      await vi.advanceTimersByTimeAsync(300);
      expect(services(h)).toEqual([
        ['media_player.volume_mute', { is_volume_muted: true }],
        ['media_player.select_source', { source: 'Netflix' }],
        ['media_player.media_next_track', undefined],
        ['media_player.volume_set', { volume_level: 0.45 }],
      ]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('turns it on and off from its sheet, and shows only the power of a player that is off', async () => {
    const h = tv('off');
    const el = await mount<HubbMediaPanel>('hubb-media-panel', { hass: h, entityId: 'media_player.tv' });
    expect(text(el, '.power')).toBe('Ligar');
    expect(el.shadowRoot!.querySelector('.volume')).toBeNull();
    expect(el.shadowRoot!.querySelector('.play')).toBeNull();
    click(el, '.power');
    document.body.replaceChildren();
    const on = tv('playing');
    const el2 = await mount<HubbMediaPanel>('hubb-media-panel', { hass: on, entityId: 'media_player.tv' });
    expect(text(el2, '.power')).toBe('Desligar');
    click(el2, '.power');
    expect([...services(h), ...services(on)]).toEqual([
      ['media_player.turn_on', undefined],
      ['media_player.turn_off', undefined],
    ]);
  });
});
