import type { FakeEntity } from '../helpers/fake-hass';

/**
 * A washer shaped like the Electrolux LATAM catalogue (integration branch feat/latam-washer-catalog,
 * read on 12/10/2026): state, time to end, choices with lowercase option keys, options and six
 * command buttons with translated names, all on one device. Turbo agitation is unavailable, the
 * way the integration marks an option the current program does not take; the default extra rinse
 * is always unknown on this model.
 */
export function washerEntities(deviceId = 'd_lavadora', state = 'Running', minutes = '40'): FakeEntity[] {
  const e = (entity_id: string, s: string, friendly_name: string, attributes: Record<string, unknown> = {}, extra: Partial<FakeEntity> = {}): FakeEntity => ({
    entity_id,
    device_id: deviceId,
    state: s,
    attributes: { friendly_name, ...attributes },
    platform: 'electrolux_status',
    ...extra,
  });
  return [
    e('sensor.lavadora_appliancestate', state, 'Lavadora Estado'),
    e('sensor.lavadora_connectivitystate', 'Connected', 'Lavadora Conectividade', { device_class: 'enum' }, { entity_category: 'diagnostic' }),
    e('sensor.lavadora_timetoend', minutes, 'Lavadora Tempo restante', { device_class: 'duration', unit_of_measurement: 'min' }, { entity_category: 'diagnostic' }),
    e('sensor.lavadora_totalcyclecounter', '383', 'Lavadora Ciclos', {}, { entity_category: 'diagnostic' }),
    e('select.lavadora_programid', 'colors', 'Lavadora Programa', { options: ['normal', 'colors', 'whites', 'quick'] }),
    e('select.lavadora_washlevel', 'high', 'Lavadora Nível de roupas', { options: ['low', 'medium', 'high'] }),
    e('select.lavadora_defaultextrarinse', 'unknown', 'Lavadora Enxágue extra padrão', { options: ['on', 'off'] }),
    e('switch.lavadora_rinse', 'on', 'Lavadora Enxágue extra'),
    e('switch.lavadora_turboagitation', 'unavailable', 'Lavadora Turbo agitação'),
    e('switch.lavadora_turbodrying', 'off', 'Lavadora Turbo centrifugação'),
    e('switch.lavadora_waterreuse', 'off', 'Lavadora Reuso de água'),
    e('button.lavadora_executecommand', 'unknown', 'Lavadora Desligar'),
    e('button.lavadora_executecommand_2', 'unknown', 'Lavadora Ligar'),
    e('button.lavadora_executecommand_3', 'unknown', 'Lavadora Pausar'),
    e('button.lavadora_executecommand_4', 'unknown', 'Lavadora Continuar'),
    e('button.lavadora_executecommand_5', 'unknown', 'Lavadora Iniciar'),
    e('button.lavadora_executecommand_6', 'unknown', 'Lavadora Parar e reiniciar'),
    e('binary_sensor.lavadora_doorstate', 'off', 'Lavadora Porta', { device_class: 'door' }),
    e('number.lavadora_phaseadvance', '0', 'Lavadora Avançar etapa', {}, { entity_category: 'config' }),
  ];
}
