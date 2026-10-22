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
  Idle: 'Desligada',
};

const area = (area_id, name) => ({ area_id, name, picture: null, icon: null, floor_id: null });

/**
 * @param {URLSearchParams} q  theme=light, admin=1, alert=1, offline=1, code=1 (alarm with a code), alarm=<state>,
 *   rest=1 (seen as the wall tablet of the sala), place=clinic (a business: Início with a building)
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

  // Two speakers playing together, the varanda leading; the cover is a made-up drawing.
  const cover = `data:image/svg+xml,${encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f2a65a"/><stop offset="1" stop-color="#7a3b69"/></linearGradient></defs><rect width="120" height="120" fill="url(#g)"/><circle cx="60" cy="60" r="28" fill="none" stroke="#fff" stroke-width="6" opacity=".85"/></svg>',
  )}`;
  const group = ['media_player.varanda_caixa', 'media_player.cozinha_caixa'];
  const song = {
    media_title: 'Fim de Tarde',
    media_artist: 'Banda Imaginária',
    media_album_name: 'Varanda',
    entity_picture: cover,
    media_duration: 214,
    media_position: 61,
    media_position_updated_at: new Date().toISOString(),
    shuffle: false,
    repeat: 'off',
    group_members: group,
    supported_features: 1 | 2 | 4 | 8 | 16 | 32 | 128 | 256 | 16384 | 32768 | 262144 | 524288,
  };
  add('media_player.varanda_caixa', 'Caixa', at('varanda'), 'playing', { ...song, volume_level: 0.4, is_volume_muted: false }, { platform: 'wiim' });
  add('media_player.cozinha_caixa', 'Caixa', at('cozinha'), 'playing', { ...song, volume_level: 0.25, is_volume_muted: false }, { platform: 'wiim' });

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

  // The power meter of the whole house, for the energy pill of the wide home.
  add('sensor.casa_potencia', 'Consumo da casa', {}, '1240', { device_class: 'power', unit_of_measurement: 'W' });

  // Weather with both forecasts (daily 1, hourly 2): the high and low of today, the next hours.
  entities['weather.casa'] = { entity_id: 'weather.casa', labels: [] };
  states['weather.casa'] = { entity_id: 'weather.casa', state: 'sunny', attributes: { temperature: 24, supported_features: 3 } };
  const inHours = (h) => {
    const d = new Date();
    d.setMinutes(0, 0, 0);
    d.setHours(d.getHours() + h);
    return d.toISOString();
  };
  const forecast = {
    daily: [{ datetime: inHours(0), condition: 'sunny', temperature: 29, templow: 18 }],
    hourly: [25, 25, 24, 22, 21].map((temperature, i) => ({ datetime: inHours(i + 1), condition: i < 2 ? 'sunny' : 'partlycloudy', temperature })),
  };

  // The people of the house: Ana administers it, Lia lives there, Tablet is the account of the wall tablet.
  const users = [
    { id: 'preview', name: 'Ana Souza', is_active: true, system_generated: false, group_ids: ['system-admin'] },
    { id: 'u_lia', name: 'Lia', is_active: true, system_generated: false, group_ids: ['system-users'] },
    { id: 'u_tablet', name: 'Tablet', is_active: true, system_generated: false, group_ids: ['system-users'] },
  ];
  const business = q.get('place') === 'clinic';
  const placeName = business ? 'Clínica Exemplo' : 'Casa Exemplo';

  const hass = {
    states,
    entities,
    devices,
    areas,
    floors: {},
    user: q.get('rest') === '1' ? { id: 'u_tablet', name: 'Tablet', is_admin: false } : { id: 'preview', name: 'Ana Souza', is_admin: q.get('admin') === '1' },
    themes: { darkMode: q.get('theme') !== 'light' },
    config: { location_name: placeName },
    connected: q.get('offline') !== '1',
    connection: {
      async subscribeMessage(cb, msg) {
        // Like Home Assistant, the first forecast arrives after the subscription, never during it.
        if (msg.type === 'weather/subscribe_forecast') setTimeout(() => cb({ forecast: forecast[msg.forecast_type] ?? [] }));
        return () => {};
      },
    },
    async callService() {},
    async callWS(msg) {
      // The camera tile signs its image path; the consumption sheet reads today's statistics.
      if (msg.type === 'auth/sign_path') return { path: states[msg.path.split('/').pop()]?.attributes.entity_picture };
      if (msg.type === 'recorder/statistic_during_period') return { change: 1.4 };
      if (msg.type === 'lovelace/config') return { strategy: { type: 'custom:hubb' } };
      if (msg.type === 'config/auth/list') return users;
      return {};
    },
    formatEntityState: (st, s) => PT[s ?? st.state] ?? s ?? st.state,
    formatEntityAttributeValue: (st, attribute, value) => ({ vertical: 'Vertical', off: 'Desligada' })[value] ?? value,
  };
  const config = {
    name: placeName,
    ...(business ? { profile: 'clinic' } : {}),
    house_power: 'sensor.casa_potencia',
    tablets: { u_tablet: { room: 'sala', rest_after: 5 } },
    entities: {
      'sensor.lavadora_estado': { role: 'appliance' },
      'switch.cozinha_cafeteira': { role: 'equipment', icon: 'mdi:coffee-maker' },
    },
    scenes: ['scene.chegar', 'scene.cinema', 'scene.jantar', 'scene.boa_noite'],
  };
  return { hass, config };
}
