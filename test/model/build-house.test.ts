import { describe, expect, it } from 'vitest';
import { allLightIds, buildHouse, normalizeHouse, normalizeRoom } from '../../src/model/build-house';
import type { House, Room } from '../../src/model/types';
import { CASA2_CONFIG, casa2Hass } from '../fixtures/casa-exemplo-2';
import { CLINIC_CONFIG, clinicHass } from '../fixtures/clinic';
import { sampleHouseHass } from '../fixtures/sample-house';
import { area, device, makeHass } from '../helpers/fake-hass';

function sample() {
  return makeHass({
    areas: [area('sala', 'Sala', '/local/sala.jpg'), area('quarto', 'Quarto'), area('garagem', 'Garagem')],
    devices: [device('d_quarto', 'quarto', 'Módulo Quarto')],
    entities: [
      { entity_id: 'light.sofa', area_id: 'sala', name: 'Sofá', state: 'on', attributes: { supported_color_modes: ['onoff'] } },
      { entity_id: 'light.mesa', area_id: 'sala', name: 'Mesa', state: 'on', attributes: { supported_color_modes: ['brightness'], brightness: 153 } },
      { entity_id: 'light.cama', device_id: 'd_quarto', name: 'Cama', state: 'off', attributes: { supported_color_modes: ['onoff'] } },
      { entity_id: 'light.solta', name: 'Solta', state: 'off' },
      { entity_id: 'light.oculta', area_id: 'sala', name: 'Oculta', hidden: true, state: 'off' },
      { entity_id: 'light.diag', area_id: 'sala', name: 'Diag', entity_category: 'diagnostic', state: 'off' },
      { entity_id: 'switch.bomba', area_id: 'garagem', name: 'Bomba', state: 'off' },
      { entity_id: 'scene.cinema', area_id: 'sala', name: 'Cinema', labels: ['hubb_cena'], state: '2026-10-09T20:00:00', attributes: { entity_id: ['light.sofa', 'light.cama'] } },
      { entity_id: 'script.chegar', name: 'Chegar', labels: ['hubb_cena'], state: 'off' },
      { entity_id: 'scene.sem_label', name: 'Sem label', state: 'unknown' },
    ],
  });
}

const names = <T extends { name: string }>(items: T[]) => items.map((i) => i.name);

