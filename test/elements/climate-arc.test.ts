import { afterEach, describe, expect, it } from 'vitest';
import '../../src/elements/climate-arc';
import type { HubbClimateArc } from '../../src/elements/climate-arc';

// The arc of the sheet of an air conditioner: drag it like the card of Home Assistant, one command when
// the finger lets go, nothing when the system takes the touch away.

type Change = { value: number; source: 'pointer' | 'key' };

async function arc(props: Partial<HubbClimateArc> = {}): Promise<{ el: HubbClimateArc; inputs: number[]; changes: Change[] }> {
  const el = document.createElement('hubb-climate-arc') as HubbClimateArc;
  Object.assign(el, { value: 23, min: 16, max: 30, step: 1, current: 27, color: 'var(--hubb-mode-cool)', label: 'Resfriando', disabled: false, ...props });
  const inputs: number[] = [];
  const changes: Change[] = [];
  el.addEventListener('hubb-arc-input', (e) => inputs.push((e as CustomEvent<{ value: number }>).detail.value));
  el.addEventListener('hubb-arc-change', (e) => changes.push((e as CustomEvent<Change>).detail));
  document.body.appendChild(el);
  await el.updateComplete;
  const svg = el.shadowRoot!.querySelector('svg');
  // happy-dom lays nothing out: the drawing is 260 by 230 at the top left of the page.
  if (svg) svg.getBoundingClientRect = () => ({ left: 0, top: 0, width: 260, height: 230, right: 260, bottom: 230, x: 0, y: 0, toJSON: () => ({}) });
  return { el, inputs, changes };
}

const at = (deg: number): { clientX: number; clientY: number } => ({
  clientX: 130 + 105 * Math.cos((deg * Math.PI) / 180),
  clientY: 130 + 105 * Math.sin((deg * Math.PI) / 180),
});

function pointer(el: HubbClimateArc, type: string, deg: number): void {
  el.shadowRoot!.querySelector('svg')!.dispatchEvent(new PointerEvent(type, { ...at(deg), pointerId: 1, bubbles: true, composed: true }));
}

const shown = (el: HubbClimateArc): string | null => el.shadowRoot!.querySelector('.target')?.textContent?.trim() ?? null;

describe('the arc of an air conditioner', () => {
  afterEach(() => document.body.replaceChildren());

  it('follows the finger and sends one change when it lets go', async () => {
    const { el, inputs, changes } = await arc();
    pointer(el, 'pointerdown', 270);
    pointer(el, 'pointermove', 300);
    await el.updateComplete;
    expect(shown(el)).toBe('25°');
    expect(inputs.at(-1)).toBe(25);
    expect(changes).toEqual([]);
    pointer(el, 'pointerup', 300);
    expect(changes).toEqual([{ value: 25, source: 'pointer' }]);
  });

  it('a touch the system takes away sends nothing and goes back to the target of the device', async () => {
    const { el, changes } = await arc();
    pointer(el, 'pointerdown', 270);
    pointer(el, 'pointermove', 330);
    pointer(el, 'pointercancel', 330);
    await el.updateComplete;
    expect(changes).toEqual([]);
    expect(shown(el)).toBe('23°');
  });

  it('a new state of Home Assistant during the drag does not pull the knob from under the finger', async () => {
    const { el } = await arc();
    pointer(el, 'pointerdown', 270);
    pointer(el, 'pointermove', 300);
    el.value = 20;
    await el.updateComplete;
    expect(shown(el)).toBe('25°');
    pointer(el, 'pointerup', 300);
    el.value = 25;
    await el.updateComplete;
    expect(shown(el)).toBe('25°');
    el.value = 20;
    await el.updateComplete;
    expect(shown(el)).toBe('20°');
  });

  it('a tap in the middle, on the number, moves nothing', async () => {
    const { el, changes } = await arc();
    el.shadowRoot!.querySelector('svg')!.dispatchEvent(new PointerEvent('pointerdown', { clientX: 130, clientY: 130, pointerId: 1, bubbles: true }));
    el.shadowRoot!.querySelector('svg')!.dispatchEvent(new PointerEvent('pointerup', { clientX: 130, clientY: 130, pointerId: 1, bubbles: true }));
    expect(changes).toEqual([]);
  });

  it('is a slider for the keyboard and for readers', async () => {
    const { el, changes } = await arc();
    const knob = el.shadowRoot!.querySelector('.knob') as HTMLElement;
    expect(knob.getAttribute('role')).toBe('slider');
    expect(knob.getAttribute('aria-valuemin')).toBe('16');
    expect(knob.getAttribute('aria-valuemax')).toBe('30');
    expect(knob.getAttribute('aria-valuetext')).toBe('23 graus');
    const key = (k: string) => knob.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));
    key('ArrowUp');
    key('ArrowRight');
    await el.updateComplete;
    expect(shown(el)).toBe('25°');
    key('ArrowDown');
    key('PageDown');
    key('PageUp');
    key('Home');
    key('End');
    expect(changes.map((c) => c.value)).toEqual([24, 25, 24, 19, 24, 16, 30]);
    expect(changes.every((c) => c.source === 'key')).toBe(true);
  });

  it('off, or in a mode with no target: a grey track with no knob, and nothing to drag', async () => {
    const { el, inputs, changes } = await arc({ value: null, label: 'Desligado' });
    expect(el.shadowRoot!.querySelector('.knob')).toBeNull();
    expect(el.shadowRoot!.querySelector('.active')).toBeNull();
    expect(shown(el)).toBeNull();
    expect(el.shadowRoot!.querySelector('.state')!.textContent!.trim()).toBe('Desligado');
    pointer(el, 'pointerdown', 270);
    pointer(el, 'pointerup', 270);
    expect(inputs).toEqual([]);
    expect(changes).toEqual([]);
  });

  it('shows the temperature now, as words and as a dot, only when the device tells it and it fits the arc', async () => {
    let { el } = await arc();
    expect(el.shadowRoot!.querySelector('.now')!.textContent!.trim()).toBe('Agora 27°');
    expect(el.shadowRoot!.querySelector('.now-dot')).not.toBeNull();
    el.remove();
    ({ el } = await arc({ current: 40 }));
    expect(el.shadowRoot!.querySelector('.now-dot')).toBeNull();
    el.remove();
    ({ el } = await arc({ current: null }));
    expect(el.shadowRoot!.querySelector('.now')).toBeNull();
  });

  it('keeps the page and the sheet still while the finger is on it', async () => {
    const { el } = await arc();
    const css = ([] as unknown[])
      .concat((customElements.get('hubb-climate-arc') as unknown as { styles: unknown }).styles)
      .map((s) => (s as { cssText: string }).cssText)
      .join('\n');
    expect(css).toMatch(/svg\s*\{[^}]*touch-action: none/);
    let reached = 0;
    document.body.addEventListener('pointerdown', () => reached++);
    pointer(el, 'pointerdown', 270);
    expect(reached).toBe(0);
  });
});
