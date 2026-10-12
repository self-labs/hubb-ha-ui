import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '../../src/elements/light-tile';
import { HubbLightTile } from '../../src/elements/light-tile';
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
const cssOf = (styles: unknown): string =>
  ([] as unknown[]).concat(styles).map((s) => (s as { cssText: string }).cssText).join('\n');

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
    // The old "off" does not count as an answer to the second tap: it waits for a new state.
    expect(status(el)).toBe('Apagando…');
    el.hass = withState(withState(hass, 'light.sofa', 'on'), 'light.sofa', 'off');
    await el.updateComplete;
    expect(status(el)).toBe('Apagada');
    vi.advanceTimersByTime(8000);
    await el.updateComplete;
    expect(status(el)).toBe('Apagada');
  });

  it('a second tap does not pass for done when only the first command arrives', async () => {
    const hass = makeHass({ entities: [{ entity_id: 'light.sofa', state: 'on' }] });
    const el = await mount(hass);
    button(el).click();
    button(el).click();
    await el.updateComplete;
    expect(status(el)).toBe('Acendendo…');
    el.hass = withState(hass, 'light.sofa', 'off');
    await el.updateComplete;
    expect(status(el)).toBe('Acendendo…');
    vi.advanceTimersByTime(3100);
    await el.updateComplete;
    expect(status(el)).toBe('Sem resposta');
  });

  it('keeps counting while it was out of the page, and says Sem resposta when it comes back', async () => {
    const hass = makeHass({ entities: [{ entity_id: 'light.sofa', state: 'on' }] });
    const el = await mount(hass);
    button(el).click();
    await el.updateComplete;
    el.remove();
    document.body.appendChild(el);
    vi.advanceTimersByTime(3100);
    await el.updateComplete;
    expect(status(el)).toBe('Sem resposta');
  });

  it('does not vibrate for an old tap when it comes back to the page much later', async () => {
    const hass = makeHass({ entities: [{ entity_id: 'light.sofa', state: 'on' }] });
    const el = await mount(hass);
    button(el).click();
    await el.updateComplete;
    el.remove();
    vi.advanceTimersByTime(60000);
    const seen: string[] = [];
    const listener = (e: Event) => seen.push((e as CustomEvent<string>).detail);
    window.addEventListener('haptic', listener);
    document.body.appendChild(el);
    await el.updateComplete;
    window.removeEventListener('haptic', listener);
    expect(seen).toEqual([]);
    expect(status(el)).toBe('Acesa');
  });

  it('after a finger tap, Shift+F10 from a keyboard does not swallow the next Enter', async () => {
    const hass = makeHass({ entities: [{ entity_id: 'light.mesa', state: 'on', attributes: { brightness: 128 } }] });
    const el = await mount(hass, { entityId: 'light.mesa', name: 'Mesa', dimmable: true });
    button(el).dispatchEvent(Object.assign(new Event('pointerdown'), { pointerType: 'touch', button: 0 }));
    button(el).dispatchEvent(new Event('pointerup'));
    button(el).dispatchEvent(new KeyboardEvent('keydown', { key: 'F10', shiftKey: true, bubbles: true }));
    button(el).dispatchEvent(new Event('contextmenu', { bubbles: true, cancelable: true }));
    button(el).click();
    expect(hass.calls.map((c) => c.service)).toEqual(['turn_off']);
  });

  it('opens the dimmer from the context menu too (right click, Shift+F10), and the next click still toggles', async () => {
    const hass = makeHass({ entities: [{ entity_id: 'light.mesa', state: 'on', attributes: { brightness: 128 } }] });
    const el = await mount(hass, { entityId: 'light.mesa', name: 'Mesa', dimmable: true });
    const asked: unknown[] = [];
    const listener = (e: Event) => asked.push((e as CustomEvent).detail);
    document.body.addEventListener('hubb-open-dimmer', listener);
    const menu = new Event('contextmenu', { bubbles: true, cancelable: true });
    button(el).dispatchEvent(menu);
    document.body.removeEventListener('hubb-open-dimmer', listener);
    expect(asked).toEqual([{ entityId: 'light.mesa', name: 'Mesa' }]);
    expect(menu.defaultPrevented).toBe(true);
    expect(hass.calls).toEqual([]);
    button(el).click();
    expect(hass.calls.map((c) => c.service)).toEqual(['turn_off']);
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

  it('paints the icon with the colour of a colour light that is on', async () => {
    const el = await mount(
      makeHass({
        entities: [
          { entity_id: 'light.fita', state: 'on', attributes: { supported_color_modes: ['hs'], color_mode: 'hs', rgb_color: [255, 0, 0], brightness: 255 } },
        ],
      }),
      { entityId: 'light.fita', name: 'Fita', dimmable: true },
    );
    expect(button(el).classList.contains('colored')).toBe(true);
    expect(button(el).getAttribute('style')).toContain('--tile-color:rgb(255, 0, 0)');
    expect(button(el).getAttribute('style')).toContain('--tile-ink:#ffffff');
    expect(cssOf(HubbLightTile.styles)).toMatch(/\.tile\.on\.colored \.icon\s*\{[^}]*background: var\(--tile-color\)/);
  });

  it('keeps the amber icon for a white light, and drops any colour once it is off', async () => {
    const hass = makeHass({
      entities: [
        {
          entity_id: 'light.fita',
          state: 'on',
          attributes: { supported_color_modes: ['color_temp', 'hs'], color_mode: 'color_temp', color_temp_kelvin: 2700, rgb_color: [255, 167, 87] },
        },
      ],
    });
    const el = await mount(hass, { entityId: 'light.fita', name: 'Fita', dimmable: true });
    expect(button(el).classList.contains('colored')).toBe(false);
    el.hass = withState(hass, 'light.fita', 'off', { supported_color_modes: ['hs'], color_mode: 'hs', rgb_color: [255, 0, 0] });
    await el.updateComplete;
    expect(button(el).classList.contains('colored')).toBe(false);
  });
});
