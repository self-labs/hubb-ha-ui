import { mdiCurtainsClosed, mdiTelevision, mdiTelevisionOff } from '@mdi/js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import '../../src/elements/cover-panel';
import '../../src/elements/cover-tile';
import type { HubbCoverPanel } from '../../src/elements/cover-panel';
import type { HubbCoverTile } from '../../src/elements/cover-tile';
import { HOLD_SHOW_MS } from '../../src/elements/hold';
import { makeHass, type FakeHass } from '../helpers/fake-hass';

// The flap of a ceiling TV is a cover shown as Flap: its words are masculine and its icon is a TV
// (Gustavo, 14/11). Open, close and stop are the three bits of a flap with a learned stop key.
const OPEN_CLOSE_STOP = 1 | 2 | 8;

function flap(state: string, attributes: Record<string, unknown> = {}): FakeHass {
  return makeHass({ entities: [{ entity_id: 'cover.flap', state, attributes: { supported_features: OPEN_CLOSE_STOP, ...attributes } }] });
}

async function mount<T extends HTMLElement & { updateComplete: Promise<unknown> }>(tag: string, props: Record<string, unknown>): Promise<T> {
  const el = document.createElement(tag) as T;
  Object.assign(el, props);
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}

const tile = (hass: FakeHass, kind?: 'flap') => mount<HubbCoverTile>('hubb-cover-tile', { hass, item: { entityId: 'cover.flap', name: 'Flap' }, ...(kind ? { kind } : {}) });
const panel = (hass: FakeHass, kind?: 'flap') => mount<HubbCoverPanel>('hubb-cover-panel', { hass, entityId: 'cover.flap', ...(kind ? { kind } : {}) });
const text = (el: Element, sel: string) => el.shadowRoot!.querySelector(sel)?.textContent?.replace(/\s+/g, ' ').trim() ?? null;
const drawn = (el: Element) => el.shadowRoot!.querySelector('.icon path')!.getAttribute('d');

describe('the flap tile', () => {
  afterEach(() => document.body.replaceChildren());

  it('says its state in the masculine', async () => {
    expect(text(await tile(flap('closed'), 'flap'), '.state')).toBe('Fechado');
    document.body.replaceChildren();
    expect(text(await tile(flap('open'), 'flap'), '.state')).toBe('Aberto');
    document.body.replaceChildren();
    expect(text(await tile(flap('opening'), 'flap'), '.state')).toBe('Abrindo…');
  });

  it('draws a TV, dark while the flap is closed', async () => {
    expect(drawn(await tile(flap('closed'), 'flap'))).toBe(mdiTelevisionOff);
    document.body.replaceChildren();
    expect(drawn(await tile(flap('open'), 'flap'))).toBe(mdiTelevision);
  });

  it('stays a curtain when no kind is given', async () => {
    const el = await tile(flap('closed'));
    expect(text(el, '.state')).toBe('Fechada');
    expect(drawn(el)).toBe(mdiCurtainsClosed);
  });
});

describe('the flap sheet', () => {
  afterEach(() => document.body.replaceChildren());

  it('says the state in the masculine and offers Abrir, Parar and Fechar, with no position', async () => {
    const el = await panel(flap('closed'), 'flap');
    expect(text(el, '.now')).toBe('Fechado');
    expect([...el.shadowRoot!.querySelectorAll('.row button')].map((b) => b.textContent!.trim())).toEqual(['Abrir', 'Parar', 'Fechar']);
    expect(el.shadowRoot!.querySelector('.position')).toBeNull();
  });

  it('keeps the feminine words for a curtain', async () => {
    expect(text(await panel(flap('closed')), '.now')).toBe('Fechada');
  });
});

