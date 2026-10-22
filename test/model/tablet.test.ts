import { describe, expect, it } from 'vitest';
import { buildHouse } from '../../src/model/build-house';
import { readConfig } from '../../src/model/config';
import { platformOf, resolveTablet, restDue, screenCalls, wakesOn } from '../../src/model/tablet';
import type { HubbConfig } from '../../src/model/types';
import { area, device, makeHass, withState, type FakeHass } from '../helpers/fake-hass';

const MIN = 60_000;

function house(): FakeHass {
  const h = makeHass({
    areas: [area('sala', 'Sala'), area('quarto', 'Quarto')],
    devices: [
      { ...device('d_ipad', null, 'iPad da Lia'), manufacturer: 'Apple' },
      { ...device('d_moto', null, 'Moto da Lia'), manufacturer: 'Motorola' },
    ],
    entities: [
      { entity_id: 'light.teto', area_id: 'sala', name: 'Teto', state: 'off' },
      { entity_id: 'light.cama', area_id: 'quarto', name: 'Cama', state: 'off' },
      { entity_id: 'binary_sensor.presenca_sala', area_id: 'sala', name: 'Presença', state: 'off', attributes: { device_class: 'occupancy' } },
      { entity_id: 'binary_sensor.movimento_ipad', name: 'iPad', state: 'off', attributes: { device_class: 'motion' } },
    ],
  });
  h.services = { notify: { mobile_app_ipad_da_lia: {}, mobile_app_moto_da_lia: {} } };
  return h;
}

describe('the wall tablet of a user', () => {
  it('sends the exact commands of the Home Assistant app, by platform', () => {
    expect(screenCalls('ios', 'rest')).toEqual([{ message: 'kiosk_set_brightness', data: { level: 5 } }]);
    expect(screenCalls('ios', 'wake')).toEqual([{ message: 'kiosk_set_brightness', data: { level: 80 } }]);
    expect(screenCalls('android', 'rest')).toEqual([
      { message: 'command_auto_screen_brightness', data: { command: 'turn_off' } },
      { message: 'command_screen_brightness_level', data: { command: 10 } },
    ]);
    expect(screenCalls('android', 'wake')).toEqual([
      { message: 'command_screen_on', data: { command: 'keep_screen_on' } },
      { message: 'command_auto_screen_brightness', data: { command: 'turn_on' } },
    ]);
  });

  it('tells an iPad from an Android by the maker of the device behind the notify service', () => {
    const h = house();
    expect(platformOf(h, 'mobile_app_ipad_da_lia')).toBe('ios');
    expect(platformOf(h, 'mobile_app_moto_da_lia')).toBe('android');
    expect(platformOf(h, 'mobile_app_outro')).toBeNull();
  });

  it('rests after the minutes with no touch, never with 0', () => {
    const t0 = Date.parse('2026-10-21T12:00:00Z');
    expect(restDue(t0, t0 + 5 * MIN - 1000, 5)).toBe(false);
    expect(restDue(t0, t0 + 5 * MIN, 5)).toBe(true);
    expect(restDue(t0, t0 + 999 * MIN, 0)).toBe(false);
  });

  it.each([
    ['off', 'on', true],
    ['unavailable', 'on', false],
    ['unknown', 'on', false],
    ['on', 'on', false],
    ['on', 'off', false],
  ])('presence from %s to %s wakes it: %s', (from, to, wakes) => {
    const h = withState(house(), 'binary_sensor.presenca_sala', to);
    expect(wakesOn({ 'binary_sensor.presenca_sala': from }, h, ['binary_sensor.presenca_sala'])).toBe(wakes);
  });

  it('resolves the tablet of the user who sees the panel, with the defaults', () => {
    const h = house();
    const config: HubbConfig = { tablets: { u_lia: { room: 'quarto', notify: 'mobile_app_ipad_da_lia' } } };
    const rooms = buildHouse(h, config).rooms;
    expect(resolveTablet(h, config, rooms, 'u_lia')).toEqual({ room: 'quarto', restAfter: 5, presence: [], notify: 'mobile_app_ipad_da_lia', platform: 'ios' });
    expect(resolveTablet(h, config, rooms, 'u_outro')).toBeNull();
    // With no presence chosen, the sensors of its room; 'none' turns them off; one entity, that one.
    const sala: HubbConfig = { tablets: { u_lia: { room: 'sala' } } };
    expect(resolveTablet(h, sala, rooms, 'u_lia')?.presence).toEqual(['binary_sensor.presenca_sala']);
    expect(resolveTablet(h, { tablets: { u_lia: { room: 'sala', presence: 'none' } } }, rooms, 'u_lia')?.presence).toEqual([]);
    expect(resolveTablet(h, { tablets: { u_lia: { room: 'sala', presence: 'binary_sensor.movimento_ipad' } } }, rooms, 'u_lia')?.presence).toEqual([
      'binary_sensor.movimento_ipad',
    ]);
  });

  it('drops what points nowhere: a room deleted or hidden for the user, a notify service that is gone', () => {
    const h = house();
    const config: HubbConfig = { tablets: { u_lia: { room: 'garagem', notify: 'mobile_app_sumiu', rest_after: 5 } } };
    const t = resolveTablet(h, config, buildHouse(h, config).rooms, 'u_lia');
    expect(t?.room).toBeNull();
    expect(t?.notify).toBeNull();
    expect(t?.platform).toBeNull();
    // A room that exists but is not on the list of the user (hidden for them).
    const onlySala = buildHouse(h).rooms.filter((r) => r.areaId === 'sala');
    expect(resolveTablet(h, { tablets: { u_lia: { room: 'quarto' } } }, onlySala, 'u_lia')?.room).toBeNull();
  });

  it('Revisar lists what is wrong in tablets', () => {
    const h = house();
    const problems = readConfig(h, { tablets: { u_lia: { room: 'garagem', rest_after: 7, notify: 'mobile_app_sumiu' } } }).problems.map((p) => p.key);
    expect(problems).toEqual(['tablets.u_lia.room', 'tablets.u_lia.rest_after', 'tablets.u_lia.notify']);
  });
});