describe('buildHouse', () => {
  it('puts each light in the area of the entity, or else of its device', () => {
    const house = buildHouse(sample());
    expect(names(house.rooms)).toEqual(['Quarto', 'Sala']);
    expect(names(house.rooms[0]!.lights)).toEqual(['Cama']);
  });

  it('leaves out lights with no area, hidden or diagnostic lights, and areas with no lights', () => {
    const sala = buildHouse(sample()).rooms.find((r) => r.areaId === 'sala')!;
    expect(names(sala.lights)).toEqual(['Mesa', 'Sofá']);
  });

  it('marks a light as dimmable when it supports more than on and off', () => {
    const sala = buildHouse(sample()).rooms.find((r) => r.areaId === 'sala')!;
    expect(sala.lights.map((l) => [l.name, l.dimmable])).toEqual([['Mesa', true], ['Sofá', false]]);
  });

  it('honours hide_entities', () => {
    const sala = buildHouse(sample(), { hide_entities: ['light.mesa'] }).rooms.find((r) => r.areaId === 'sala')!;
    expect(names(sala.lights)).toEqual(['Sofá']);
  });

  it('takes the room photo from the area unless the config overrides it', () => {
    const plain = buildHouse(sample());
    expect(plain.rooms.find((r) => r.areaId === 'sala')!.photo).toBe('/local/sala.jpg');
    expect(plain.rooms.find((r) => r.areaId === 'quarto')!.photo).toBeNull();
    const over = buildHouse(sample(), { rooms: { sala: { photo: '/local/hubb/sala.jpg' } } });
    expect(over.rooms.find((r) => r.areaId === 'sala')!.photo).toBe('/local/hubb/sala.jpg');
  });

  it('orders rooms by the config order, then by name, and hides what the config hides', () => {
    expect(names(buildHouse(sample(), { rooms: { sala: { order: 1 } } }).rooms)).toEqual(['Sala', 'Quarto']);
    expect(names(buildHouse(sample(), { rooms: { quarto: { hidden: true } } }).rooms)).toEqual(['Sala']);
  });

  it('picks a drawing for each room from the area name, then its icon', () => {
    const h = makeHass({
      areas: [area('sala', 'Sala de Jantar'), { ...area('b1', 'Bloco B'), icon: 'mdi:bed' }, area('b2', 'Bloco C')],
      entities: [
        { entity_id: 'light.a', area_id: 'sala', state: 'off' },
        { entity_id: 'light.b', area_id: 'b1', state: 'off' },
        { entity_id: 'light.c', area_id: 'b2', state: 'off' },
      ],
    });
    expect(buildHouse(h).rooms.map((r) => [r.areaId, r.art])).toEqual([
      ['b1', 'quarto'],
      ['b2', 'casa'],
      ['sala', 'jantar'],
    ]);
  });

  it('takes the drawing from the config, and ignores an id it does not know', () => {
    const sala = (art: string) => buildHouse(sample(), { rooms: { sala: { art } } }).rooms.find((r) => r.areaId === 'sala')!;
    expect(sala('tv').art).toBe('tv');
    expect(sala('cozinah').art).toBe('sala');
  });

  it('collects only scenes and scripts with the hubb_cena label, in config order then by name', () => {
    expect(names(buildHouse(sample()).scenes)).toEqual(['Chegar', 'Cinema']);
    expect(names(buildHouse(sample(), { scenes: ['scene.cinema'] }).scenes)).toEqual(['Cinema', 'Chegar']);
  });

  it('shows a scene with an area on that room, and describes a scene by the rooms it touches', () => {
    const house = buildHouse(sample());
    const sala = house.rooms.find((r) => r.areaId === 'sala')!;
    expect(sala.scenes.map((s) => s.entityId)).toEqual(['scene.cinema']);
    expect(house.scenes.find((s) => s.entityId === 'scene.cinema')!.description).toBe('Sala e Quarto');
    expect(house.scenes.find((s) => s.entityId === 'script.chegar')!.description).toBeNull();
  });

  it('names the house from the config, then from Home Assistant', () => {
    expect(buildHouse(sample(), { name: 'Casa Exemplo' }).name).toBe('Casa Exemplo');
    expect(buildHouse(sample()).name).toBe('Casa');
  });

  it('gives a reserved area id a path that cannot clash with the fixed screens', () => {
    const hass = makeHass({
      areas: [area('home', 'Home'), area('sala', 'Sala')],
      entities: [
        { entity_id: 'light.a', area_id: 'home', state: 'off' },
        { entity_id: 'light.b', area_id: 'sala', state: 'off' },
      ],
    });
    expect(buildHouse(hass).rooms.map((r) => r.path)).toEqual(['area-home', 'sala']);
  });

  it('builds the sample house', () => {
    const house = buildHouse(sampleHouseHass());
    expect(house.rooms.map((r) => [r.name, r.lights.length])).toEqual([['Cozinha', 4], ['Quarto', 7], ['Sala', 7]]);
    expect(names(house.rooms[2]!.lights)).toEqual(['Aparador', 'Escada', 'LED', 'Lustre', 'Pendente', 'Quadro', 'Sofa']);
    expect(allLightIds(house)).toHaveLength(18);
    expect(allLightIds(house)).not.toContain('light.hubb_m2_saida_8');
    expect(house.weatherEntityId).toBe('weather.forecast_home');
  });

  it('puts outlets in their room, and lets a room with only outlets in', () => {
    const h = makeHass({
      areas: [area('sala', 'Sala'), area('lavanderia', 'Lavanderia')],
      entities: [
        { entity_id: 'light.sofa', area_id: 'sala', name: 'Sofá', state: 'off' },
        { entity_id: 'switch.tv', area_id: 'sala', name: 'TV', state: 'on', attributes: { device_class: 'outlet' } },
        { entity_id: 'switch.secadora', area_id: 'lavanderia', name: 'Secadora', state: 'off', attributes: { device_class: 'outlet' } },
      ],
    });
    const house = buildHouse(h);
    expect(names(house.rooms)).toEqual(['Lavanderia', 'Sala']);
    expect(house.rooms[0]!.lights).toEqual([]);
    expect(house.rooms[0]!.outlets).toEqual([{ entityId: 'switch.secadora', name: 'Secadora' }]);
    expect(house.rooms[1]!.outlets).toEqual([{ entityId: 'switch.tv', name: 'TV' }]);
    expect(allLightIds(house)).toEqual(['light.sofa']);
  });

  it('leaves out switches that are not outlets, and outlets that are hidden, configuration or without an area', () => {
    const h = makeHass({
      areas: [area('sala', 'Sala')],
      entities: [
        { entity_id: 'switch.jet', area_id: 'sala', state: 'off' },
        { entity_id: 'switch.trava', area_id: 'sala', state: 'off', entity_category: 'config', attributes: { device_class: 'outlet' } },
        { entity_id: 'switch.velha', area_id: 'sala', state: 'off', hidden: true, attributes: { device_class: 'outlet' } },
        { entity_id: 'switch.solta', state: 'off', attributes: { device_class: 'outlet' } },
      ],
    });
    expect(buildHouse(h).rooms).toEqual([]);
  });
});

