import { describe, expect, it } from 'vitest';
import { buildHouse, hasSecurity, normalizeHouse, normalizeRoom } from '../../src/model/build-house';
import { classify, classifyContext } from '../../src/model/classify';
import { readConfig } from '../../src/model/config';
import { consumptionOf } from '../../src/model/energy';
import { reviewItems } from '../../src/model/review';
import type { House, Room } from '../../src/model/types';
import { area, device, makeHass } from '../helpers/fake-hass';

function house() {
  return makeHass({
    areas: [area('cozinha', 'Cozinha'), area('quarto', 'Quarto'), area('sala', 'Sala')],
    devices: [device('d_ar', 'quarto', 'Ar'), device('d_termo', 'quarto', 'Termômetro'), device('d_bl', 'sala', 'BL'), device('d_lav', 'sala', 'Lavadora')],
    entities: [
      { entity_id: 'light.cozinha', area_id: 'cozinha', name: 'Teto', state: 'off' },
      { entity_id: 'light.quarto', area_id: 'quarto', name: 'Teto', state: 'off' },
      { entity_id: 'binary_sensor.fumaca', area_id: 'cozinha', name: 'Fumaça', state: 'off', attributes: { device_class: 'smoke' } },
      { entity_id: 'binary_sensor.vazamento', name: 'Vazamento', state: 'off', attributes: { device_class: 'moisture' } },
      { entity_id: 'binary_sensor.janela', area_id: 'quarto', name: 'Janela', state: 'on', attributes: { device_class: 'window' } },
      { entity_id: 'binary_sensor.porta_fundos', name: 'Porta dos fundos', state: 'off', attributes: { device_class: 'door' } },
      { entity_id: 'binary_sensor.movimento', area_id: 'quarto', name: 'Movimento', state: 'on', attributes: { device_class: 'motion' } },
      { entity_id: 'binary_sensor.movimento_solto', name: 'Movimento', state: 'on', attributes: { device_class: 'motion' } },
      { entity_id: 'binary_sensor.defeito', area_id: 'quarto', name: 'Defeito', state: 'on', attributes: { device_class: 'problem' } },
      { entity_id: 'climate.ar', device_id: 'd_ar', state: 'off' },
      { entity_id: 'sensor.ar_temperatura', device_id: 'd_ar', state: '26', attributes: { device_class: 'temperature', unit_of_measurement: '°C' } },
      { entity_id: 'sensor.termo_temperatura', device_id: 'd_termo', state: '24.4', attributes: { device_class: 'temperature', unit_of_measurement: '°C' } },
      { entity_id: 'sensor.termo_umidade', device_id: 'd_termo', state: '61', attributes: { device_class: 'humidity', unit_of_measurement: '%' } },
      { entity_id: 'sensor.temperatura_solta', state: '20', attributes: { device_class: 'temperature' } },
      { entity_id: 'camera.garagem', name: 'Garagem', state: 'idle', attributes: { entity_picture: '/api/camera_proxy/camera.garagem?token=a' } },
      { entity_id: 'alarm_control_panel.alarme', name: 'Alarme', state: 'disarmed', attributes: { supported_features: 11, code_format: null } },
      { entity_id: 'switch.bl_1', device_id: 'd_bl', name: 'Tomada 1', state: 'on', attributes: { device_class: 'outlet' } },
      { entity_id: 'switch.bl_2', device_id: 'd_bl', name: 'Tomada 2', state: 'off', attributes: { device_class: 'outlet' } },
      { entity_id: 'sensor.bl_power_1', device_id: 'd_bl', state: '120', attributes: { device_class: 'power', unit_of_measurement: 'W' } },
      { entity_id: 'sensor.bl_power_2', device_id: 'd_bl', state: '0', attributes: { device_class: 'power', unit_of_measurement: 'W' } },
      { entity_id: 'sensor.bl_energy_1', device_id: 'd_bl', state: '10.2', attributes: { device_class: 'energy', unit_of_measurement: 'kWh', state_class: 'total_increasing' } },
      { entity_id: 'sensor.lav_estado', device_id: 'd_lav', state: 'Idle' },
      { entity_id: 'binary_sensor.lav_porta', device_id: 'd_lav', state: 'off', attributes: { device_class: 'door' } },
    ],
  });
}

const CONFIG = { entities: { 'sensor.lav_estado': { role: 'appliance' } } };

describe('M4 classification', () => {
  it('places alerts, openings, presence, temperature, humidity, cameras and alarms', () => {
    const h = house();
    const ctx = classifyContext(h, readConfig(h, CONFIG));
    const at = (id: string) => {
      const p = classify(h, id, ctx);
      return [p.block ?? p.why, p.areaId];
    };
    expect(at('binary_sensor.fumaca')).toEqual(['alert', 'cozinha']);
    expect(at('binary_sensor.vazamento')).toEqual(['alert', null]);
    expect(at('binary_sensor.janela')).toEqual(['opening', 'quarto']);
    expect(at('binary_sensor.porta_fundos')).toEqual(['opening', null]);
    expect(at('binary_sensor.movimento')).toEqual(['presence', 'quarto']);
    expect(at('binary_sensor.movimento_solto')).toEqual(['unsupported', null]);
    expect(at('binary_sensor.defeito')[0]).toBe('unsupported');
    expect(at('sensor.termo_temperatura')).toEqual(['temperature', 'quarto']);
    expect(at('sensor.termo_umidade')).toEqual(['humidity', 'quarto']);
    expect(at('sensor.temperatura_solta')).toEqual(['unsupported', null]);
    expect(at('camera.garagem')).toEqual(['camera', null]);
    expect(at('alarm_control_panel.alarme')).toEqual(['alarm', null]);
    expect(at('binary_sensor.lav_porta')[0]).toBe('part');
  });

  it('does not send roomless sensors to the review', () => {
    const h = house();
    const ids = reviewItems(h, CONFIG).map((i) => i.entityId);
    expect(ids).not.toContain('sensor.temperatura_solta');
    expect(ids).not.toContain('binary_sensor.movimento_solto');
  });
});

