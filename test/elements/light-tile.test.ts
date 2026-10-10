import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '../../src/elements/light-tile';
import type { HubbLightTile } from '../../src/elements/light-tile';
import type { LightItem } from '../../src/model/types';
import { makeHass, withState, type FakeHass } from '../helpers/fake-hass';

const SOFA: LightItem = { entityId: 'light.sofa', name: 'Sofá', dimmable: false };

async function mount(hass: FakeHass, item: LightItem = SOFA): Promise<HubbLightTile> {
  const el = document.createElement('hubb-light-tile') as HubbLightTile;
  el.hass = hass;
  el.item = item;
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}
const button = (el: HubbLightTile) => el.shadowRoot!.querySelector('button')!;
const status = (el: HubbLightTile) => el.shadowRoot!.querySelector('.state')!.textContent;

describe('hubb-light-tile', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    document.body.replaceChildren();
  });

  it('shows an on light as Acesa and pressed', async () => {
    const el = await mount(makeHass({ entities: [{ entity_id: 'light.sofa', state: 'on' }] }));
    expect(status(el)).toBe('Acesa');
    expect(button(el).classList.contains('on')).toBe(true);
    expect(button(el).getAttribute('aria-pressed')).toBe('true');
    expect(el.shadowRoot!.querySelector('.name')!.textContent).toBe('Sofá');
  });

  it('turns an on light off on tap, shows Apagando while waiting, then follows the confirmed state', async () => {
    const hass = makeHass({ entities: [{ entity_id: 'light.sofa', state: 'on' }] });
    const el = await mount(hass);
    button(el).click();
    await el.updateComplete;
    expect(hass.calls).toEqual([{ domain: 'light', service: 'turn_off', data: undefined, target: { entity_id: 'light.sofa' } }]);
    expect(status(el)).toBe('Apagando…');
    el.hass = withState(hass, 'light.sofa', 'off');
    await el.updateComplete;
    expect(status(el)).toBe('Apagada');
  });

  it('goes back to the real state and says Sem resposta when nothing confirms in 3 s', async () => {
    const hass = makeHass({ entities: [{ entity_id: 'light.sofa', state: 'on' }] });
    const el = await mount(hass);
    button(el).click();
    vi.advanceTimersByTime(3100);
    await el.updateComplete;
    expect(status(el)).toBe('Sem resposta');
    expect(button(el).classList.contains('on')).toBe(true);
    vi.advanceTimersByTime(4100);
    await el.updateComplete;
    expect(status(el)).toBe('Acesa');
  });

  it('a second tap while waiting sends the opposite command and does not get stuck', async () => {
    const hass = makeHass({ entities: [{ entity_id: 'light.sofa', state: 'off' }] });
    const el = await mount(hass);
    button(el).click();
    await el.updateComplete;
    expect(status(el)).toBe('Acendendo…');
    button(el).click();
    await el.updateComplete;
    expect(hass.calls.map((c) => c.service)).toEqual(['turn_on', 'turn_off']);
    expect(status(el)).toBe('Apagada');
    vi.advanceTimersByTime(8000);
    await el.updateComplete;
    expect(status(el)).toBe('Apagada');
  });

  it('shows the brightness of a dimmable light', async () => {
    const el = await mount(
      makeHass({ entities: [{ entity_id: 'light.mesa', state: 'on', attributes: { brightness: 153 } }] }),
      { entityId: 'light.mesa', name: 'Mesa', dimmable: true },
    );
    expect(status(el)).toBe('60%');
    expect((el.shadowRoot!.querySelector('.level') as HTMLElement).style.width).toBe('60%');
  });

  it('says Sem resposta for an unavailable light and sends nothing on tap', async () => {
    const hass = makeHass({ entities: [{ entity_id: 'light.sofa', state: 'unavailable' }] });
    const el = await mount(hass);
    expect(status(el)).toBe('Sem resposta');
    expect(button(el).classList.contains('na')).toBe(true);
    button(el).click();
    expect(hass.calls).toEqual([]);
  });

  it('explains since when on a tap of an unavailable light, for a few seconds', async () => {
    const since = new Date(2026, 9, 9, 14, 32, 0).toISOString();
    const hass = makeHass({ entities: [{ entity_id: 'light.sofa', state: 'unavailable', last_changed: since }] });
    const el = await mount(hass);
    button(el).click();
    await el.updateComplete;
    expect(status(el)).toBe('Sem resposta desde 14:32');
    expect(hass.calls).toEqual([]);
    vi.advanceTimersByTime(4100);
    await el.updateComplete;
    expect(status(el)).toBe('Sem resposta');
  });

  it('vibrates as a failure when nothing confirms, and as a success when it does', async () => {
    const seen: string[] = [];
    const listener = (e: Event) => seen.push((e as CustomEvent<string>).detail);
    window.addEventListener('haptic', listener);
    try {
      const lost = await mount(makeHass({ entities: [{ entity_id: 'light.sofa', state: 'off' }] }));
      button(lost).click();
      await lost.updateComplete;
      vi.advanceTimersByTime(3100);
      await lost.updateComplete;
      expect(seen).toEqual(['light', 'failure']);
      document.body.replaceChildren();
      seen.length = 0;
      const hass = makeHass({ entities: [{ entity_id: 'light.sofa', state: 'off' }] });
      const ok = await mount(hass);
      button(ok).click();
      await ok.updateComplete;
      ok.hass = withState(hass, 'light.sofa', 'on');
      await ok.updateComplete;
      expect(seen).toEqual(['light', 'success']);
    } finally {
      window.removeEventListener('haptic', listener);
    }
  });

  it('says Sem resposta when the entity no longer exists, without throwing', async () => {
    const el = await mount(makeHass());
    expect(status(el)).toBe('Sem resposta');
  });

  it('asks for the dimmer on a long press of a dimmable light, and does not toggle', async () => {
    const hass = makeHass({ entities: [{ entity_id: 'light.mesa', state: 'on', attributes: { brightness: 153 } }] });
    const el = await mount(hass, { entityId: 'light.mesa', name: 'Mesa', dimmable: true });
    const asked: Array<{ entityId: string; name: string }> = [];
    document.body.addEventListener('hubb-open-dimmer', (e) => asked.push((e as CustomEvent).detail));
    button(el).dispatchEvent(new Event('pointerdown'));
    vi.advanceTimersByTime(600);
    button(el).dispatchEvent(new Event('pointerup'));
    button(el).click();
    expect(asked).toEqual([{ entityId: 'light.mesa', name: 'Mesa' }]);
    expect(hass.calls).toEqual([]);
  });

  it('a slow press on a light that cannot dim still toggles it', async () => {
    const hass = makeHass({ entities: [{ entity_id: 'light.sofa', state: 'off' }] });
    const el = await mount(hass);
    button(el).dispatchEvent(new Event('pointerdown'));
    vi.advanceTimersByTime(800);
    button(el).dispatchEvent(new Event('pointerup'));
    button(el).click();
    expect(hass.calls.map((c) => c.service)).toEqual(['turn_on']);
  });

  it('vibrates lightly on tap', async () => {
    const seen: string[] = [];
    const listener = (e: Event) => seen.push((e as CustomEvent<string>).detail);
    window.addEventListener('haptic', listener);
    const el = await mount(makeHass({ entities: [{ entity_id: 'light.sofa', state: 'off' }] }));
    button(el).click();
    window.removeEventListener('haptic', listener);
    expect(seen).toEqual(['light']);
  });
});
