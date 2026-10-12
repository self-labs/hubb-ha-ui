import { describe, expect, it } from 'vitest';
import { allLightIds, buildHouse } from '../../src/model/build-house';
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
