import { area, device, makeHass, type FakeEntity, type FakeHass } from '../helpers/fake-hass';

/**
 * A sample house shaped like a real two-module ControlArt install after normalization: each relay
 * output carries the name and the area its old helper had. Corredor and "Saída 2.10" have no area on
 * purpose; the three *_screen lights are what browser_mod creates for each browser.
 */
const LIGHTS: Array<[string, string, string | null]> = [
  ['light.hubb_m1_saida_1', 'Sofa', 'sala_de_estar'],
  ['light.hubb_m1_saida_2', 'Quadro', 'sala_de_estar'],
  ['light.hubb_m1_saida_3', 'LED', 'sala_de_estar'],
  ['light.hubb_m1_saida_4', 'Pendente', 'sala_de_estar'],
  ['light.hubb_m1_saida_5', 'Escada', 'sala_de_estar'],
  ['light.hubb_m1_saida_6', 'Lustre', 'sala_de_estar'],
  ['light.hubb_m1_saida_7', 'Cozinha', 'cozinha'],
  ['light.hubb_m1_saida_8', 'Bancada', 'cozinha'],
  ['light.hubb_m1_saida_9', 'Spot Bancada', 'cozinha'],
  ['light.hubb_m1_saida_10', 'Aparador', 'sala_de_estar'],
  ['light.hubb_m2_saida_1', 'Pendente E', 'quarto'],
  ['light.hubb_m2_saida_2', 'Cama', 'quarto'],
  ['light.hubb_m2_saida_3', 'Pendente D', 'quarto'],
  ['light.hubb_m2_saida_4', 'Entrada', 'quarto'],
  ['light.hubb_m2_saida_5', 'Painel TV', 'quarto'],
  ['light.hubb_m2_saida_6', 'Arandela', 'quarto'],
  ['light.hubb_m2_saida_7', 'Varanda', 'quarto'],
  ['light.hubb_m2_saida_8', 'Corredor', null],
  ['light.hubb_m2_saida_9', 'LED', 'cozinha'],
  ['light.hubb_m2_saida_10', 'Saída 2.10', null],
];

export function sampleHouseHass(): FakeHass {
  const entities: FakeEntity[] = LIGHTS.map(([entity_id, name, area_id]) => ({
    entity_id,
    name,
    area_id,
    device_id: entity_id.includes('_m1_') ? 'dev_m1' : 'dev_m2',
    state: entity_id === 'light.hubb_m1_saida_7' ? 'on' : 'off',
    attributes: { friendly_name: name, supported_color_modes: ['onoff'] },
  }));
  for (const browser of ['celular', 'tablet', 'notebook']) {
    entities.push({
      entity_id: `light.${browser}_screen`,
      device_id: `dev_${browser}`,
      state: 'unavailable',
      attributes: { friendly_name: 'Screen' },
    });
  }
  entities.push({
    entity_id: 'weather.forecast_home',
    device_id: 'dev_forecast',
    state: 'partlycloudy',
    attributes: { friendly_name: 'Previsão', temperature: 23.6 },
  });
  return makeHass({
    areas: [area('cozinha', 'Cozinha'), area('quarto', 'Quarto'), area('sala_de_estar', 'Sala')],
    devices: [
      device('dev_m1', null, 'Hubb M1'),
      device('dev_m2', null, 'Hubb M2'),
      device('dev_celular', null, 'Celular'),
      device('dev_tablet', null, 'Tablet'),
      device('dev_notebook', null, 'Notebook'),
      device('dev_forecast', null, 'Forecast'),
    ],
    entities,
    locationName: 'Casa',
  });
}
