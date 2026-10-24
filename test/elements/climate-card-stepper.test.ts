import { afterEach, describe, expect, it, vi } from 'vitest';
import '../../src/elements/climate-card';
import '../../src/elements/climate-panel';
import type { HubbClimateCard } from '../../src/elements/climate-card';
import type { HubbClimatePanel } from '../../src/elements/climate-panel';
import { modeIcon } from '../../src/model/climate-mode';
import { makeHass, type FakeHass } from '../helpers/fake-hass';

// The card of an air conditioner on its room page, proposal 2 (Gustavo, 22/10): on with a target, − 23° +
// on the card itself, as the settings of the card of Home Assistant; off, the power button as today.

const FEATURES = 1 | 8 | 32 | 128 | 256;

function ar(state: string, attrs: Record<string, unknown> = {}, failService = false): FakeHass {
  return makeHass({
    failService,
    entities: [
      {
        entity_id: 'climate.ar',
        name: 'Ar',
        state,
        attributes: {
          hvac_modes: ['off', 'cool', 'heat', 'fan_only'],
          hvac_action: state === 'cool' ? 'cooling' : state === 'heat' ? 'heating' : 'off',
          temperature: 23,
          current_temperature: 27,
          min_temp: 16,
          max_temp: 30,
          target_temp_step: 1,
          supported_features: FEATURES,
          ...attrs,
        },
      },
    ],
  });
}

async function card(h: FakeHass): Promise<HubbClimateCard> {
  const el = document.createElement('hubb-climate-card') as HubbClimateCard;
  el.hass = h;
  el.item = { entityId: 'climate.ar', name: 'Ar', kind: 'climate' };
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}

const q = (el: Element, sel: string) => el.shadowRoot!.querySelector(sel);
const text = (el: Element, sel: string) => q(el, sel)?.textContent?.replace(/\s+/g, ' ').trim() ?? null;
const temps = (h: FakeHass) => h.calls.filter((c) => c.service === 'set_temperature').map((c) => c.data);

describe('the card of an air conditioner, with − and +', () => {
  afterEach(() => {
    vi.useRealTimers();
    document.body.replaceChildren();
  });

  it('on in Frio: − 23° + instead of the power button, and what it does with the temperature now', async () => {
    const el = await card(ar('cool'));
    expect(q(el, '.power')).toBeNull();
    expect(text(el, '.target')).toBe('23°');
    expect(text(el, '.state')).toBe('Resfriando · 27° agora');
    expect(q(el, '.colder')).not.toBeNull();
    expect(q(el, '.warmer')).not.toBeNull();
  });

  it('two taps on + show 25 and go out as one target after the taps stop', async () => {
    vi.useFakeTimers();
    const h = ar('cool');
    const el = await card(h);
    (q(el, '.warmer') as HTMLButtonElement).click();
    (q(el, '.warmer') as HTMLButtonElement).click();
    await el.updateComplete;
    expect(text(el, '.target')).toBe('25°');
    expect(temps(h)).toEqual([]);
    vi.advanceTimersByTime(800);
    expect(temps(h)).toEqual([{ temperature: 25 }]);
  });

  it('the card and the open sheet of the same air conditioner show the same target asked', async () => {
    vi.useFakeTimers();
    const h = ar('cool');
    const el = await card(h);
    const sheet = document.createElement('hubb-climate-panel') as HubbClimatePanel;
    sheet.hass = h;
    sheet.entityId = 'climate.ar';
    document.body.appendChild(sheet);
    await sheet.updateComplete;
    (q(el, '.warmer') as HTMLButtonElement).click();
    await el.updateComplete;
    await sheet.updateComplete;
    expect(text(sheet, '.target')).toBe('24°');
    (q(sheet, '.warmer') as HTMLButtonElement).click();
    await el.updateComplete;
    expect(text(el, '.target')).toBe('25°');
    vi.advanceTimersByTime(800);
    expect(temps(h)).toEqual([{ temperature: 25 }]);
  });

  it('off: the power button and no − and +; a tap turns it on, as today', async () => {
    const h = ar('off');
    const el = await card(h);
    expect(q(el, '.colder, .warmer')).toBeNull();
    (q(el, '.power') as HTMLButtonElement).click();
    expect(h.calls.map((c) => `${c.domain}.${c.service}`)).toEqual(['climate.turn_on']);
  });

  it('on in Ventilar (no target): the power button, to turn it off', async () => {
    const el = await card(ar('fan_only', { temperature: null }));
    expect(q(el, '.colder, .warmer')).toBeNull();
    expect(q(el, '.power')!.getAttribute('aria-pressed')).toBe('true');
  });

  it('a target the device refuses: the card shakes for a moment and the target goes back', async () => {
    vi.useFakeTimers();
    const h = ar('cool', {}, true);
    const el = await card(h);
    (q(el, '.warmer') as HTMLButtonElement).click();
    vi.advanceTimersByTime(800);
    await vi.advanceTimersByTimeAsync(0);
    await el.updateComplete;
    expect(q(el, '.card')!.classList.contains('refused')).toBe(true);
    expect(text(el, '.target')).toBe('23°');
    await vi.advanceTimersByTimeAsync(700);
    await el.updateComplete;
    expect(q(el, '.card')!.classList.contains('refused')).toBe(false);
  });

  it('a tap on the body opens the sheet; a tap on − or + does not', async () => {
    const el = await card(ar('cool'));
    const opened = vi.fn();
    el.addEventListener('hubb-open-climate', opened);
    (q(el, '.warmer') as HTMLButtonElement).click();
    (q(el, '.colder') as HTMLButtonElement).click();
    expect(opened).not.toHaveBeenCalled();
    (q(el, '.body') as HTMLButtonElement).click();
    expect(opened).toHaveBeenCalledTimes(1);
  });

  it('in Calor, the icon of the mode in its colour', async () => {
    const el = await card(ar('heat'));
    expect((q(el, '.card') as HTMLElement).style.getPropertyValue('--mode')).toBe('var(--hubb-mode-heat)');
    expect(q(el, '.icon path')!.getAttribute('d')).toBe(modeIcon('heat'));
  });
});
