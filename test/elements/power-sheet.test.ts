import { afterEach, describe, expect, it, vi } from 'vitest';
import '../../src/elements/power-panel';
import { makeHass, type FakeHass } from '../helpers/fake-hass';

// The consumption sheet of an outlet or an equipment: a big round Ligar/Desligar, then the two numbers
// (Gustavo, 14/11: each sheet with its own look). What it does is what it did.
function h(state = 'on'): FakeHass {
  return makeHass({
    entities: [
      { entity_id: 'switch.tomada', state, attributes: { device_class: 'outlet' } },
      { entity_id: 'sensor.tomada_w', state: '120', attributes: { device_class: 'power', unit_of_measurement: 'W' } },
      { entity_id: 'sensor.tomada_kwh', state: '10.2', attributes: { device_class: 'energy', unit_of_measurement: 'kWh' } },
    ],
  });
}

const BOTH = { entityId: 'switch.tomada', name: 'Tomada', power: 'sensor.tomada_w', energy: 'sensor.tomada_kwh' };
const POWER_ONLY = { entityId: 'switch.tomada', name: 'Tomada', power: 'sensor.tomada_w', energy: null };
const NONE = { entityId: 'switch.tomada', name: 'Tomada', power: null, energy: null };
const q = (el: Element, sel: string) => el.shadowRoot!.querySelector(sel);

async function mount(hass: FakeHass, item: unknown) {
  const el = document.createElement('hubb-power-panel') as HTMLElement & { hass: FakeHass; item: unknown; updateComplete: Promise<unknown> };
  el.hass = hass;
  el.item = item;
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}

describe('the consumption sheet', () => {
  afterEach(() => document.body.replaceChildren());

  it('puts the round button in a block of its own, above the numbers', async () => {
    const hass = h();
    hass.callWS = vi.fn(async () => ({ change: 1.2 })) as FakeHass['callWS'];
    const el = await mount(hass, BOTH);
    await new Promise((r) => setTimeout(r, 0));
    await el.updateComplete;
    expect(q(el, '.hero > button.power')).not.toBeNull();
    const kids = [...q(el, '.figures')!.children].map((c) => c.className.split(' ')[0]);
    expect(kids).toEqual(['now', 'today']);
    expect(q(el, '.figures')!.classList.contains('two')).toBe(true);
  });

  it('gives Agora the whole row when there is no energy sensor', async () => {
    const el = await mount(h(), POWER_ONLY);
    expect(q(el, '.figures')!.classList.contains('one')).toBe(true);
    expect(q(el, '.today')).toBeNull();
  });

  it('has no numbers at all when it has no sensor, only the button', async () => {
    const el = await mount(h(), NONE);
    expect(q(el, '.figures')).toBeNull();
    expect(q(el, '.hero > button.power')).not.toBeNull();
  });

  it('lights the Agora card while the outlet is on, and not while it is off', async () => {
    expect(q(await mount(h('on'), POWER_ONLY), '.now')!.classList.contains('live')).toBe(true);
    document.body.replaceChildren();
    expect(q(await mount(h('off'), POWER_ONLY), '.now')!.classList.contains('live')).toBe(false);
  });
});
