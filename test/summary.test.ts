import { describe, expect, it } from 'vitest';
import { buildHouse } from '../src/model/build-house';
import { area, makeHass, withState, type FakeHass } from './helpers/fake-hass';
import type { Room } from '../src/model/types';
import {
  applianceChipText,
  applianceLine,
  applianceSubheading,
  busyAppliances,
  findAppliance,
  lightsOnByRoom,
  roomCardStatus,
  roomHeroStatus,
  summarize,
} from '../src/summary';
import { CASA2_CONFIG, casa2Hass } from './fixtures/casa-exemplo-2';

function hass(): FakeHass {
  return makeHass({
    areas: [area('sala', 'Sala'), area('quarto', 'Quarto'), area('cozinha', 'Cozinha')],
    entities: [
      { entity_id: 'light.sofa', area_id: 'sala', name: 'Sofá', state: 'off' },
      { entity_id: 'light.lustre', area_id: 'sala', name: 'Lustre', state: 'off' },
      { entity_id: 'light.cama', area_id: 'quarto', name: 'Cama', state: 'off' },
      { entity_id: 'light.bancada', area_id: 'cozinha', name: 'Bancada', state: 'off' },
    ],
  });
}

describe('summarize', () => {
  it('does not mention the rest when the other rooms only have outlets', () => {
    const h = makeHass({
      areas: [area('sala', 'Sala'), area('lav', 'Lavanderia')],
      entities: [
        { entity_id: 'light.sofa', area_id: 'sala', state: 'on' },
        { entity_id: 'switch.secadora', area_id: 'lav', state: 'off', attributes: { device_class: 'outlet' } },
      ],
    });
    expect(summarize(buildHouse(h), h)).toEqual({ headline: 'Sala com 1 luz acesa.', detail: '', lightsOn: 1 });
  });

  it('says everything is off', () => {
    const h = hass();
    expect(summarize(buildHouse(h), h)).toEqual({ headline: 'Tudo apagado.', detail: '', lightsOn: 0 });
  });

  it('names the only room with lights on and says the rest is off', () => {
    let h = hass();
    const house = buildHouse(h);
    h = withState(withState(h, 'light.sofa', 'on'), 'light.lustre', 'on');
    expect(summarize(house, h)).toEqual({
      headline: 'Sala com 2 luzes acesas.',
      detail: 'O resto está apagado.',
      lightsOn: 2,
    });
    expect(summarize(house, withState(h, 'light.lustre', 'off')).headline).toBe('Sala com 1 luz acesa.');
  });

  it('counts rooms when lights are on in more than one', () => {
    let h = hass();
    const house = buildHouse(h);
    h = withState(withState(withState(h, 'light.sofa', 'on'), 'light.cama', 'on'), 'light.lustre', 'on');
    expect(summarize(house, h)).toEqual({ headline: '3 luzes acesas em 2 ambientes.', detail: 'Quarto e Sala.', lightsOn: 3 });
  });

  it('names the rooms only while they are two: with three or more the count says enough', () => {
    let h = hass();
    const house = buildHouse(h);
    h = withState(withState(withState(h, 'light.sofa', 'on'), 'light.cama', 'on'), 'light.bancada', 'on');
    expect(summarize(house, h)).toEqual({ headline: '3 luzes acesas em 3 ambientes.', detail: '', lightsOn: 3 });
  });

  it('does not count unavailable lights, and skips "the rest" in a one-room house', () => {
    const h = makeHass({
      areas: [area('sala', 'Sala')],
      entities: [
        { entity_id: 'light.a', area_id: 'sala', state: 'on' },
        { entity_id: 'light.b', area_id: 'sala', state: 'unavailable' },
      ],
    });
    expect(summarize(buildHouse(h), h)).toEqual({ headline: 'Sala com 1 luz acesa.', detail: '', lightsOn: 1 });
  });

  it('groups the lights that are on by room, in room order', () => {
    let h = hass();
    const house = buildHouse(h);
    h = withState(withState(h, 'light.bancada', 'on'), 'light.sofa', 'on');
    expect(lightsOnByRoom(house, h).map((g) => [g.room.name, g.on])).toEqual([
      ['Cozinha', ['light.bancada']],
      ['Sala', ['light.sofa']],
    ]);
  });
});

const bareRoom = (over: Partial<Room>): Room => ({
  areaId: 'a',
  path: 'a',
  name: 'A',
  photo: null,
  icon: null,
  art: 'casa',
  floorId: null,
  lights: [],
  outlets: [],
  equipment: [],
  appliances: [],
  actions: [],
  climate: [],
  covers: [],
  media: [],
  access: [],
  scenes: [],
  hidden: [],
  openings: [],
  presence: [],
  temperature: null,
  humidity: null,
  sensors: [],
  hiddenFor: [],
  ...over,
});

