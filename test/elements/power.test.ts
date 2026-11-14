import { afterEach, describe, expect, it, vi } from 'vitest';
import { todayKwh, watts } from '../../src/actions/energy';
import '../../src/elements/outlet-tile';
import '../../src/elements/power-panel';
import { makeHass, type FakeHass } from '../helpers/fake-hass';

function h(power = '120', unit = 'W'): FakeHass {
  return makeHass({
    entities: [
      { entity_id: 'switch.tomada', state: 'on', attributes: { device_class: 'outlet' } },
      { entity_id: 'sensor.tomada_w', state: power, attributes: { device_class: 'power', unit_of_measurement: unit } },
      { entity_id: 'sensor.tomada_kwh', state: '10.2', attributes: { device_class: 'energy', unit_of_measurement: 'kWh' } },
    ],
  });
}

const ITEM = { entityId: 'switch.tomada', name: 'Tomada', power: 'sensor.tomada_w', energy: 'sensor.tomada_kwh' };
const text = (el: Element, sel: string) => el.shadowRoot!.querySelector(sel)?.textContent?.replace(/\s+/g, ' ').trim() ?? null;
const flush = () => new Promise((r) => setTimeout(r, 0));

async function mount(tag: string, hass: FakeHass, item: unknown) {
  const el = document.createElement(tag) as HTMLElement & { hass: FakeHass; item: unknown; updateComplete: Promise<unknown> };
  el.hass = hass;
  el.item = item;
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}

describe('consumption', () => {
  afterEach(() => document.body.replaceChildren());

  it('writes power the Brazilian way', () => {
    expect(watts(h('120'), 'sensor.tomada_w')).toBe('120 W');
    expect(watts(h('1500'), 'sensor.tomada_w')).toBe('1,5 kW');
    expect(watts(h('0.8', 'kW'), 'sensor.tomada_w')).toBe('800 W');
    expect(watts(h('unavailable'), 'sensor.tomada_w')).toBeNull();
  });

  it('adds the power to an outlet that is on, and opens the consumption sheet on a long press', async () => {
    const el = await mount('hubb-outlet-tile', h(), ITEM);
    expect(text(el, '.state')).toBe('Ligada · 120 W');
    let asked: unknown = null;
    el.addEventListener('hubb-open-power', (e) => (asked = (e as CustomEvent).detail));
    el.shadowRoot!.querySelector('button')!.dispatchEvent(new Event('contextmenu', { cancelable: true }));
    expect(asked).toEqual({ entityId: 'switch.tomada' });
    document.body.replaceChildren();
    const bare = await mount('hubb-outlet-tile', h(), { entityId: 'switch.tomada', name: 'Tomada' });
    expect(text(bare, '.state')).toBe('Ligada');
  });

  it('reads today from the statistics of the energy sensor', async () => {
    const hass = h();
    hass.callWS = vi.fn(async () => ({ change: 1.23 })) as FakeHass['callWS'];
    expect(await todayKwh(hass, 'sensor.tomada_kwh')).toBe(1.23);
    expect((hass.callWS as ReturnType<typeof vi.fn>).mock.calls[0]![0]).toEqual({
      type: 'recorder/statistic_during_period',
      statistic_id: 'sensor.tomada_kwh',
      calendar: { period: 'day' },
      types: ['change'],
      units: { energy: 'kWh' },
    });
    const el = await mount('hubb-power-panel', hass, ITEM);
    await flush();
    await el.updateComplete;
    expect([text(el, '.now'), text(el, '.today')]).toEqual(['Agora 120 W', 'Hoje 1,2 kWh']);
  });

  it('shows only Agora when the statistics are refused or empty', async () => {
    const hass = h();
    hass.callWS = vi.fn(async () => {
      throw new Error('unauthorized');
    }) as FakeHass['callWS'];
    const el = await mount('hubb-power-panel', hass, ITEM);
    await flush();
    await el.updateComplete;
    expect([text(el, '.now'), text(el, '.today')]).toEqual(['Agora 120 W', null]);
    hass.callWS = vi.fn(async () => ({})) as FakeHass['callWS'];
    expect(await todayKwh(hass, 'sensor.tomada_kwh')).toBeNull();
  });
});

