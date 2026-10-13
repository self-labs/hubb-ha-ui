import { describe, expect, it } from 'vitest';
import { readConfig, roleFits } from '../../src/model/config';
import { area, device, floor, makeHass } from '../helpers/fake-hass';

function hass() {
  return makeHass({
    areas: [area('sala', 'Sala', null, 'terreo')],
    floors: [floor('terreo', 'Térreo', 0)],
    devices: [device('d1', 'sala', 'Lavadora')],
    entities: [
      { entity_id: 'switch.bomba', area_id: 'sala', state: 'off' },
      { entity_id: 'light.sofa', area_id: 'sala', state: 'off' },
      { entity_id: 'sensor.lavadora_estado', device_id: 'd1', state: 'Idle' },
      { entity_id: 'sensor.lavadora_tempo', device_id: 'd1', state: '40' },
      { entity_id: 'button.reiniciar', area_id: 'sala', state: 'unknown' },
      { entity_id: 'switch.config', area_id: 'sala', state: 'off', entity_category: 'config' },
    ],
  });
}

describe('readConfig', () => {
  it('reads an empty configuration as the defaults', () => {
    expect(readConfig(hass(), {})).toEqual({ profile: 'home', entities: {}, problems: [] });
  });

  it('keeps the valid settings and the profile', () => {
    const cfg = readConfig(hass(), {
      profile: 'clinic',
      entities: {
        'switch.bomba': { role: 'equipment', name: ' Bomba ', icon: 'mdi:pool', area: 'sala' },
        'sensor.lavadora_estado': { role: 'appliance', hide: ['button.x', 3 as never], remaining: 'sensor.lavadora_tempo' },
      },
      rooms: { sala: { floor: 'terreo', art: 'sala' } },
    });
    expect(cfg.profile).toBe('clinic');
    expect(cfg.entities['switch.bomba']).toEqual({ role: 'equipment', name: 'Bomba', icon: 'mdi:pool', area: 'sala', hide: [] });
    expect(cfg.entities['sensor.lavadora_estado']).toEqual({ role: 'appliance', hide: ['button.x'], remaining: 'sensor.lavadora_tempo' });
    expect(cfg.problems).toEqual([]);
  });

  it('falls back to a home and says why for a profile it does not know', () => {
    const cfg = readConfig(hass(), { profile: 'clinica' });
    expect(cfg.profile).toBe('home');
    expect(cfg.problems).toEqual([{ key: 'profile', entityId: null, message: 'Perfil "clinica" não existe; vale Casa.' }]);
  });

  it('ignores each wrong value and lists it, without dropping the rest of the entry', () => {
    const cfg = readConfig(hass(), {
      entities: {
        'switch.bomba': { role: 'ligth', icon: 'pool', area: 'varanda', name: 'Bomba' },
        'light.sofa': { role: 'outlet' },
        'switch.velho': { role: 'light' },
        'button.reiniciar': { role: 'appliance', remaining: 'sensor.nada' },
        'switch.config': { role: 'equipment' },
      },
      rooms: { sala: { art: 'cozinah', floor: 'terceiro' }, garagem: { order: 1 } },
    });
    expect(cfg.entities['switch.bomba']).toEqual({ name: 'Bomba', hide: [] });
    expect(cfg.entities['light.sofa']).toEqual({ hide: [] });
    expect(cfg.entities['switch.velho']).toBeUndefined();
    expect(cfg.entities['switch.config']).toEqual({ hide: [] });
    expect(cfg.problems.map((p) => [p.key, p.entityId, p.message])).toEqual([
      ['entities.switch.bomba.role', 'switch.bomba', 'Papel "ligth" não existe.'],
      ['entities.switch.bomba.icon', 'switch.bomba', 'Ícone "pool" precisa começar com "mdi:".'],
      ['entities.switch.bomba.area', 'switch.bomba', 'Área "varanda" não existe no Home Assistant.'],
      ['entities.light.sofa.role', 'light.sofa', 'Papel "outlet" não serve para "light".'],
      ['entities.switch.velho', 'switch.velho', '"switch.velho" não existe no Home Assistant.'],
      ['entities.button.reiniciar.role', 'button.reiniciar', '"button.reiniciar" não tem dispositivo; o papel "appliance" precisa de um.'],
      ['entities.button.reiniciar.remaining', 'button.reiniciar', '"sensor.nada" não existe no Home Assistant.'],
      ['entities.switch.config.role', 'switch.config', '"switch.config" é de configuração ou diagnóstico e fica fora do painel.'],
      ['rooms.sala.art', null, 'Desenho "cozinah" não existe.'],
      ['rooms.sala.floor', null, 'Andar "terceiro" não existe no Home Assistant.'],
      ['rooms.garagem', null, 'Área "garagem" não existe no Home Assistant.'],
    ]);
  });

  it('says which roles fit which entities', () => {
    const h = hass();
    expect(roleFits(h, 'light', 'switch.bomba')).toBe(true);
    expect(roleFits(h, 'outlet', 'light.sofa')).toBe(false);
    expect(roleFits(h, 'action', 'button.reiniciar')).toBe(true);
    expect(roleFits(h, 'appliance', 'sensor.lavadora_estado')).toBe(true);
    expect(roleFits(h, 'appliance', 'switch.bomba')).toBe(false);
    expect(roleFits(h, 'hidden', 'light.sofa')).toBe(true);
  });
});
