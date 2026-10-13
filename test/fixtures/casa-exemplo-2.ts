import type { HubbConfig } from '../../src/model/types';
import { area, device, makeHass, type FakeHass } from '../helpers/fake-hass';
import { washerEntities } from './washer';

/**
 * "Casa Exemplo 2", shaped like Gustavo's house on 12/10/2026 and anonymous: relay lights seen as
 * `switch` and given the light role, a switch with no class ("Jet mode"), and an Electrolux-shaped
 * washer in the Terraço.
 */
export const CASA2_CONFIG: HubbConfig = {
  name: 'Casa Exemplo 2',
  entities: {
    'switch.escritorio_luz': { role: 'light' },
    'switch.varanda_luz': { role: 'light' },
    'sensor.lavadora_appliancestate': { role: 'appliance' },
  },
};

export function casa2Hass(state = 'Running', minutes = '40'): FakeHass {
  return makeHass({
    areas: [area('escritorio', 'Escritório'), area('terraco', 'Terraço')],
    devices: [device('d_modulo', 'escritorio', 'Módulo'), device('d_lavadora', 'terraco', 'Lavadora')],
    entities: [
      { entity_id: 'switch.escritorio_luz', device_id: 'd_modulo', name: 'Teto', state: 'on' },
      { entity_id: 'switch.varanda_luz', area_id: 'terraco', name: 'Varanda', state: 'off' },
      { entity_id: 'switch.jet_mode', device_id: 'd_modulo', name: 'Jet mode', state: 'off' },
      ...washerEntities('d_lavadora', state, minutes),
    ],
    locationName: 'Casa',
  });
}
