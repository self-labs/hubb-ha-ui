import type { HubbConfig } from '../../src/model/types';
import { area, floor, makeHass, type FakeEntity, type FakeHass } from '../helpers/fake-hass';

/** "Clínica Exemplo": two floors, a switch with no class and one outlet. Anonymous on purpose. */
export const CLINIC_CONFIG: HubbConfig = { name: 'Clínica Exemplo', profile: 'clinic' };

export function clinicHass(): FakeHass {
  const light = (entity_id: string, name: string, area_id: string, state = 'off'): FakeEntity => ({
    entity_id,
    name,
    area_id,
    state,
    attributes: { friendly_name: name, supported_color_modes: ['onoff'] },
  });
  return makeHass({
    floors: [floor('terreo', 'Térreo', 0), floor('primeiro', '1º andar', 1)],
    areas: [
      area('recepcao', 'Recepção', null, 'terreo'),
      area('espera', 'Espera', null, 'terreo'),
      area('sala_1', 'Sala 1', null, 'primeiro'),
      area('sala_2', 'Sala 2', null, 'primeiro'),
      area('consultorio_3', 'Consultório 3', null, 'primeiro'),
      area('esterilizacao', 'Esterilização', null, 'primeiro'),
    ],
    entities: [
      light('light.recepcao_teto', 'Teto', 'recepcao', 'on'),
      light('light.recepcao_balcao', 'Balcão', 'recepcao', 'on'),
      light('light.espera_teto', 'Teto', 'espera'),
      light('light.sala_1_teto', 'Teto', 'sala_1', 'on'),
      light('light.sala_2_teto', 'Teto', 'sala_2'),
      light('light.consultorio_3_teto', 'Teto', 'consultorio_3'),
      light('light.esterilizacao_teto', 'Teto', 'esterilizacao'),
      { entity_id: 'switch.autoclave', name: 'Autoclave', area_id: 'esterilizacao', state: 'off' },
      { entity_id: 'switch.recepcao_tomada', name: 'Tomada', area_id: 'recepcao', state: 'on', attributes: { device_class: 'outlet' } },
    ],
    locationName: 'Clínica',
  });
}
