import { describe, expect, it } from 'vitest';
import { buildHouse } from '../../src/model/build-house';
import { summaryPills } from '../../src/model/pills';
import { climateOn } from '../../src/summary';
import { area, makeHass, type FakeEntity } from '../helpers/fake-hass';

function house(extra: FakeEntity[] = []) {
  const h = makeHass({
    areas: [area('sala', 'Sala'), area('cozinha', 'Cozinha'), area('quarto', 'Quarto')],
    entities: [
      { entity_id: 'light.teto', area_id: 'sala', name: 'Teto', state: 'on' },
      { entity_id: 'light.abajur', area_id: 'sala', name: 'Abajur', state: 'on' },
      { entity_id: 'light.bancada', area_id: 'cozinha', name: 'Bancada', state: 'on' },
      { entity_id: 'light.cama', area_id: 'quarto', name: 'Cama', state: 'on' },
      { entity_id: 'climate.ar_sala', area_id: 'sala', name: 'Ar', state: 'cool', attributes: { hvac_modes: ['off', 'cool'], temperature: 23 } },
      { entity_id: 'climate.ar_quarto', area_id: 'quarto', name: 'Ar', state: 'off', attributes: { hvac_modes: ['off', 'cool'], temperature: 24 } },
      { entity_id: 'fan.teto', area_id: 'quarto', name: 'Ventilador', state: 'on' },
      { entity_id: 'binary_sensor.janela', area_id: 'quarto', name: 'Janela', state: 'on', attributes: { device_class: 'window' } },
      { entity_id: 'sensor.consumo', name: 'Consumo da casa', state: '1234', attributes: { device_class: 'power', unit_of_measurement: 'W' } },
      ...extra,
    ],
  });
  return { h, house: buildHouse(h) };
}

describe('the summary of the house, in pills', () => {
  it('air conditioners on, with their room and target: fans and the ones off do not count', () => {
    const { h, house: b } = house();
    expect(climateOn(b.rooms, h).map((c) => [c.item.entityId, c.roomName, c.target])).toEqual([['climate.ar_sala', 'Sala', 23]]);
  });

  it('lights, air conditioners, what is open and the power now', () => {
    const { h, house: b } = house();
    expect(summaryPills(b, h, { security: true, housePower: 'sensor.consumo' })).toEqual([
      { kind: 'lights', title: '4 acesas', detail: 'Cozinha, Quarto e mais 1' },
      { kind: 'climate', title: '1 ar ligado', detail: 'Sala em 23°' },
      { kind: 'security', title: '1 aberto', detail: 'Janela aberta · Quarto' },
      { kind: 'energy', title: '1,2 kW', detail: 'Consumo agora' },
    ]);
  });

  it('a pill with nothing to say leaves: no light on, no air on, no security tab, no meter', () => {
    const { h, house: b } = house();
    for (const id of ['light.teto', 'light.abajur', 'light.bancada', 'light.cama']) h.states[id] = { ...h.states[id]!, state: 'off' };
    h.states['climate.ar_sala'] = { ...h.states['climate.ar_sala']!, state: 'off' };
    expect(summaryPills(b, h, { security: false, housePower: null })).toEqual([]);
  });

  it('two rooms read "Sala e Cozinha"; all closed says so, with the state of the alarm', () => {
    const { h, house: b } = house([{ entity_id: 'alarm_control_panel.casa', name: 'Alarme', state: 'armed_away', attributes: {} }]);
    h.states['light.cama'] = { ...h.states['light.cama']!, state: 'off' };
    h.states['binary_sensor.janela'] = { ...h.states['binary_sensor.janela']!, state: 'off' };
    const pills = summaryPills(b, h, { security: true, housePower: null });
    expect(pills.find((p) => p.kind === 'lights')).toEqual({ kind: 'lights', title: '3 acesas', detail: 'Cozinha e Sala' });
    expect(pills.find((p) => p.kind === 'security')).toEqual({ kind: 'security', title: 'Tudo fechado', detail: 'Armado ausente' });
  });

  it('less than a kilowatt reads in watts', () => {
    const { h, house: b } = house();
    h.states['sensor.consumo'] = { ...h.states['sensor.consumo']!, state: '850.4' };
    expect(summaryPills(b, h, { security: false, housePower: 'sensor.consumo' }).find((p) => p.kind === 'energy')?.title).toBe('850 W');
  });
});
