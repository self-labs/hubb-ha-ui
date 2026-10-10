import { describe, expect, it } from 'vitest';
import { displayName } from '../../src/model/names';
import { device, makeHass } from '../helpers/fake-hass';

describe('displayName', () => {
  it('uses the name set in the registry', () => {
    const hass = makeHass({
      entities: [{ entity_id: 'light.a', name: 'Sofá', state: 'off', attributes: { friendly_name: 'Hubb M1 Sofá' } }],
    });
    expect(displayName(hass, 'light.a', null)).toBe('Sofá');
  });

  it('drops the device name from the friendly name', () => {
    const hass = makeHass({
      devices: [device('d1', null, 'Hubb M1')],
      entities: [{ entity_id: 'light.a', device_id: 'd1', state: 'off', attributes: { friendly_name: 'Hubb M1 Saída 1' } }],
    });
    expect(displayName(hass, 'light.a', null)).toBe('Saída 1');
  });

  it('drops the room name at the start or at the end, ignoring case', () => {
    const hass = makeHass({
      entities: [
        { entity_id: 'light.a', name: 'LED Sala', state: 'off' },
        { entity_id: 'light.b', name: 'Sala LED', state: 'off' },
        { entity_id: 'light.c', name: 'led sala', state: 'off' },
      ],
    });
    expect(displayName(hass, 'light.a', 'Sala')).toBe('LED');
    expect(displayName(hass, 'light.b', 'Sala')).toBe('LED');
    expect(displayName(hass, 'light.c', 'Sala')).toBe('led');
  });

  it('keeps a name that is only the room name', () => {
    const hass = makeHass({ entities: [{ entity_id: 'light.a', name: 'Cozinha', state: 'off' }] });
    expect(displayName(hass, 'light.a', 'Cozinha')).toBe('Cozinha');
  });

  it('trims stray spaces', () => {
    const hass = makeHass({ entities: [{ entity_id: 'light.a', name: '  Pendente E  ', state: 'off' }] });
    expect(displayName(hass, 'light.a', null)).toBe('Pendente E');
  });

  it('falls back to the object id when there is no name and no state', () => {
    const hass = makeHass({ entities: [{ entity_id: 'light.spot_bancada' }] });
    expect(displayName(hass, 'light.spot_bancada', null)).toBe('spot_bancada');
  });
});
