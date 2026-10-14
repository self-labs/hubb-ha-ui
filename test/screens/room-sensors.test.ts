import { afterEach, describe, expect, it } from 'vitest';
import '../../src/elements/room-card';
import '../../src/screens/home-screen';
import '../../src/screens/room-screen';
import type { HubbHomeScreen } from '../../src/screens/home-screen';
import type { HubbRoomScreen } from '../../src/screens/room-screen';
import { allLightIds, buildHouse } from '../../src/model/build-house';
import { openingWord, roomClimate } from '../../src/summary';
import { area, makeHass, type FakeHass } from '../helpers/fake-hass';

function h(window = 'on', motion = 'on', temp = '24.4', hum = '61'): FakeHass {
  return makeHass({
    areas: [area('quarto', 'Quarto')],
    entities: [
      { entity_id: 'light.quarto', area_id: 'quarto', name: 'Teto', state: 'off' },
      { entity_id: 'binary_sensor.janela', area_id: 'quarto', name: 'Janela', state: window, attributes: { device_class: 'window' } },
      { entity_id: 'binary_sensor.porta', area_id: 'quarto', name: 'Porta', state: 'off', attributes: { device_class: 'door' } },
      { entity_id: 'binary_sensor.movimento', area_id: 'quarto', name: 'Movimento', state: motion, attributes: { device_class: 'motion' } },
      { entity_id: 'sensor.temp', area_id: 'quarto', state: temp, attributes: { device_class: 'temperature' } },
      { entity_id: 'sensor.umid', area_id: 'quarto', state: hum, attributes: { device_class: 'humidity' } },
    ],
  });
}

async function room(hass: FakeHass): Promise<HubbRoomScreen> {
  const house = buildHouse(hass);
  const el = document.createElement('hubb-room-screen') as HubbRoomScreen;
  el.setConfig({ type: 'custom:hubb-room-screen', room: house.rooms[0]!, lightIds: allLightIds(house) });
  el.hass = hass;
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}

const texts = (el: Element, sel: string) => [...el.shadowRoot!.querySelectorAll(sel)].map((c) => c.textContent!.replace(/\s+/g, ' ').trim());

describe('room sensors', () => {
  afterEach(() => document.body.replaceChildren());

  it('shows the temperature and the humidity in the header, and nothing for a sensor that is down', async () => {
    const hass = h();
    expect(roomClimate(hass, buildHouse(hass).rooms[0]!)).toBe('24° · 61%');
    const down = h('on', 'on', 'unavailable', '61');
    expect(roomClimate(down, buildHouse(down).rooms[0]!)).toBe('61%');
    expect(texts(await room(hass), '.hero .climate')).toEqual(['24° · 61%']);
  });

  it('shows Ocupado and what is open under the header, only for sensors that are on', async () => {
    expect(texts(await room(h()), '.facts .fact')).toEqual(['Ocupado', 'Janela aberta']);
    document.body.replaceChildren();
    expect(texts(await room(h('unavailable', 'unknown')), '.facts .fact')).toEqual([]);
    expect(openingWord({ entityId: 'x', name: 'Basculante', kind: 'opening', roomName: null, path: null })).toBe('Aberto: Basculante');
  });

  it('puts what is open on the home chips and Ocupado on the room card', async () => {
    const hass = h();
    const el = document.createElement('hubb-home-screen') as HubbHomeScreen;
    el.setConfig({ type: 'custom:hubb-home-screen', house: buildHouse(hass) });
    el.hass = hass;
    document.body.appendChild(el);
    await el.updateComplete;
    expect(texts(el, '.chips .chip.open')).toEqual(['Janela aberta · Quarto']);
    const card = el.shadowRoot!.querySelector('hubb-room-card')!;
    await (card as unknown as { updateComplete: Promise<unknown> }).updateComplete;
    expect(card.shadowRoot!.textContent).toContain('Ocupado · ');
  });
});
