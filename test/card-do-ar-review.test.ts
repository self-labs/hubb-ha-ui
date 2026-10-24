import { afterEach, describe, expect, it, vi } from 'vitest';
import '../src/elements/climate-arc';
import '../src/elements/climate-card';
import '../src/elements/climate-panel';
import type { HubbClimateArc } from '../src/elements/climate-arc';
import type { HubbClimateCard } from '../src/elements/climate-card';
import type { HubbClimatePanel } from '../src/elements/climate-panel';
import { reportArea, resetLayoutForTests } from '../src/layout';
import { makeHass, withState, type FakeHass } from './helpers/fake-hass';

// The final review of the card do ar (22/10): what a resident would meet that the tasks did not pin.

const FEATURES = 1 | 8 | 32 | 128 | 256;

function ar(state: string, attrs: Record<string, unknown> = {}): FakeHass {
  return makeHass({
    entities: [
      {
        entity_id: 'climate.ar',
        name: 'Ar',
        state,
        attributes: {
          hvac_modes: ['off', 'cool', 'fan_only'],
          temperature: 23,
          current_temperature: 27,
          min_temp: 16,
          max_temp: 30,
          fan_modes: ['auto', 'low', 'high'],
          fan_mode: 'auto',
          supported_features: FEATURES,
          ...attrs,
        },
      },
    ],
  });
}

async function sheet(h: FakeHass): Promise<HubbClimatePanel> {
  const el = document.createElement('hubb-climate-panel') as HubbClimatePanel;
  el.hass = h;
  el.entityId = 'climate.ar';
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}

async function card(h: FakeHass): Promise<HubbClimateCard> {
  const el = document.createElement('hubb-climate-card') as HubbClimateCard;
  el.hass = h;
  el.item = { entityId: 'climate.ar', name: 'Ar', kind: 'climate' };
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}

async function arc(props: Partial<HubbClimateArc> = {}): Promise<{ el: HubbClimateArc; changes: { value: number; source: string }[] }> {
  const el = document.createElement('hubb-climate-arc') as HubbClimateArc;
  Object.assign(el, { value: 23, min: 16, max: 30, step: 1, current: 27, color: 'var(--hubb-mode-cool)', label: 'Resfriando', ...props });
  const changes: { value: number; source: string }[] = [];
  el.addEventListener('hubb-arc-change', (e) => changes.push((e as CustomEvent<{ value: number; source: string }>).detail));
  document.body.appendChild(el);
  await el.updateComplete;
  el.shadowRoot!.querySelector('svg')!.getBoundingClientRect = () => ({ left: 0, top: 0, width: 260, height: 230, right: 260, bottom: 230, x: 0, y: 0, toJSON: () => ({}) });
  return { el, changes };
}

const at = (deg: number, r = 105) => ({ clientX: 130 + r * Math.cos((deg * Math.PI) / 180), clientY: 130 + r * Math.sin((deg * Math.PI) / 180) });
const pointer = (el: HubbClimateArc, type: string, deg: number, r = 105): void => {
  el.shadowRoot!.querySelector('svg')!.dispatchEvent(new PointerEvent(type, { ...at(deg, r), pointerId: 1, bubbles: true, composed: true }));
};
const temps = (h: FakeHass) => h.calls.filter((c) => c.service === 'set_temperature').map((c) => c.data);
const q = (el: Element, sel: string) => el.shadowRoot!.querySelector(sel);
const arcOf = async (el: HubbClimatePanel): Promise<HubbClimateArc> => {
  const a = q(el, 'hubb-climate-arc') as HubbClimateArc;
  await a.updateComplete;
  return a;
};

describe('what the air conditioner says it is doing', () => {
  afterEach(() => document.body.replaceChildren());

  it('at its target (idle) it says Em espera on the arc and on the card, as the home does', async () => {
    const h = ar('cool', { hvac_action: 'idle' });
    expect((await arcOf(await sheet(h))).label).toBe('Em espera');
    const c = await card(h);
    expect(q(c, '.state')!.textContent!.trim()).toBe('Em espera · 27° agora');
  });

  it('an infrared one before its first command says nothing in English', async () => {
    expect((await arcOf(await sheet(ar('unknown')))).label).toBe('');
  });
});