describe('the consumption sheet on the room page', () => {
  afterEach(() => document.body.replaceChildren());

  it('opens for an outlet with a power sensor, named after it', async () => {
    const { buildHouse, allLightIds } = await import('../../src/model/build-house');
    await import('../../src/screens/room-screen');
    const { area, device } = await import('../helpers/fake-hass');
    const hass = makeHass({
      areas: [area('sala', 'Sala')],
      devices: [device('d_t', 'sala', 'Tomada TV')],
      entities: [
        { entity_id: 'switch.tomada', device_id: 'd_t', name: 'TV', state: 'on', attributes: { device_class: 'outlet' } },
        { entity_id: 'sensor.tomada_w', device_id: 'd_t', state: '120', attributes: { device_class: 'power', unit_of_measurement: 'W' } },
      ],
    });
    const house = buildHouse(hass);
    const el = document.createElement('hubb-room-screen') as HTMLElement & { hass: FakeHass; setConfig(c: unknown): void; updateComplete: Promise<unknown> };
    el.setConfig({ type: 'custom:hubb-room-screen', room: house.rooms[0]!, lightIds: allLightIds(house) });
    el.hass = hass;
    document.body.appendChild(el);
    await el.updateComplete;
    el.shadowRoot!.querySelector('hubb-outlet-tile')!.dispatchEvent(new CustomEvent('hubb-open-power', { detail: { entityId: 'switch.tomada' }, bubbles: true, composed: true }));
    await el.updateComplete;
    const sheet = el.shadowRoot!.querySelector('hubb-sheet.device') as HTMLElement & { open: boolean; heading: string };
    expect([sheet.open, sheet.heading]).toEqual([true, 'TV']);
    expect((sheet.querySelector('hubb-power-panel') as unknown as { item: { power: string } }).item.power).toBe('sensor.tomada_w');
  });
});

// The consumption sheet opens on a tap now, so it carries the Ligar and Desligar the tile used to give
// on a tap (Gustavo, 14/11).
describe('the Ligar and Desligar button of the consumption sheet', () => {
  afterEach(() => document.body.replaceChildren());
  const button = (el: Element) => el.shadowRoot!.querySelector<HTMLButtonElement>('button.power')!;

  it('says Desligar for an outlet that is on, turns it off, and says Desligando… until the answer', async () => {
    const hass = h();
    const el = await mount('hubb-power-panel', hass, ITEM);
    expect(button(el).textContent!.trim()).toBe('Desligar');
    button(el).click();
    await el.updateComplete;
    expect(hass.calls).toEqual([{ domain: 'switch', service: 'turn_off', data: undefined, target: { entity_id: 'switch.tomada' } }]);
    expect(button(el).textContent!.trim()).toBe('Desligando…');
  });

  it('is not announced as a toggle, since its label already says what a press does', async () => {
    const el = await mount('hubb-power-panel', h(), ITEM);
    expect(button(el).hasAttribute('aria-pressed')).toBe(false);
  });

  it('says Ligar for an outlet that is off and turns it on', async () => {
    const hass = makeHass({ entities: [{ entity_id: 'switch.tomada', state: 'off', attributes: { device_class: 'outlet' } }] });
    const el = await mount('hubb-power-panel', hass, { entityId: 'switch.tomada', name: 'Tomada', power: null, energy: null });
    expect(button(el).textContent!.trim()).toBe('Ligar');
    button(el).click();
    await el.updateComplete;
    expect(hass.calls.map((c) => c.service)).toEqual(['turn_on']);
    expect(button(el).textContent!.trim()).toBe('Ligando…');
  });
});
