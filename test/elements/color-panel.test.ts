import { afterEach, describe, expect, it, vi } from 'vitest';
import '../../src/elements/color-panel';
import type { HubbColorPanel } from '../../src/elements/color-panel';
import { makeHass, withState, type FakeHass } from '../helpers/fake-hass';

async function mount(hass: FakeHass): Promise<HubbColorPanel> {
  const el = document.createElement('hubb-color-panel') as HubbColorPanel;
  el.hass = hass;
  el.entityId = 'light.fita';
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}
const fita = (attributes: Record<string, unknown>, state = 'on') => makeHass({ entities: [{ entity_id: 'light.fita', state, attributes }] });
const buttons = (el: HubbColorPanel) => [...el.shadowRoot!.querySelectorAll<HTMLButtonElement>('.presets button')];
const labels = (el: HubbColorPanel) => buttons(el).map((b) => b.querySelector('.label')!.textContent);
const named = (el: HubbColorPanel, name: string) => buttons(el).find((b) => b.getAttribute('aria-label') === name)!;
const slider = (el: HubbColorPanel) => el.shadowRoot!.querySelector<HTMLInputElement>('input.kelvin');
const headings = (el: HubbColorPanel) => [...el.shadowRoot!.querySelectorAll('h3')].map((h) => h.textContent!.replace(/\s+/g, ' ').trim());

describe('hubb-color-panel', () => {
  afterEach(() => {
    vi.useRealTimers();
    document.body.replaceChildren();
  });

  it('offers the 9 colours and the white temperature to a light that has both', async () => {
    const el = await mount(fita({ supported_color_modes: ['color_temp', 'hs'], min_color_temp_kelvin: 2700, max_color_temp_kelvin: 6500 }));
    expect(labels(el)).toEqual(['Quente', 'Neutro', 'Frio', 'Âmbar', 'Vermelho', 'Rosa', 'Roxo', 'Azul', 'Verde']);
    expect(buttons(el)[0]!.getAttribute('aria-label')).toBe('Branco quente');
    expect(headings(el)[0]).toBe('Cor');
    expect(slider(el)!.min).toBe('2700');
    expect(slider(el)!.max).toBe('6500');
  });

  it('shows nothing for a light that only dims', async () => {
    const el = await mount(fita({ supported_color_modes: ['brightness'] }));
    expect(el.shadowRoot!.querySelector('.presets')).toBeNull();
    expect(slider(el)).toBeNull();
  });

  it('gives a white-temperature light the three whites and the slider, and no colours', async () => {
    const el = await mount(fita({ supported_color_modes: ['color_temp'] }));
    expect(labels(el)).toEqual(['Quente', 'Neutro', 'Frio']);
    expect(headings(el)).toEqual(['Temperatura do branco']);
    expect(slider(el)).not.toBeNull();
  });

  it('shows a temperature only while the light really is in white mode', async () => {
    const inColour = await mount(fita({ supported_color_modes: ['color_temp', 'hs'], color_mode: 'hs', hs_color: [275, 85] }));
    expect(inColour.shadowRoot!.querySelector('h3 .value')).toBeNull();
    document.body.replaceChildren();
    const inWhite = await mount(fita({ supported_color_modes: ['color_temp', 'hs'], color_mode: 'color_temp', color_temp_kelvin: 3000 }));
    expect(inWhite.shadowRoot!.querySelector('h3 .value')!.textContent).toBe('3000 K');
  });

  it('paints a colour with hue and saturation, and turns the light on if it was off', async () => {
    const hass = fita({ supported_color_modes: ['hs'] }, 'off');
    const el = await mount(hass);
    named(el, 'Vermelho').click();
    expect(hass.calls).toEqual([{ domain: 'light', service: 'turn_on', data: { hs_color: [0, 100] }, target: { entity_id: 'light.fita' } }]);
  });

  it('asks a white in kelvin, inside the range of the light', async () => {
    const hass = fita({ supported_color_modes: ['color_temp'], min_color_temp_kelvin: 2702, max_color_temp_kelvin: 6000 });
    const el = await mount(hass);
    named(el, 'Branco frio').click();
    expect(hass.calls[0]!.data).toEqual({ color_temp_kelvin: 6000 });
  });

  it('offers only the whites a narrow bulb can tell apart, and rings the one it shows', async () => {
    const el = await mount(
      fita({ supported_color_modes: ['color_temp'], min_color_temp_kelvin: 2202, max_color_temp_kelvin: 4000, color_mode: 'color_temp', color_temp_kelvin: 4000 }),
    );
    expect(labels(el)).toEqual(['Quente', 'Neutro']);
    expect(buttons(el).filter((b) => b.classList.contains('cur')).map((b) => b.getAttribute('aria-label'))).toEqual(['Branco neutro']);
  });

  it('uses white mode for a colour light with a white channel and no temperature', async () => {
    const hass = fita({ supported_color_modes: ['hs', 'white'] });
    const el = await mount(hass);
    expect(labels(el)).toHaveLength(7);
    expect(labels(el)[0]).toBe('Branco');
    buttons(el)[0]!.click();
    expect(hass.calls[0]!.data).toEqual({ white: true });
  });

  it('highlights the colour the light shows, and the one just asked until it is confirmed or 3 s pass', async () => {
    vi.useFakeTimers();
    const hass = fita({ supported_color_modes: ['hs'], color_mode: 'hs', hs_color: [0, 100] });
    const el = await mount(hass);
    const cur = () => buttons(el).filter((b) => b.classList.contains('cur')).map((b) => b.getAttribute('aria-label'));
    expect(cur()).toEqual(['Vermelho']);
    expect(named(el, 'Vermelho').getAttribute('aria-pressed')).toBe('true');
    named(el, 'Azul').click();
    await el.updateComplete;
    expect(cur()).toEqual(['Azul']);
    vi.advanceTimersByTime(3100);
    await el.updateComplete;
    expect(cur()).toEqual(['Vermelho']);
    el.hass = withState(hass, 'light.fita', 'on', { supported_color_modes: ['hs'], color_mode: 'hs', hs_color: [225, 100] });
    await el.updateComplete;
    expect(cur()).toEqual(['Azul']);
  });

  it('sets the temperature from the slider and shows the value asked', async () => {
    const hass = fita({
      supported_color_modes: ['color_temp'],
      min_color_temp_kelvin: 2700,
      max_color_temp_kelvin: 6500,
      color_mode: 'color_temp',
      color_temp_kelvin: 3000,
    });
    const el = await mount(hass);
    const input = slider(el)!;
    expect(input.value).toBe('3000');
    input.value = '4100';
    input.dispatchEvent(new Event('change'));
    expect(hass.calls[0]!.data).toEqual({ color_temp_kelvin: 4100 });
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('h3 .value')!.textContent).toBe('4100 K');
  });

  it('lets the slider reach both ends of a range that is not a multiple of 50', async () => {
    const hass = fita({ supported_color_modes: ['color_temp'], min_color_temp_kelvin: 2702, max_color_temp_kelvin: 6535 });
    const el = await mount(hass);
    const input = slider(el)!;
    expect([input.min, input.max, input.step]).toEqual(['2700', '6550', '50']);
    input.value = '6550';
    input.dispatchEvent(new Event('change'));
    input.value = '2700';
    input.dispatchEvent(new Event('change'));
    expect(hass.calls.map((c) => c.data)).toEqual([{ color_temp_kelvin: 6535 }, { color_temp_kelvin: 2702 }]);
  });
});