describe('the arc of the sheet', () => {
  afterEach(() => document.body.replaceChildren());

  it('letting go after the device went off (or to Ventilar) mid-drag sends nothing', async () => {
    const { el, changes } = await arc();
    pointer(el, 'pointerdown', 270);
    pointer(el, 'pointermove', 300);
    el.value = null;
    await el.updateComplete;
    pointer(el, 'pointermove', 320);
    pointer(el, 'pointerup', 320);
    expect(changes).toEqual([]);
  });

  it('the sheet sends no target from the arc to a device with none to set', async () => {
    const h = ar('fan_only', { temperature: null });
    const el = await sheet(h);
    (await arcOf(el)).dispatchEvent(new CustomEvent('hubb-arc-change', { detail: { value: 25, source: 'pointer' }, bubbles: true, composed: true }));
    expect(temps(h)).toEqual([]);
  });

  it('the keys never move the target up when going down, below the lowest the device allows', async () => {
    const { el, changes } = await arc({ value: 17, min: 18, max: 30 });
    const knob = el.shadowRoot!.querySelector('.knob')!;
    expect(knob.getAttribute('aria-valuenow')).toBe('18');
    knob.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    knob.dispatchEvent(new KeyboardEvent('keydown', { key: 'PageDown', bubbles: true }));
    expect(changes).toEqual([]);
  });

  it('a finger that slips past the highest end into the gap at the bottom holds the highest end', async () => {
    const { el, changes } = await arc();
    pointer(el, 'pointerdown', 400);
    pointer(el, 'pointermove', 60);
    pointer(el, 'pointermove', 95);
    pointer(el, 'pointerup', 95);
    expect(changes).toEqual([{ value: 30, source: 'pointer' }]);
  });

  it('a tap on the target it already has sends nothing', async () => {
    const { el, changes } = await arc();
    pointer(el, 'pointerdown', 270);
    pointer(el, 'pointerup', 270);
    expect(changes).toEqual([]);
  });

  it('the middle of the dial lets the sheet scroll; only the ring takes the finger', () => {
    const css = (customElements.get('hubb-climate-arc') as unknown as { styles: { cssText: string } }).styles.cssText;
    expect(css).toMatch(/\.pan\s*\{[^}]*touch-action: pan-y/);
  });

  it('grows in the window of the tablet lying down', async () => {
    reportArea({ left: 0, top: 0, width: 1280, height: 800 }, 800);
    try {
      const el = await sheet(ar('cool'));
      expect(el.getAttribute('screen-layout')).toBe('wide');
    } finally {
      resetLayoutForTests();
    }
  });
});

describe('the card swaps the power button and − 23° + under a finger', () => {
  afterEach(() => {
    vi.useRealTimers();
    document.body.replaceChildren();
  });

  it('a second tap on Ligar right as it turns on does not raise the target', async () => {
    vi.useFakeTimers();
    const off = ar('off');
    const el = await card(off);
    (q(el, '.power') as HTMLButtonElement).click();
    el.hass = withState(off, 'climate.ar', 'cool');
    await el.updateComplete;
    (q(el, '.warmer') as HTMLButtonElement).click();
    vi.advanceTimersByTime(800);
    expect(temps(off)).toEqual([]);
    vi.advanceTimersByTime(1000);
    (q(el, '.warmer') as HTMLButtonElement).click();
    vi.advanceTimersByTime(800);
    expect(temps(off)).toEqual([{ temperature: 24 }]);
  });

  it('a tap on + right as it goes off elsewhere does not turn it back on', async () => {
    vi.useFakeTimers();
    const on = ar('cool');
    const el = await card(on);
    el.hass = withState(on, 'climate.ar', 'off');
    await el.updateComplete;
    (q(el, '.power') as HTMLButtonElement).click();
    expect(on.calls).toEqual([]);
  });
});

describe('Mais ajustes and the power of the sheet', () => {
  afterEach(() => {
    vi.useRealTimers();
    document.body.replaceChildren();
  });

  it('a value the device did not take goes back in the list, so it can be picked again', async () => {
    const h = ar('cool');
    const el = await sheet(h);
    const fan = q(el, 'select.fan') as HTMLSelectElement;
    fan.value = 'high';
    fan.dispatchEvent(new Event('change'));
    el.hass = withState(h, 'climate.ar', 'cool');
    await el.updateComplete;
    expect(fan.value).toBe('auto');
  });

  it('turning it off from the sheet drops a target not sent yet', async () => {
    vi.useFakeTimers();
    const h = ar('cool');
    const el = await sheet(h);
    (q(el, '.warmer') as HTMLButtonElement).click();
    (q(el, '.power') as HTMLButtonElement).click();
    vi.advanceTimersByTime(800);
    expect(temps(h)).toEqual([]);
    expect(h.calls.map((c) => c.service)).toEqual(['turn_off']);
  });
});