describe('room statuses with equipment', () => {
  const h = makeHass({
    entities: [
      { entity_id: 'switch.bomba', state: 'on' },
      { entity_id: 'switch.tomada', state: 'off' },
      { entity_id: 'light.teto', state: 'off' },
    ],
  });
  const tomada = { entityId: 'switch.tomada', name: 'Tomada' };
  const bomba = { entityId: 'switch.bomba', name: 'Bomba', icon: null };

  it('counts outlets and equipment together, in the masculine, once there is equipment', () => {
    const r = bareRoom({ outlets: [tomada], equipment: [bomba] });
    expect(roomHeroStatus(r, h)).toBe('1 de 2 ligados');
    expect(roomCardStatus(r, h)).toBe('1 ligado');
  });

  it('keeps the outlet words for a room with only outlets, and the light words when it has lights', () => {
    expect(roomHeroStatus(bareRoom({ outlets: [tomada] }), h)).toBe('Tudo desligado');
    expect(roomCardStatus(bareRoom({ outlets: [tomada] }), h)).toBe('Desligado');
    const lit = bareRoom({ lights: [{ entityId: 'light.teto', name: 'Teto', dimmable: false }], equipment: [bomba] });
    expect(roomHeroStatus(lit, h)).toBe('Tudo apagado');
    expect(roomCardStatus(lit, h)).toBe('Apagado');
  });

  it('lets a room that has only an appliance speak about it on its card, paused or not, and stays quiet for only actions', () => {
    const paused = casa2Hass('Paused', '40');
    const item = buildHouse(paused, CASA2_CONFIG).rooms.find((r) => r.areaId === 'terraco')!.appliances[0]!;
    expect(roomCardStatus(bareRoom({ appliances: [item] }), paused)).toBe('Pausada · faltam 40 min');
    expect(roomCardStatus(bareRoom({ actions: [{ entityId: 'button.x', name: 'X', icon: null }] }), h)).toBe('');
  });

  it('says nothing under the name of a room that has only actions', () => {
    expect(roomHeroStatus(bareRoom({ actions: [{ entityId: 'button.x', name: 'X', icon: null }] }), h)).toBe('');
  });
});

describe('appliance lines', () => {
  const washer = (h: ReturnType<typeof casa2Hass>) =>
    buildHouse(h, CASA2_CONFIG).rooms.find((r) => r.areaId === 'terraco')!.appliances[0]!;

  it('adds the time left while the appliance runs or waits paused, and shows the state alone otherwise', () => {
    const running = casa2Hass('Running', '40');
    expect(applianceLine(running, washer(running))).toBe('Lavando · faltam 40 min');
    const paused = casa2Hass('Paused', '1');
    expect(applianceLine(paused, washer(paused))).toBe('Pausada · falta 1 min');
    const idle = casa2Hass('Idle', '80');
    expect(applianceLine(idle, washer(idle))).toBe('Parada');
  });

  it('says Sem estado for an appliance with no state sensor', () => {
    const h = casa2Hass();
    expect(applianceLine(h, { ...washer(h), parts: { ...washer(h).parts, state: null } })).toBe('Sem estado');
  });

  it('lists only the appliances that work, and names them with the time left on the home', () => {
    const running = casa2Hass('Running', '40');
    const house = buildHouse(running, CASA2_CONFIG);
    expect(busyAppliances(house.rooms, running).map((b) => [b.item.name, b.room.name])).toEqual([['Lavadora', 'Terraço']]);
    expect(applianceChipText(running, washer(running))).toBe('Lavadora · 40 min');
    const unknownTime = withState(running, 'sensor.lavadora_timetoend', 'unknown');
    expect(applianceChipText(unknownTime, washer(running))).toBe('Lavadora · Lavando');
    expect(busyAppliances(house.rooms, casa2Hass('Idle', '80'))).toEqual([]);
  });

  it('finds an appliance by its device, and puts the program under its name', () => {
    const h = casa2Hass();
    const house = buildHouse(h, CASA2_CONFIG);
    const found = findAppliance(house.rooms, 'd_lavadora')!;
    expect(found.room.name).toBe('Terraço');
    expect(applianceSubheading(h, found.item, found.room.name)).toBe('Terraço · colors');
    expect(findAppliance(house.rooms, 'nada')).toBeNull();
  });

  it('lets a working appliance speak on its room card, after the lights', () => {
    const running = casa2Hass('Running', '40');
    const terraco = buildHouse(running, CASA2_CONFIG).rooms.find((r) => r.areaId === 'terraco')!;
    expect(roomCardStatus(terraco, running)).toBe('Lavadora · 40 min');
    expect(roomCardStatus(terraco, withState(running, 'switch.varanda_luz', 'on'))).toBe('1 acesa');
    expect(roomCardStatus(terraco, casa2Hass('Idle', '80'))).toBe('Apagado');
  });
});
