import { afterEach, describe, expect, it, vi } from 'vitest';
import '../../src/elements/dimmer-panel';
import { pctFromPointer, type HubbDimmerPanel } from '../../src/elements/dimmer-panel';
import { makeHass, withState, type FakeHass } from '../helpers/fake-hass';

async function mount(hass: FakeHass): Promise<HubbDimmerPanel> {
  const el = document.createElement('hubb-dimmer-panel') as HubbDimmerPanel;
  el.hass = hass;
  el.entityId = 'light.mesa';
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}
const presets = (el: HubbDimmerPanel) => [...el.shadowRoot!.querySelectorAll<HTMLButtonElement>('.presets button')];

describe('pctFromPointer', () => {
  it('maps the top of the column to 100 and the bottom to 0, clamped', () => {
    expect(pctFromPointer(0, 0, 200)).toBe(100);
    expect(pctFromPointer(200, 0, 200)).toBe(0);
    expect(pctFromPointer(100, 0, 200)).toBe(50);
    expect(pctFromPointer(-30, 0, 200)).toBe(100);
    expect(pctFromPointer(260, 0, 200)).toBe(0);
    expect(pctFromPointer(10, 0, 0)).toBe(0);
  });
});

describe('hubb-dimmer-panel', () => {
  afterEach(() => { document.body.replaceChildren(); });

  it('offers 25, 50, 75 and 100, and highlights only an exact match', async () => {
    const at75 = await mount(makeHass({ entities: [{ entity_id: 'light.mesa', state: 'on', attributes: { brightness: 191 } }] }));
    expect(presets(at75).map((b) => b.textContent)).toEqual(['25', '50', '75', '100']);
    expect(presets(at75).map((b) => b.classList.contains('cur'))).toEqual([false, false, true, false]);
    document.body.replaceChildren();
    const at60 = await mount(makeHass({ entities: [{ entity_id: 'light.mesa', state: 'on', attributes: { brightness: 153 } }] }));
    expect(at60.shadowRoot!.querySelector('.pct')!.textContent).toBe('60%');
    expect(presets(at60).some((b) => b.classList.contains('cur'))).toBe(false);
  });

  it('shows 0% for a light that is off', async () => {
    const el = await mount(makeHass({ entities: [{ entity_id: 'light.mesa', state: 'off' }] }));
    expect(el.shadowRoot!.querySelector('.pct')!.textContent).toBe('0%');
  });

  it('sets the brightness from a preset', async () => {
    const hass = makeHass({ entities: [{ entity_id: 'light.mesa', state: 'off' }] });
    const el = await mount(hass);
    presets(el)[2]!.click();
    expect(hass.calls).toEqual([{ domain: 'light', service: 'turn_on', data: { brightness_pct: 75 }, target: { entity_id: 'light.mesa' } }]);
  });

  it('keeps showing the released value until Home Assistant confirms it, and gives up after 3 s', async () => {
    vi.useFakeTimers();
    try {
      const hass = makeHass({ entities: [{ entity_id: 'light.mesa', state: 'on', attributes: { brightness: 77 } }] });
      const el = await mount(hass);
      const pct = () => el.shadowRoot!.querySelector('.pct')!.textContent;
      expect(pct()).toBe('30%');
      presets(el)[2]!.click();
      await el.updateComplete;
      expect(pct()).toBe('75%');
      expect(presets(el)[2]!.classList.contains('cur')).toBe(true);
      el.hass = withState(hass, 'light.mesa', 'on', { brightness: 191 });
      await el.updateComplete;
      expect(pct()).toBe('75%');
      presets(el)[1]!.click();
      await el.updateComplete;
      expect(pct()).toBe('50%');
      vi.advanceTimersByTime(3100);
      await el.updateComplete;
      expect(pct()).toBe('75%');
    } finally {
      vi.useRealTimers();
    }
  });

  it('follows a drag on the column and applies on release; dragging to the bottom turns off', async () => {
    const hass = makeHass({ entities: [{ entity_id: 'light.mesa', state: 'on', attributes: { brightness: 255 } }] });
    const el = await mount(hass);
    const column = el.shadowRoot!.querySelector('.column') as HTMLElement;
    column.getBoundingClientRect = () => ({ top: 0, height: 200, left: 0, width: 80, right: 80, bottom: 200, x: 0, y: 0, toJSON: () => ({}) });
    column.dispatchEvent(new MouseEvent('pointerdown', { clientY: 50 }));
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.pct')!.textContent).toBe('75%');
    column.dispatchEvent(new MouseEvent('pointerup', { clientY: 50 }));
    column.dispatchEvent(new MouseEvent('pointerdown', { clientY: 200 }));
    column.dispatchEvent(new MouseEvent('pointerup', { clientY: 200 }));
    expect(hass.calls.map((c) => [c.service, c.data])).toEqual([
      ['turn_on', { brightness_pct: 75 }],
      ['turn_off', undefined],
    ]);
  });

  it('makes room for the colour controls with a shorter column', async () => {
    const color = await mount(makeHass({ entities: [{ entity_id: 'light.mesa', state: 'on', attributes: { supported_color_modes: ['hs'], brightness: 128 } }] }));
    expect(color.shadowRoot!.querySelector('.column')!.classList.contains('compact')).toBe(true);
    document.body.replaceChildren();
    const plain = await mount(makeHass({ entities: [{ entity_id: 'light.mesa', state: 'on', attributes: { supported_color_modes: ['brightness'], brightness: 128 } }] }));
    expect(plain.shadowRoot!.querySelector('.column')!.classList.contains('compact')).toBe(false);
  });

  it('works from the keyboard: arrows step 5, Home turns off, End goes to 100', async () => {
    vi.useFakeTimers();
    try {
      const hass = makeHass({ entities: [{ entity_id: 'light.mesa', state: 'on', attributes: { brightness: 153 } }] });
      const el = await mount(hass);
      const column = el.shadowRoot!.querySelector('.column') as HTMLElement;
      expect(column.getAttribute('tabindex')).toBe('0');
      const press = (key: string) => column.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
      // A held arrow repeats about 30 times a second: the column follows at once, one call goes out.
      press('ArrowUp');
      press('ArrowUp');
      press('ArrowUp');
      await el.updateComplete;
      expect(el.shadowRoot!.querySelector('.pct')!.textContent).toBe('75%');
      expect(hass.calls).toEqual([]);
      vi.advanceTimersByTime(300);
      press('End');
      vi.advanceTimersByTime(300);
      press('Home');
      press('a');
      vi.advanceTimersByTime(300);
      expect(hass.calls.map((c) => [c.service, c.data])).toEqual([
        ['turn_on', { brightness_pct: 75 }],
        ['turn_on', { brightness_pct: 100 }],
        ['turn_off', undefined],
      ]);
    } finally {
      vi.useRealTimers();
    }
  });
});
