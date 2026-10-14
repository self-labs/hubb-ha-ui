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
