import { afterEach, describe, expect, it, vi } from 'vitest';
import '../../src/elements/climate-card';
import type { HubbClimateCard } from '../../src/elements/climate-card';
import '../../src/elements/climate-panel';
import type { HubbClimatePanel } from '../../src/elements/climate-panel';
import { makeHass, type FakeHass } from '../helpers/fake-hass';

const FULL = 1 | 8 | 32 | 128 | 256;

function ar(state = 'cool', extra: Record<string, unknown> = {}, features = FULL): FakeHass {
  return makeHass({
    entities: [
      {
        entity_id: 'climate.ar',
        state,
        attributes: {
          hvac_modes: ['off', 'cool', 'auto'],
          fan_modes: ['auto', 'low', 'high'],
          fan_mode: 'auto',
          swing_modes: ['on', 'off'],
          swing_mode: 'on',
          temperature: 23,
          current_temperature: 27,
          target_temp_step: 0.5,
          min_temp: 16,
          max_temp: 30,
          hvac_action: state === 'off' ? 'off' : 'cooling',
          supported_features: features,
          ...extra,
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

async function panel(h: FakeHass): Promise<HubbClimatePanel> {
  const el = document.createElement('hubb-climate-panel') as HubbClimatePanel;
  el.hass = h;
  el.entityId = 'climate.ar';
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}

const text = (el: Element, sel: string) => el.shadowRoot!.querySelector(sel)?.textContent?.replace(/\s+/g, ' ').trim() ?? null;
const services = (h: FakeHass) => h.calls.map((c) => [`${c.domain}.${c.service}`, c.data]);

describe('hubb-climate-card', () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it('says what it does and the target, with the temperature now', async () => {
    const el = await card(ar());
    expect(text(el, '.state')).toBe('Resfriando · 23°');
    expect(text(el, '.now')).toBe('27° agora');
  });

  it('turns on and off with its power button, by the mode when it has no turn_on', async () => {
    const on = ar('cool');
    await (await card(on)).shadowRoot!.querySelector<HTMLButtonElement>('.power')!.click();
    expect(services(on)).toEqual([['climate.turn_off', undefined]]);
    document.body.replaceChildren();
    const off = ar('off', {}, 1);
    const el = await card(off);
    expect(text(el, '.state')).toBe('Desligado');
    el.shadowRoot!.querySelector<HTMLButtonElement>('.power')!.click();
    expect(services(off)).toEqual([['climate.set_hvac_mode', { hvac_mode: 'cool' }]]);
  });

  it('asks for its sheet on a tap', async () => {
    const el = await card(ar());
    let asked: string | null = null;
    document.body.addEventListener('hubb-open-climate', (e) => (asked = (e as CustomEvent<{ entityId: string }>).detail.entityId), { once: true });
    el.shadowRoot!.querySelector<HTMLButtonElement>('.body')!.click();
    expect(asked).toBe('climate.ar');
  });
});

describe('hubb-climate-panel', () => {
  afterEach(() => {
    vi.useRealTimers();
    document.body.replaceChildren();
  });

  it('raises the target by its step and sends it once, after a pause', async () => {
    vi.useFakeTimers();
    const h = ar();
    const el = await panel(h);
    const plus = el.shadowRoot!.querySelector<HTMLButtonElement>('.warmer')!;
    plus.click();
    plus.click();
    await el.updateComplete;
    expect(text(el, '.target')).toBe('24°');
    expect(h.calls).toEqual([]);
    await vi.advanceTimersByTimeAsync(900);
    expect(services(h)).toEqual([['climate.set_temperature', { temperature: 24 }]]);
  });

  it('changes the mode, the fan and the swing', async () => {
    const h = ar();
    const el = await panel(h);
    const modes = [...el.shadowRoot!.querySelectorAll('.mode')];
    // Off is the power button's since the compact sheet (pente fino 1).
    expect(modes.map((b) => b.textContent!.trim())).toEqual(['Frio', 'Auto']);
    (modes[1] as HTMLButtonElement).click();
    const fans = [...el.shadowRoot!.querySelectorAll('.fan')];
    expect(fans.map((b) => b.textContent!.trim())).toEqual(['Auto', 'Baixa', 'Alta']);
    (fans[2] as HTMLButtonElement).click();
    const swing = el.shadowRoot!.querySelector<HTMLSelectElement>('select.swing')!;
    swing.value = 'off';
    swing.dispatchEvent(new Event('change'));
    expect(services(h)).toEqual([
      ['climate.set_hvac_mode', { hvac_mode: 'auto' }],
      ['climate.set_fan_mode', { fan_mode: 'high' }],
      ['climate.set_swing_mode', { swing_mode: 'off' }],
    ]);
  });

  it('gives a fan its speeds', async () => {
    const h = makeHass({ entities: [{ entity_id: 'fan.teto', state: 'on', attributes: { percentage: 50, supported_features: 1 | 16 | 32 } }] });
    const el = document.createElement('hubb-climate-panel') as HubbClimatePanel;
    el.hass = h;
    el.entityId = 'fan.teto';
    document.body.appendChild(el);
    await el.updateComplete;
    const speeds = [...el.shadowRoot!.querySelectorAll('.speed')];
    expect(speeds.map((b) => b.textContent!.trim())).toEqual(['25%', '50%', '75%', '100%']);
    (speeds[3] as HTMLButtonElement).click();
    expect(services(h)).toEqual([['fan.set_percentage', { percentage: 100 }]]);
  });
});
