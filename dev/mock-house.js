// A fictional house for the preview: every name, room and value is made up. Nothing here comes from a
// client. It feeds dev/preview.html, which draws the real bundle (dist/hubb-ha-ui.js) for screenshots.

/** Washer states the Electrolux integration leaves in English, read the way Home Assistant would. */
const PT = {
  normal: 'Normal',
  colors: 'Coloridas',
  whites: 'Brancas',
  quick: 'Rápido',
  low: 'Baixo',
  medium: 'Médio',
  high: 'Alto',
  Running: 'Lavando',
  Idle: 'Parada',
};

const area = (area_id, name) => ({ area_id, name, picture: null, icon: null, floor_id: null });

/**
 * @param {URLSearchParams} q  theme=light, admin=1, alert=1, offline=1, code=1 (alarm with a code), alarm=<state>
 */
export function mockHouse(q) {
  const entities = {};
  const states = {};
  const devices = {};
  const add = (id, name, where, state, attributes = {}, extra = {}) => {
    entities[id] = { entity_id: id, labels: [], name, ...where, ...extra };
    states[id] = { entity_id: id, state, attributes: { friendly_name: name, ...attributes }, last_changed: new Date().toISOString() };
  };
  const at = (area_id) => ({ area_id });
  const dimmable = { supported_color_modes: ['color_temp'], min_color_temp_kelvin: 2200, max_color_temp_kelvin: 6500 };
  const colour = { supported_color_modes: ['hs', 'color_temp'], min_color_temp_kelvin: 2200, max_color_temp_kelvin: 6500 };

  const areas = Object.fromEntries(
    [
      ['sala', 'Sala'],
      ['cozinha', 'Cozinha'],
      ['quarto', 'Quarto'],
      ['varanda', 'Varanda'],
      ['entrada', 'Entrada'],
      ['escritorio', 'Escritório'],
      ['lavanderia', 'Lavanderia'],
    ].map(([id, name]) => [id, area(id, name)]),
  );

  // Lights
  add('light.sala_teto', 'Teto', at('sala'), 'on', { ...dimmable, brightness: 178, color_mode: 'color_temp', color_temp_kelvin: 2700 });
  add('light.sala_fita', 'Fita LED', at('sala'), 'on', { ...colour, brightness: 140, color_mode: 'hs', hs_color: [330, 60], rgb_color: [255, 102, 179] });
  add('light.sala_abajur', 'Abajur', at('sala'), 'off', dimmable);
  add('light.cozinha_bancada', 'Bancada', at('cozinha'), 'on', { ...dimmable, brightness: 255, color_mode: 'color_temp', color_temp_kelvin: 4000 });
  add('light.cozinha_pendentes', 'Pendentes', at('cozinha'), 'off', dimmable);
  add('light.quarto_teto', 'Teto', at('quarto'), 'off', dimmable);
  add('light.quarto_cabeceira', 'Cabeceira', at('quarto'), 'on', { ...dimmable, brightness: 77, color_mode: 'color_temp', color_temp_kelvin: 2700 });
  add('light.varanda_arandelas', 'Arandelas', at('varanda'), 'off', { supported_color_modes: ['onoff'] });
  add('light.escritorio_spots', 'Spots', at('escritorio'), 'off', dimmable);
  add('light.entrada_hall', 'Hall', at('entrada'), 'off', { supported_color_modes: ['onoff'] });

  // Scenes, labelled for the panel
  const scene = (id, name, areaId, members) =>
    add(id, name, areaId ? at(areaId) : {}, 'unknown', { entity_id: members }, { labels: ['hubb_cena'] });
  scene('scene.chegar', 'Chegar em casa', null, ['light.entrada_hall', 'light.sala_teto', 'light.cozinha_bancada']);
  scene('scene.cinema', 'Cinema', 'sala', ['light.sala_teto', 'light.sala_fita']);
  scene('scene.jantar', 'Jantar', 'cozinha', ['light.cozinha_pendentes', 'light.sala_abajur']);
  scene('scene.boa_noite', 'Boa noite', null, ['light.quarto_cabeceira', 'light.sala_teto']);

  // Climate, curtains, media
  add('climate.sala_ar', 'Ar', { area_id: 'sala', platform: 'lg_thinq' }, 'cool', {
    hvac_modes: ['off', 'cool', 'heat', 'auto', 'dry', 'fan_only'],
    hvac_action: 'cooling',
    temperature: 23,
    current_temperature: 27,
    target_temp_step: 1,
    min_temp: 16,
    max_temp: 30,
    fan_modes: ['auto', 'low', 'medium', 'high'],
    fan_mode: 'auto',
    swing_modes: ['off', 'vertical'],
    swing_mode: 'vertical',
    supported_features: 1 | 8 | 32 | 128 | 256,
  });
  add('climate.quarto_ar', 'Ar', at('quarto'), 'off', {
    hvac_modes: ['off', 'cool', 'dry'],
    temperature: 22,
    current_temperature: 25,
    supported_features: 1 | 128 | 256,
  });
  add('fan.varanda', 'Ventilador', at('varanda'), 'on', { percentage: 50, supported_features: 1 | 16 | 32 });
  add('cover.sala_cortina', 'Cortina', at('sala'), 'open', { device_class: 'curtain', current_position: 60, supported_features: 15 });
  add('media_player.sala_tv', 'TV', at('sala'), 'playing', {
    device_class: 'tv',
    media_title: 'Jornal da Noite',
    volume_level: 0.35,
    is_volume_muted: false,
    source: 'TV aberta',
    source_list: ['TV aberta', 'Streaming', 'HDMI 1'],
    supported_features: 1 | 4 | 8 | 16 | 32 | 128 | 256 | 2048 | 16384,
  });

  // Access and security
  add('cover.entrada_portao', 'Portão', at('entrada'), 'closed', { device_class: 'gate', supported_features: 3 });
  add('lock.entrada_fechadura', 'Fechadura', at('entrada'), 'locked', {});
  add('binary_sensor.entrada_porta', 'Porta da frente', at('entrada'), 'off', { device_class: 'door' });
  add('binary_sensor.quarto_janela', 'Janela', at('quarto'), 'on', { device_class: 'window' });
  add('binary_sensor.quarto_presenca', 'Presença', at('quarto'), 'on', { device_class: 'motion' });
  add('sensor.quarto_temperatura', 'Temperatura', at('quarto'), '24.4', { device_class: 'temperature', unit_of_measurement: '°C' });
  add('sensor.quarto_umidade', 'Umidade', at('quarto'), '61', { device_class: 'humidity', unit_of_measurement: '%' });
  add('sensor.sala_temperatura', 'Temperatura', at('sala'), '25.1', { device_class: 'temperature', unit_of_measurement: '°C' });
  add('binary_sensor.cozinha_fumaca', 'Fumaça', at('cozinha'), q.get('alert') === '1' ? 'on' : 'off', { device_class: 'smoke' });
  add('alarm_control_panel.alarme', 'Alarme', {}, q.get('alarm') ?? 'armed_away', {
    supported_features: 1 | 2 | 4,
    code_format: q.get('code') === '1' ? 'number' : null,
  });
  add('camera.garagem', 'Garagem', {}, 'idle', { entity_picture: '/dev/images/camera-garagem.svg' });
  add('camera.quintal', 'Quintal', at('varanda'), 'idle', { entity_picture: '/dev/images/camera-quintal.svg' });

  // Outlets and equipment, with consumption
  devices.d_tomada = { id: 'd_tomada', area_id: 'escritorio', name: 'Tomada do escritório', name_by_user: null };
  add('switch.escritorio_tomada', 'Computador', { device_id: 'd_tomada' }, 'on', { device_class: 'outlet' });
  add('sensor.escritorio_tomada_potencia', 'Potência', { device_id: 'd_tomada' }, '120', { device_class: 'power', unit_of_measurement: 'W' });
  add('sensor.escritorio_tomada_energia', 'Energia', { device_id: 'd_tomada' }, '84.2', {
    device_class: 'energy',
    unit_of_measurement: 'kWh',
    state_class: 'total_increasing',
  });
  add('switch.cozinha_cafeteira', 'Cafeteira', at('cozinha'), 'off', {});
  // What "Revisar o painel" has to show: a switch with no class and no role, a light with no room.
  add('switch.varanda_bomba', 'Bomba da piscina', at('varanda'), 'off', {});
  add('switch.varanda_luz_jardim', 'Luz do jardim', at('varanda'), 'off', {});
  add('light.garagem_spot', 'Spot da garagem', {}, 'off', { supported_color_modes: ['onoff'] });

  // A washer shaped like the Electrolux catalogue
  devices.d_lavadora = { id: 'd_lavadora', area_id: 'lavanderia', name: 'Lavadora', name_by_user: null };
  const w = (id, state, name, attributes = {}, extra = {}) =>
    add(id, null, { device_id: 'd_lavadora' }, state, { friendly_name: `Lavadora ${name}`, ...attributes }, { platform: 'electrolux_status', ...extra });
  w('sensor.lavadora_estado', 'Running', 'Estado', {}, { translation_key: 'appliance_state' });
  w('sensor.lavadora_conexao', 'Connected', 'Conexão', {}, { translation_key: 'connectivity_state', entity_category: 'diagnostic' });
  w('sensor.lavadora_controle', q.get('remote') ?? 'Enabled', 'Controle remoto', {}, { translation_key: 'remote_control' });
  w('sensor.lavadora_tempo', '40', 'Tempo restante', { device_class: 'duration', unit_of_measurement: 'min' }, { entity_category: 'diagnostic' });
  w('select.lavadora_programa', 'colors', 'Programa', { options: ['normal', 'colors', 'whites', 'quick'] });
  w('select.lavadora_nivel', 'high', 'Nível de roupas', { options: ['low', 'medium', 'high'] });
  w('switch.lavadora_enxague', 'on', 'Enxágue extra');
  w('switch.lavadora_turbo', 'off', 'Turbo centrifugação');
  w('switch.lavadora_reuso', 'off', 'Reuso de água');
  ['Desligar', 'Ligar', 'Pausar', 'Continuar', 'Iniciar', 'Parar'].forEach((n, i) =>
    w(`button.lavadora_comando_${i + 1}`, 'unknown', n),
  );

  entities['weather.casa'] = { entity_id: 'weather.casa', labels: [] };
  states['weather.casa'] = { entity_id: 'weather.casa', state: 'sunny', attributes: { temperature: 24 } };

  const hass = {
    states,
    entities,
    devices,
    areas,
    floors: {},
    user: { id: 'preview', name: 'Ana Souza', is_admin: q.get('admin') === '1' },
    themes: { darkMode: q.get('theme') !== 'light' },
    config: { location_name: 'Casa Exemplo' },
    connected: q.get('offline') !== '1',
    async callService() {},
    async callWS(msg) {
      // The camera tile signs its image path; the consumption sheet reads today's statistics.
      if (msg.type === 'auth/sign_path') return { path: states[msg.path.split('/').pop()]?.attributes.entity_picture };
      if (msg.type === 'recorder/statistic_during_period') return { change: 1.4 };
      if (msg.type === 'lovelace/config') return { strategy: { type: 'custom:hubb' } };
      return {};
    },
    formatEntityState: (st, s) => PT[s ?? st.state] ?? s ?? st.state,
    formatEntityAttributeValue: (st, attribute, value) => ({ vertical: 'Vertical', off: 'Desligada' })[value] ?? value,
  };
  const config = {
    name: 'Casa Exemplo',
    entities: {
      'sensor.lavadora_estado': { role: 'appliance' },
      'switch.cozinha_cafeteira': { role: 'equipment', icon: 'mdi:coffee-maker' },
    },
    scenes: ['scene.chegar', 'scene.cinema', 'scene.jantar', 'scene.boa_noite'],
  };
  return { hass, config };
}
