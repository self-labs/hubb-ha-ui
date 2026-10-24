import { afterEach, describe, expect, it } from 'vitest';
import '../../src/elements/climate-panel';
import type { ClimateAllowed, HubbClimatePanel } from '../../src/elements/climate-panel';
import { makeHass, type FakeHass } from '../helpers/fake-hass';

// Mais ajustes in the style of the card of Home Assistant (Gustavo, 22/10): a button with the value and
// the list of the phone itself to pick another; the functions of the device in rows with a switch.

function office(extra: Record<string, unknown> = {}): FakeHass {
  return makeHass({
    entities: [
      {
        entity_id: 'climate.ar',
        name: 'Ar',
        state: 'cool',
        attributes: {
          hvac_modes: ['off', 'cool'],
          temperature: 23,
          fan_modes: ['auto', 'low', 'high'],
          fan_mode: 'auto',
          swing_modes: ['on', 'off'],
          swing_mode: 'on',
          preset_modes: ['none', 'sleep'],
          preset_mode: 'none',
          supported_features: 1 | 8 | 16 | 32 | 128 | 256,
          ...extra,
        },
      },
      { entity_id: 'switch.ar_luz', name: 'Luz', state: 'off' },
      { entity_id: 'select.ar_dormir', name: 'Dormir', state: 'off', attributes: { options: ['off', 'on'] } },
      { entity_id: 'number.ar_desligar', name: 'Desligar', state: '0', attributes: { min: 0, max: 12, step: 1, unit_of_measurement: 'h' } },
    ],
  });
}

const EXTRAS: ClimateAllowed['extras'] = [
  { entityId: 'switch.ar_luz', name: 'Luz do display', kind: 'switch' },
  { entityId: 'select.ar_dormir', name: 'Modo dormir', kind: 'select' },
  { entityId: 'number.ar_desligar', name: 'Desligar daqui a', kind: 'number' },
];

async function sheet(h: FakeHass, allowed: ClimateAllowed = { extras: EXTRAS }): Promise<HubbClimatePanel> {
  const el = document.createElement('hubb-climate-panel') as HubbClimatePanel;
  el.hass = h;
  el.entityId = 'climate.ar';
  el.allowed = allowed;
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}

const calls = (h: FakeHass) => h.calls.map((c) => [`${c.domain}.${c.service}`, c.data, c.target]);

function pick(el: HubbClimatePanel, selector: string, value: string): void {
  const select = el.shadowRoot!.querySelector(selector) as HTMLSelectElement;
  select.value = value;
  select.dispatchEvent(new Event('change'));
}

describe('Mais ajustes of an air conditioner', () => {
  afterEach(() => document.body.replaceChildren());

  it('Ventilação, Oscilação and Predefinição are buttons with the value, and a list to pick another', async () => {
    const h = office();
    const el = await sheet(h);
    const settings = [...el.shadowRoot!.querySelectorAll('label.setting')];
    expect(settings.map((s) => s.querySelector('.name')!.textContent!.trim())).toEqual(['Ventilação', 'Oscilação', 'Predefinição', 'Modo dormir']);
    expect(settings[0]!.querySelector('.value')!.textContent!.trim()).toBe('Auto');
    expect(settings[0]!.querySelector('select.fan')).not.toBeNull();
    pick(el, 'select.fan', 'high');
    pick(el, 'select.swing', 'off');
    pick(el, 'select.preset', 'sleep');
    expect(calls(h)).toEqual([
      ['climate.set_fan_mode', { fan_mode: 'high' }, { entity_id: 'climate.ar' }],
      ['climate.set_swing_mode', { swing_mode: 'off' }, { entity_id: 'climate.ar' }],
      ['climate.set_preset_mode', { preset_mode: 'sleep' }, { entity_id: 'climate.ar' }],
    ]);
  });

  it('a function that switches is a row with a switch', async () => {
    const h = office();
    const el = await sheet(h);
    const row = el.shadowRoot!.querySelector('.function')!;
    expect(row.querySelector('.name')!.textContent!.trim()).toBe('Luz do display');
    const toggle = row.querySelector('button[role="switch"]') as HTMLButtonElement;
    expect(toggle.getAttribute('aria-checked')).toBe('false');
    toggle.click();
    expect(calls(h)).toEqual([['switch.turn_on', undefined, { entity_id: 'switch.ar_luz' }]]);
  });

  it('a function the device refuses says so on the sheet, not in the toast of Home Assistant', async () => {
    const h = makeHass({
      failService: true,
      entities: [
        { entity_id: 'climate.ar', state: 'cool', attributes: { hvac_modes: ['off', 'cool'], temperature: 23, supported_features: 1 } },
        { entity_id: 'switch.ar_luz', state: 'on' },
      ],
    });
    const el = await sheet(h, { extras: [EXTRAS[0]!] });
    const toggle = el.shadowRoot!.querySelector('.function button[role="switch"]') as HTMLButtonElement;
    expect(toggle.getAttribute('aria-checked')).toBe('true');
    toggle.click();
    await new Promise((r) => setTimeout(r, 0));
    await el.updateComplete;
    expect(h.calls.map((c) => c.service)).toEqual(['turn_off']);
    expect(el.shadowRoot!.querySelector('.failed')).not.toBeNull();
  });

  it('a function with choices is a button with its value; one with a number keeps − and +', async () => {
    const h = office();
    const el = await sheet(h);
    expect(el.shadowRoot!.querySelector('label.setting select.extra-select')).not.toBeNull();
    pick(el, 'select.extra-select', 'on');
    (el.shadowRoot!.querySelector('.extra-number .up') as HTMLButtonElement).click();
    expect(calls(h)).toEqual([
      ['select.select_option', { option: 'on' }, { entity_id: 'select.ar_dormir' }],
      ['number.set_value', { value: 1 }, { entity_id: 'number.ar_desligar' }],
    ]);
  });

  it('what the installer left out does not show', async () => {
    const el = await sheet(office(), { controls: ['fan'], extras: EXTRAS, hide: ['switch.ar_luz'] });
    expect([...el.shadowRoot!.querySelectorAll('label.setting .name')].map((n) => n.textContent!.trim())).toEqual(['Ventilação', 'Modo dormir']);
    expect(el.shadowRoot!.querySelector('.function')).toBeNull();
  });

  it('a setting with a single choice says nothing and stays out, as today', async () => {
    const el = await sheet(office({ preset_modes: ['none'] }));
    expect(el.shadowRoot!.querySelector('select.preset')).toBeNull();
  });
});