describe('M4 house data', () => {
  it('gives each room its openings, presence, temperature and humidity, the dedicated thermometer first', () => {
    const built = buildHouse(house(), CONFIG);
    const quarto = built.rooms.find((r) => r.areaId === 'quarto')!;
    expect(quarto.openings).toEqual([{ entityId: 'binary_sensor.janela', name: 'Janela', kind: 'window', roomName: 'Quarto', path: 'quarto' }]);
    expect(quarto.presence).toEqual(['binary_sensor.movimento']);
    expect([quarto.temperature, quarto.humidity]).toEqual(['sensor.termo_temperatura', 'sensor.termo_umidade']);
  });

  it('lists the alerts of the house, a roomless one leading to the security tab', () => {
    const built = buildHouse(house(), CONFIG);
    expect(built.alerts).toEqual([
      { entityId: 'alarm_control_panel.alarme', kind: 'alarm', roomName: null, path: null },
      { entityId: 'binary_sensor.fumaca', kind: 'smoke', roomName: 'Cozinha', path: 'cozinha' },
      { entityId: 'binary_sensor.vazamento', kind: 'moisture', roomName: null, path: null },
    ]);
  });

  it('builds the security slice: alarms, cameras, every opening and the access of every room', () => {
    const built = buildHouse(house(), CONFIG);
    expect(built.security.alarms).toEqual([{ entityId: 'alarm_control_panel.alarme', name: 'Alarme' }]);
    expect(built.security.cameras).toEqual([{ entityId: 'camera.garagem', name: 'Garagem', roomName: null }]);
    expect(built.security.openings.map((o) => [o.entityId, o.roomName])).toEqual([
      ['binary_sensor.janela', 'Quarto'],
      ['binary_sensor.porta_fundos', null],
    ]);
    expect(hasSecurity(built)).toBe(true);
    const bare = buildHouse(makeHass({ areas: [area('sala', 'Sala')], entities: [{ entity_id: 'light.sala', area_id: 'sala', state: 'off' }] }));
    expect(hasSecurity(bare)).toBe(false);
  });

  it('does not show a room that only has sensors', () => {
    const h = makeHass({
      areas: [area('lavabo', 'Lavabo')],
      entities: [{ entity_id: 'sensor.lavabo_temp', area_id: 'lavabo', state: '22', attributes: { device_class: 'temperature' } }],
    });
    expect(buildHouse(h).rooms).toEqual([]);
  });

  it('matches power and energy to the outlet of the same channel', () => {
    const h = house();
    expect(consumptionOf(h, 'switch.bl_1')).toEqual({ power: 'sensor.bl_power_1', energy: 'sensor.bl_energy_1' });
    expect(consumptionOf(h, 'switch.bl_2')).toEqual({ power: 'sensor.bl_power_2', energy: null });
    const sala = buildHouse(h, CONFIG).rooms.find((r) => r.areaId === 'sala')!;
    expect(sala.outlets.map((o) => [o.entityId, o.power, o.energy])).toEqual([
      ['switch.bl_1', 'sensor.bl_power_1', 'sensor.bl_energy_1'],
      ['switch.bl_2', 'sensor.bl_power_2', null],
    ]);
  });

  it('matches a lone switch and a lone sensor, and takes the sensors named in the YAML', () => {
    const h = makeHass({
      devices: [device('d_t', 'sala', 'T'), device('d_k', 'sala', 'K')],
      entities: [
        { entity_id: 'switch.t', device_id: 'd_t', state: 'on' },
        { entity_id: 'sensor.t_w', device_id: 'd_t', state: '5', attributes: { device_class: 'power' } },
        { entity_id: 'switch.kitnet_banheiro', device_id: 'd_k', state: 'on' },
        { entity_id: 'switch.kitnet_lavanderia', device_id: 'd_k', state: 'on' },
        { entity_id: 'sensor.k_power_1', device_id: 'd_k', state: '7', attributes: { device_class: 'power' } },
        { entity_id: 'sensor.k_power_2', device_id: 'd_k', state: '8', attributes: { device_class: 'power' } },
      ],
    });
    expect(consumptionOf(h, 'switch.t')).toEqual({ power: 'sensor.t_w', energy: null });
    expect(consumptionOf(h, 'switch.kitnet_banheiro')).toEqual({ power: null, energy: null });
    const cfg = readConfig(h, { entities: { 'switch.kitnet_banheiro': { power: 'sensor.k_power_1' } } });
    expect(consumptionOf(h, 'switch.kitnet_banheiro', cfg.entities['switch.kitnet_banheiro'])).toEqual({ power: 'sensor.k_power_1', energy: null });
    expect(readConfig(h, { entities: { 'switch.t': { power: 'sensor.nada' } } }).problems.map((p) => p.key)).toEqual(['entities.switch.t.power']);
  });

  it('fills the M4 fields of a house and a room frozen on 2026.10.7', () => {
    const room = normalizeRoom({ areaId: 'sala', path: 'sala', name: 'Sala', lights: [] } as unknown as Room);
    expect([room.openings, room.presence, room.temperature, room.humidity]).toEqual([[], [], null, null]);
    const old = normalizeHouse({ name: 'Casa', rooms: [], scenes: [] } as unknown as House);
    expect(old.alerts).toEqual([]);
    expect(old.security).toEqual({ alarms: [], cameras: [], openings: [], access: [] });
  });
});
