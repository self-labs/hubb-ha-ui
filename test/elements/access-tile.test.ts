import { afterEach, describe, expect, it, vi } from 'vitest';
import '../../src/elements/access-tile';
import type { HubbAccessTile } from '../../src/elements/access-tile';
import type { HubbSlideConfirm } from '../../src/elements/slide-confirm';
import type { AccessItem } from '../../src/model/types';
import { makeHass, type FakeHass } from '../helpers/fake-hass';

async function mount(hass: FakeHass, item: AccessItem): Promise<HubbAccessTile> {
  const el = document.createElement('hubb-access-tile') as HubbAccessTile;
  el.hass = hass;
  el.item = item;
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const text = (el: HubbAccessTile, sel: string) => el.shadowRoot!.querySelector(sel)?.textContent?.trim() ?? null;
const slide = (el: HubbAccessTile) => el.shadowRoot!.querySelector('hubb-slide-confirm') as HubbSlideConfirm | null;
async function confirm(el: HubbAccessTile): Promise<void> {
  slide(el)!.dispatchEvent(new CustomEvent('hubb-confirm', { bubbles: true, composed: true }));
  await flush();
  await el.updateComplete;
}

/** The same, under fake timers: the flush is a timer too. */
async function confirmLater(el: HubbAccessTile): Promise<void> {
  slide(el)!.dispatchEvent(new CustomEvent('hubb-confirm', { bubbles: true, composed: true }));
  await vi.advanceTimersByTimeAsync(0);
  await el.updateComplete;
}

const gate: AccessItem = { entityId: 'cover.portao', name: 'Portão', kind: 'cover' };
const door: AccessItem = { entityId: 'lock.porta', name: 'Porta', kind: 'lock' };

describe('hubb-access-tile', () => {
  afterEach(() => {
    vi.useRealTimers();
    document.body.replaceChildren();
  });

  it('opens a closed gate only by sliding, and says it is opening at once', async () => {
    const h = makeHass({ entities: [{ entity_id: 'cover.portao', state: 'closed' }] });
    const el = await mount(h, gate);
    expect(text(el, '.state')).toBe('Fechado');
    expect(slide(el)!.label).toBe('Deslize para abrir');
    expect(el.shadowRoot!.querySelector('.close')).toBeNull();
    (el.shadowRoot!.querySelector('.card') as HTMLElement).click();
    expect(h.calls).toEqual([]);
    await confirm(el);
    expect(h.calls).toEqual([{ domain: 'cover', service: 'open_cover', data: undefined, target: { entity_id: 'cover.portao' } }]);
    expect(text(el, '.state')).toBe('Abrindo…');
  });

  it('closes an open gate with a tap, and says Sem resposta when nothing changes in 3 s', async () => {
    vi.useFakeTimers();
    const h = makeHass({ entities: [{ entity_id: 'cover.portao', state: 'open' }] });
    const el = await mount(h, gate);
    expect(text(el, '.state')).toBe('Aberto');
    expect(slide(el)).toBeNull();
    (el.shadowRoot!.querySelector('.close') as HTMLButtonElement).click();
    await vi.advanceTimersByTimeAsync(0);
    await el.updateComplete;
    expect(h.calls.map((c) => `${c.domain}.${c.service}`)).toEqual(['cover.close_cover']);
    expect(text(el, '.state')).toBe('Fechando…');
    await vi.advanceTimersByTimeAsync(3100);
    await el.updateComplete;
    expect(text(el, '.state')).toBe('Sem resposta');
  });

  it('offers only the slide for a gate that does not know its state, since closing may pulse the same relay', async () => {
    const h = makeHass({ entities: [{ entity_id: 'cover.portao', state: 'unknown' }] });
    const el = await mount(h, gate);
    expect(slide(el)).not.toBeNull();
    expect(el.shadowRoot!.querySelector('.close')).toBeNull();
    expect(text(el, '.state')).toBeNull();
  });

  it('unlocks a lock only by sliding, and locks it with a tap', async () => {
    const locked = makeHass({ entities: [{ entity_id: 'lock.porta', state: 'locked' }] });
    const el = await mount(locked, door);
    expect(text(el, '.state')).toBe('Trancada');
    expect(slide(el)!.label).toBe('Deslize para destrancar');
    await confirm(el);
    expect(locked.calls.map((c) => `${c.domain}.${c.service}`)).toEqual(['lock.unlock']);
    document.body.replaceChildren();
    const open = makeHass({ entities: [{ entity_id: 'lock.porta', state: 'unlocked' }] });
    const el2 = await mount(open, door);
    expect(text(el2, '.state')).toBe('Destrancada');
    (el2.shadowRoot!.querySelector('.close') as HTMLButtonElement).click();
    expect(open.calls.map((c) => `${c.domain}.${c.service}`)).toEqual(['lock.lock']);
  });

  it('fires a pulse relay, a button or a script by sliding, and says Feito', async () => {
    const h = makeHass({
      entities: [
        { entity_id: 'switch.portao', state: 'off' },
        { entity_id: 'button.portao', state: 'unknown' },
        { entity_id: 'script.portao', state: 'off' },
      ],
    });
    for (const entityId of ['switch.portao', 'button.portao', 'script.portao']) {
      const el = await mount(h, { entityId, name: 'Portão', kind: 'pulse' });
      expect(slide(el)!.label).toBe('Deslize para acionar');
      await confirm(el);
      expect(text(el, '.state')).toBe('Feito');
    }
    expect(h.calls.map((c) => `${c.domain}.${c.service}`)).toEqual(['switch.turn_on', 'button.press', 'script.turn_on']);
  });

  it('does not send again while the first command is on its way', async () => {
    vi.useFakeTimers();
    const h = makeHass({
      entities: [
        { entity_id: 'switch.portao', state: 'off' },
        { entity_id: 'cover.portao', state: 'closed' },
      ],
    });
    const relay = await mount(h, { entityId: 'switch.portao', name: 'Portão', kind: 'pulse' });
    await confirmLater(relay);
    expect(slide(relay)!.disabled).toBe(true);
    await confirmLater(relay);
    await vi.advanceTimersByTimeAsync(2100);
    await relay.updateComplete;
    expect(slide(relay)!.disabled).toBe(false);
    await confirmLater(relay);
    const el = await mount(h, gate);
    await confirmLater(el);
    expect(slide(el)!.disabled).toBe(true);
    await confirmLater(el);
    expect(h.calls.map((c) => `${c.domain}.${c.service}`)).toEqual(['switch.turn_on', 'switch.turn_on', 'cover.open_cover']);
  });

  it('keeps Feito for its two seconds even when the answer is slow', async () => {
    vi.useFakeTimers();
    const h = makeHass({ entities: [{ entity_id: 'switch.portao', state: 'off' }] });
    let answer: () => void = () => undefined;
    h.callService = vi.fn(() => new Promise<unknown>((resolve) => (answer = () => resolve(undefined))));
    const el = await mount(h, { entityId: 'switch.portao', name: 'Portão', kind: 'pulse' });
    await confirmLater(el);
    await vi.advanceTimersByTimeAsync(2500);
    answer();
    await vi.advanceTimersByTimeAsync(0);
    await el.updateComplete;
    expect(text(el, '.state')).toBe('Feito');
    await vi.advanceTimersByTimeAsync(2100);
    await el.updateComplete;
    expect(text(el, '.state')).toBeNull();
    expect(slide(el)!.disabled).toBe(false);
  });

  it('cannot be slid while it does not answer', async () => {
    const h = makeHass({ entities: [{ entity_id: 'cover.portao', state: 'unavailable' }] });
    const el = await mount(h, gate);
    expect(text(el, '.state')).toBe('Sem resposta');
    expect(slide(el)!.disabled).toBe(true);
  });
});