describe('buildHouse with roles, profiles and floors', () => {
  it('builds the same house as before when the configuration has no new keys', () => {
    const house = buildHouse(sampleHouseHass());
    expect(house.profile).toBe('home');
    expect(house.homeLabel).toBe('Casa');
    expect(house.floors).toEqual([]);
    expect(
      house.rooms.map((r) => [r.name, r.art, r.floorId, r.lights.length, r.outlets.length, r.equipment.length, r.appliances.length, r.actions.length]),
    ).toEqual([
      ['Cozinha', 'cozinha', null, 4, 0, 0, 0, 0],
      ['Quarto', 'quarto', null, 7, 0, 0, 0, 0],
      ['Sala', 'sala', null, 7, 0, 0, 0, 0],
    ]);
  });

  it('puts a switch with the light role among the lights, never dimmable, and keeps the switch with no class out', () => {
    const house = buildHouse(casa2Hass(), CASA2_CONFIG);
    const escritorio = house.rooms.find((r) => r.areaId === 'escritorio')!;
    expect(escritorio.lights).toEqual([{ entityId: 'switch.escritorio_luz', name: 'Teto', dimmable: false }]);
    expect(escritorio.equipment).toEqual([]);
    expect(allLightIds(house)).toEqual(['switch.escritorio_luz', 'switch.varanda_luz']);
  });

  it('makes one appliance per device, in the room of its device, with its parts kept inside it', () => {
    const config = { ...CASA2_CONFIG, entities: { ...CASA2_CONFIG.entities, 'switch.lavadora_rinse': { role: 'appliance' } } };
    const terraco = buildHouse(casa2Hass(), config).rooms.find((r) => r.areaId === 'terraco')!;
    expect(terraco.appliances).toHaveLength(1);
    expect(terraco.appliances[0]).toMatchObject({
      deviceId: 'd_lavadora',
      entityId: 'sensor.lavadora_appliancestate',
      name: 'Lavadora',
      parts: { state: 'sensor.lavadora_appliancestate', remaining: 'sensor.lavadora_timetoend' },
    });
    expect(terraco.equipment).toEqual([]);
    expect(terraco.lights.map((l) => l.entityId)).toEqual(['switch.varanda_luz']);
  });

  it('places equipment and actions with the name and icon of the configuration, in rooms that have only them', () => {
    const h = makeHass({
      areas: [area('area_externa', 'Área externa'), area('rack', 'Rack')],
      entities: [
        { entity_id: 'switch.bomba', area_id: 'area_externa', state: 'off' },
        { entity_id: 'button.reiniciar', area_id: 'rack', state: 'unknown', attributes: { friendly_name: 'Reiniciar roteador' } },
      ],
    });
    const house = buildHouse(h, {
      entities: { 'switch.bomba': { role: 'equipment', name: 'Bomba', icon: 'mdi:pool' }, 'button.reiniciar': { role: 'action' } },
    });
    expect(house.rooms.map((r) => r.name)).toEqual(['Área externa', 'Rack']);
    expect(house.rooms[0]!.equipment).toEqual([{ entityId: 'switch.bomba', name: 'Bomba', icon: 'mdi:pool' }]);
    expect(house.rooms[1]!.actions).toEqual([{ entityId: 'button.reiniciar', name: 'Reiniciar roteador', icon: null }]);
  });

  it('draws the rooms by the profile, names the first tab after it and gives each room its floor', () => {
    const house = buildHouse(clinicHass(), CLINIC_CONFIG);
    expect(house.profile).toBe('clinic');
    expect(house.homeLabel).toBe('Início');
    expect(house.rooms.map((r) => [r.name, r.art, r.floorId])).toEqual([
      ['Consultório 3', 'consultorio', 'primeiro'],
      ['Espera', 'espera', 'terreo'],
      ['Esterilização', 'esterilizacao', 'primeiro'],
      ['Recepção', 'recepcao', 'terreo'],
      ['Sala 1', 'consultorio', 'primeiro'],
      ['Sala 2', 'consultorio', 'primeiro'],
    ]);
    expect(house.floors).toEqual([
      { floorId: 'terreo', name: 'Térreo' },
      { floorId: 'primeiro', name: '1º andar' },
    ]);
  });

  it('moves a room to another floor from the configuration', () => {
    const house = buildHouse(clinicHass(), { ...CLINIC_CONFIG, rooms: { espera: { floor: 'primeiro' } } });
    expect(house.rooms.find((r) => r.areaId === 'espera')!.floorId).toBe('primeiro');
  });

  it('fills the new fields of a dashboard frozen on 2026.10.3', () => {
    const frozen = {
      areaId: 'sala',
      path: 'sala',
      name: 'Sala',
      photo: null,
      icon: null,
      art: 'sala',
      lights: [],
      outlets: [],
      scenes: [],
    } as unknown as Room;
    expect(normalizeRoom(frozen)).toMatchObject({ floorId: null, equipment: [], appliances: [], actions: [] });
    const house = normalizeHouse({ name: 'Casa', rooms: [frozen], scenes: [], weatherEntityId: null } as unknown as House);
    expect(house).toMatchObject({ profile: 'home', homeLabel: 'Casa', floors: [] });
    expect(house.rooms[0]!.actions).toEqual([]);
  });

  it('names an item called only after its room by what it is, numbered when there are several', () => {
    const h = makeHass({
      areas: [area('banheiro', 'Banheiro'), area('quarto', 'Quarto'), area('sala', 'Sala')],
      devices: [device('d_ban', 'banheiro', 'Banheiro'), device('d_q1', 'quarto', 'Quarto'), device('d_q2', 'quarto', 'Quarto')],
      entities: [
        { entity_id: 'light.banheiro', device_id: 'd_ban', name: '', state: 'off', attributes: { friendly_name: 'Banheiro' } },
        { entity_id: 'switch.quarto_1', device_id: 'd_q1', name: '', state: 'off', attributes: { friendly_name: 'Quarto' } },
        { entity_id: 'switch.quarto_2', device_id: 'd_q2', name: '', state: 'off', attributes: { friendly_name: 'quarto' } },
        { entity_id: 'light.luminaria', area_id: 'quarto', name: 'Luminária', state: 'off' },
        { entity_id: 'switch.sala', area_id: 'sala', state: 'off', attributes: { friendly_name: 'Sala', device_class: 'outlet' } },
        { entity_id: 'light.sala', area_id: 'sala', state: 'off', attributes: { friendly_name: 'Sala' } },
      ],
    });
    const house = buildHouse(h, { entities: { 'switch.quarto_1': { role: 'light' }, 'switch.quarto_2': { role: 'light' }, 'light.sala': { name: 'Sala' } } });
    const room = (id: string) => house.rooms.find((r) => r.areaId === id)!;
    expect(names(room('banheiro').lights)).toEqual(['Luz']);
    expect(names(room('quarto').lights)).toEqual(['Luminária', 'Luz 1', 'Luz 2']);
    expect(names(room('sala').outlets)).toEqual(['Tomada']);
    expect(names(room('sala').lights)).toEqual(['Sala']);
  });

  it('orders the items of a block by the order of the configuration, then by name', () => {
    const h = makeHass({
      areas: [area('sala', 'Sala')],
      entities: [
        { entity_id: 'light.a', area_id: 'sala', name: 'Abajur', state: 'off' },
        { entity_id: 'light.b', area_id: 'sala', name: 'Teto', state: 'off' },
        { entity_id: 'light.c', area_id: 'sala', name: 'Pendente', state: 'off' },
      ],
    });
    const house = buildHouse(h, { entities: { 'light.c': { order: 1 }, 'light.b': { order: 2 } } });
    expect(names(house.rooms[0]!.lights)).toEqual(['Pendente', 'Teto', 'Abajur']);
  });

  it('keeps what the configuration hides within reach of the editor, but not what Home Assistant hides', () => {
    const h = makeHass({
      areas: [area('sala', 'Sala'), area('quarto', 'Quarto')],
      entities: [
        { entity_id: 'light.sofa', area_id: 'sala', name: 'Sofá', state: 'off' },
        { entity_id: 'light.mesa', area_id: 'sala', name: 'Mesa', state: 'off' },
        { entity_id: 'switch.jet', area_id: 'sala', name: 'Jet', state: 'off' },
        { entity_id: 'switch.original', area_id: 'sala', name: 'Original', state: 'off', hidden: true },
        { entity_id: 'light.cama', area_id: 'quarto', name: 'Cama', state: 'off' },
      ],
    });
    const house = buildHouse(h, {
      hide_entities: ['light.mesa'],
      entities: { 'switch.jet': { role: 'hidden' } },
      rooms: { quarto: { hidden: true } },
    });
    expect(house.rooms.find((r) => r.areaId === 'sala')!.hidden).toEqual([
      { entityId: 'switch.jet', name: 'Jet' },
      { entityId: 'light.mesa', name: 'Mesa' },
    ]);
    expect(house.hiddenRooms).toEqual([{ areaId: 'quarto', name: 'Quarto' }]);
  });
});