// A tap on a curtain or a flap opens its sheet and a hold runs the command, as on the lights (Gustavo, 14/11).
describe.each(['cover', 'flap'] as const)('the %s tile: tap opens, hold runs', (kind) => {
  afterEach(() => {
    vi.useRealTimers();
    document.body.replaceChildren();
  });

  const button = (el: Element) => el.shadowRoot!.querySelector('button')!;
  const down = (pointerType: string) => Object.assign(new Event('pointerdown'), { pointerType });
  const services = (h: FakeHass) => h.calls.map((c) => c.service);
  async function mounted(hass: FakeHass) {
    vi.useFakeTimers();
    const el = await tile(hass, kind === 'flap' ? 'flap' : undefined);
    const asked: string[] = [];
    el.addEventListener('hubb-open-cover', (e) => asked.push((e as CustomEvent<{ entityId: string }>).detail.entityId));
    return { el, asked };
  }

  it('opens the sheet on a tap and sends nothing', async () => {
    const hass = flap('closed');
    const { el, asked } = await mounted(hass);
    button(el).click();
    expect(asked).toEqual(['cover.flap']);
    expect(hass.calls).toEqual([]);
  });

  it.each([
    ['closed', 'open_cover'],
    ['open', 'close_cover'],
    ['opening', 'stop_cover'],
    ['closing', 'stop_cover'],
  ])('runs %s as %s on a hold, and the click that follows opens nothing', async (state, service) => {
    const hass = flap(state);
    const { el, asked } = await mounted(hass);
    button(el).dispatchEvent(down('mouse'));
    vi.advanceTimersByTime(600);
    button(el).dispatchEvent(new Event('pointerup'));
    button(el).click();
    expect(services(hass)).toEqual([service]);
    expect(asked).toEqual([]);
  });

  it('turns back a cover that is on its way and cannot stop', async () => {
    const hass = flap('closing', { supported_features: 1 | 2 });
    const { el } = await mounted(hass);
    button(el).dispatchEvent(down('mouse'));
    vi.advanceTimersByTime(600);
    expect(services(hass)).toEqual(['open_cover']);
  });

  it('does not fill the tile on a tap: the fill only shows when the press really lasts', async () => {
    const hass = flap('closed');
    const { el, asked } = await mounted(hass);
    button(el).dispatchEvent(down('touch'));
    vi.advanceTimersByTime(HOLD_SHOW_MS - 30);
    await el.updateComplete;
    expect(button(el).classList.contains('holding')).toBe(false);
    button(el).dispatchEvent(new Event('pointerup'));
    vi.advanceTimersByTime(HOLD_SHOW_MS + 600);
    await el.updateComplete;
    expect(button(el).classList.contains('holding')).toBe(false);
    button(el).click();
    expect(asked).toEqual(['cover.flap']);
    expect(hass.calls).toEqual([]);
  });

  it('fills the tile while it is held and sends nothing when the finger leaves early', async () => {
    const hass = flap('closed');
    const { el } = await mounted(hass);
    button(el).dispatchEvent(down('touch'));
    vi.advanceTimersByTime(HOLD_SHOW_MS + 70);
    await el.updateComplete;
    expect(button(el).classList.contains('holding')).toBe(true);
    button(el).dispatchEvent(new Event('pointercancel'));
    vi.advanceTimersByTime(600);
    await el.updateComplete;
    expect(button(el).classList.contains('holding')).toBe(false);
    expect(hass.calls).toEqual([]);
  });

  it('does not open the sheet on the context menu of a held finger, but opens it on a right click', async () => {
    const hass = flap('closed');
    const { el, asked } = await mounted(hass);
    button(el).dispatchEvent(down('touch'));
    button(el).dispatchEvent(new Event('contextmenu', { cancelable: true }));
    vi.advanceTimersByTime(600);
    expect(asked).toEqual([]);
    expect(services(hass)).toEqual(['open_cover']);
    button(el).dispatchEvent(new Event('pointerup'));
    button(el).dispatchEvent(down('mouse'));
    button(el).dispatchEvent(new Event('contextmenu', { cancelable: true }));
    expect(asked).toEqual(['cover.flap']);
  });

  it('runs the hold when Android sends the context menu of a held finger and then cancels the pointer', async () => {
    const hass = flap('closed');
    const { el, asked } = await mounted(hass);
    button(el).dispatchEvent(down('touch'));
    vi.advanceTimersByTime(400);
    button(el).dispatchEvent(new Event('contextmenu', { cancelable: true }));
    button(el).dispatchEvent(new Event('pointercancel'));
    vi.advanceTimersByTime(600);
    expect(services(hass)).toEqual(['open_cover']);
    expect(asked).toEqual([]);
  });

  it('opens the sheet from the menu key after a finger touched the tile: a key press ends the touch', async () => {
    const hass = flap('closed');
    const { el, asked } = await mounted(hass);
    button(el).dispatchEvent(down('touch'));
    button(el).dispatchEvent(new Event('pointerup'));
    button(el).dispatchEvent(new Event('keydown'));
    button(el).dispatchEvent(new Event('contextmenu', { cancelable: true }));
    expect(asked).toEqual(['cover.flap']);
  });

  it('announces that it opens a dialog', async () => {
    const { el } = await mounted(flap('closed'));
    expect(button(el).getAttribute('aria-haspopup')).toBe('dialog');
  });

  it('does not come back filled after it left the page in the middle of a hold', async () => {
    const { el } = await mounted(flap('closed'));
    button(el).dispatchEvent(down('mouse'));
    vi.advanceTimersByTime(HOLD_SHOW_MS + 70);
    await el.updateComplete;
    expect(button(el).classList.contains('holding')).toBe(true);
    el.remove();
    document.body.appendChild(el);
    await el.updateComplete;
    expect(button(el).classList.contains('holding')).toBe(false);
  });

  it('opens the sheet on a tap of a cover that does not answer, and a hold sends nothing', async () => {
    const hass = flap('unavailable');
    const { el, asked } = await mounted(hass);
    button(el).dispatchEvent(down('mouse'));
    vi.advanceTimersByTime(600);
    button(el).dispatchEvent(new Event('pointerup'));
    expect(hass.calls).toEqual([]);
    button(el).click();
    expect(asked).toEqual(['cover.flap']);
  });
});