describe('the colour of the mode, proposal A (Gustavo, 23/10): a tint of the mode on the dark surface', () => {
  afterEach(() => document.body.replaceChildren());
  const cssOf = (tag: string): string => (customElements.get(tag) as unknown as { styles: { cssText: string } }).styles.cssText;

  it('the card on: the surface with a tint of the mode, the icon and its words in the ink of the mode, no amber', async () => {
    const el = await card(ar('heat'));
    const style = (q(el, '.card') as HTMLElement).style;
    expect(style.getPropertyValue('--mode')).toBe('var(--hubb-mode-heat)');
    expect(style.getPropertyValue('--mode-ink')).toBe('var(--hubb-mode-heat-ink)');
    const css = cssOf('hubb-climate-card');
    expect(css).toMatch(/\.card\.on\s*\{[^}]*color-mix\(in srgb, var\(--mode\) 20%, transparent\)[^}]*var\(--hubb-surface\)/);
    expect(css).toMatch(/\.card\.on \.icon\s*\{[^}]*background: color-mix\(in srgb, var\(--mode\) 22%, transparent\);[^}]*color: var\(--mode-ink\)/);
    expect(css).toMatch(/\.card\.on \.power\s*\{[^}]*color: var\(--mode-ink\)/);
    expect(css).not.toMatch(/\.card\.on \.power\s*\{[^}]*--hubb-amber/);
  });

  it('the sheet: the power on and the mode picked in the tint of the mode, no amber', async () => {
    const el = await sheet(ar('cool'));
    const controls = q(el, '.controls') as HTMLElement;
    expect(controls.style.getPropertyValue('--mode')).toBe('var(--hubb-mode-cool)');
    expect(controls.style.getPropertyValue('--mode-ink')).toBe('var(--hubb-mode-cool-ink)');
    const css = cssOf('hubb-climate-panel');
    expect(css).toMatch(/\.power\.on\s*\{[^}]*background: color-mix\(in srgb, var\(--mode\) 24%, transparent\);[^}]*color: var\(--mode-ink\)/);
    expect(css).toMatch(/\.mode\.current \.mode-icon\s*\{[^}]*background: color-mix\(in srgb, var\(--mode\) 24%, transparent\);[^}]*color: var\(--mode-ink\)/);
    const picked = q(el, 'button.mode.current') as HTMLElement;
    expect(picked.style.getPropertyValue('--mode-ink')).toBe('var(--hubb-mode-cool-ink)');
  });
});

describe('a target the air conditioner did not take (Gustavo, 23/10)', () => {
  afterEach(() => {
    vi.useRealTimers();
    document.body.replaceChildren();
  });

  it('the sheet says so in one line, which goes with the next tap or when it shows up after all', async () => {
    vi.useFakeTimers();
    const h = ar('auto', { temperature: 17, min_temp: 18 });
    const el = await sheet(h);
    for (let i = 0; i < 4; i++) (q(el, '.warmer') as HTMLButtonElement).click();
    vi.advanceTimersByTime(800);
    await vi.advanceTimersByTimeAsync(6000);
    await el.updateComplete;
    expect(q(el, '.not-taken')!.textContent!.trim()).toBe('O ar não aceitou 21°.');
    expect(q(el, '.not-taken')!.getAttribute('role')).toBe('alert');
    (q(el, '.warmer') as HTMLButtonElement).click();
    await el.updateComplete;
    expect(q(el, '.not-taken')).toBeNull();
  });

  it('a late one that shows up clears the line', async () => {
    vi.useFakeTimers();
    const h = ar('cool');
    const el = await sheet(h);
    (q(el, '.warmer') as HTMLButtonElement).click();
    vi.advanceTimersByTime(800);
    await vi.advanceTimersByTimeAsync(6000);
    await el.updateComplete;
    expect(q(el, '.not-taken')).not.toBeNull();
    el.hass = withState(h, 'climate.ar', 'cool', { ...h.states['climate.ar']!.attributes, temperature: 24 });
    await el.updateComplete;
    expect(q(el, '.not-taken')).toBeNull();
  });

  it('the card shakes, as for a refusal', async () => {
    vi.useFakeTimers();
    const h = ar('cool');
    const el = await card(h);
    (q(el, '.warmer') as HTMLButtonElement).click();
    vi.advanceTimersByTime(800);
    await vi.advanceTimersByTimeAsync(6000);
    await el.updateComplete;
    expect(q(el, '.card')!.classList.contains('refused')).toBe(true);
  });
});
