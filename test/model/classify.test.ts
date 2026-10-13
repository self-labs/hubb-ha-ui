import { describe, expect, it } from 'vitest';
import { applianceAreaOf, areaOf, classify, classifyContext } from '../../src/model/classify';
import { readConfig } from '../../src/model/config';
import type { HubbConfig } from '../../src/model/types';
import { area, device, makeHass } from '../helpers/fake-hass';

function setup(config: HubbConfig = {}) {
  const h = makeHass({
    areas: [area('sala', 'Sala'), area('lav', 'Lavanderia')],
    devices: [device('d_lav', 'lav', 'Lavadora'), device('d_mod', 'sala', 'Módulo')],
    entities: [
      { entity_id: 'light.sofa', area_id: 'sala', state: 'off' },
      { entity_id: 'light.solta', state: 'off' },
      { entity_id: 'light.oculta', area_id: 'sala', state: 'off', hidden: true },
      { entity_id: 'light.varanda', device_id: 'd_mod', state: 'off' },
      { entity_id: 'switch.varanda', device_id: 'd_mod', state: 'off', hidden: true },
      { entity_id: 'switch.tomada', area_id: 'sala', state: 'off', attributes: { device_class: 'outlet' } },
      { entity_id: 'switch.jet', device_id: 'd_mod', state: 'off' },
      { entity_id: 'switch.config', area_id: 'sala', state: 'off', entity_category: 'config' },
      { entity_id: 'sensor.lav_estado', device_id: 'd_lav', state: 'Idle', entity_category: 'diagnostic' },
      { entity_id: 'switch.lav_turbo', device_id: 'd_lav', state: 'off' },
      { entity_id: 'scene.noite', labels: ['hubb_cena'], state: 'unknown' },
      { entity_id: 'scene.sem_rotulo', area_id: 'sala', state: 'unknown' },
      { entity_id: 'climate.ar', area_id: 'sala', state: 'cool' },
      { entity_id: 'button.reiniciar', area_id: 'sala', state: 'unknown' },
    ],
  });
  const ctx = classifyContext(h, readConfig(h, config), config.hide_entities);
  return (entityId: string) => classify(h, entityId, ctx);
}

describe('classify', () => {
  it('places lights, outlets and labelled scenes where their type says', () => {
    const at = setup();
    expect(at('light.sofa')).toEqual({ block: 'light', areaId: 'sala' });
    expect(at('light.varanda')).toEqual({ block: 'light', areaId: 'sala' });
    expect(at('switch.tomada')).toEqual({ block: 'outlet', areaId: 'sala' });
    expect(at('scene.noite')).toEqual({ block: 'scene', areaId: null });
  });

  it('sends a switch with no class to the review, and keeps out what is hidden, configuration, roomless or for later', () => {
    const at = setup();
    expect(at('switch.jet')).toEqual({ block: null, why: 'review', areaId: 'sala' });
    expect(at('light.oculta')).toEqual({ block: null, why: 'hidden', areaId: null });
    expect(at('switch.config')).toEqual({ block: null, why: 'category', areaId: null });
    expect(at('light.solta')).toEqual({ block: null, why: 'no-area', areaId: null });
    expect(at('climate.ar')).toEqual({ block: null, why: 'unsupported', areaId: 'sala' });
    expect(at('button.reiniciar')).toEqual({ block: null, why: 'unsupported', areaId: 'sala' });
    expect(at('scene.sem_rotulo')).toEqual({ block: null, why: 'unsupported', areaId: 'sala' });
    expect(at('light.nao_existe')).toEqual({ block: null, why: 'hidden', areaId: null });
  });

  it('keeps out, with no review, a switch with no class and no room (AdGuard, containers)', () => {
    const h = makeHass({ entities: [{ entity_id: 'switch.adguard', state: 'on' }] });
    expect(classify(h, 'switch.adguard', classifyContext(h, readConfig(h, {})))).toEqual({ block: null, why: 'unsupported', areaId: null });
  });

  it('keeps out the switch that "Mostrar como" hid behind its light', () => {
    const at = setup();
    expect(at('switch.varanda')).toEqual({ block: null, why: 'hidden', areaId: null });
    expect(at('light.varanda').block).toBe('light');
  });

  it('gives the role of the configuration priority over the type when it fits', () => {
    const at = setup({
      entities: {
        'switch.jet': { role: 'light' },
        'button.reiniciar': { role: 'action' },
        'light.sofa': { role: 'hidden' },
        'light.solta': { role: 'light', area: 'lav' },
      },
    });
    expect(at('switch.jet')).toEqual({ block: 'light', areaId: 'sala' });
    expect(at('button.reiniciar')).toEqual({ block: 'action', areaId: 'sala' });
    expect(at('light.sofa')).toEqual({ block: null, why: 'hidden', areaId: null });
    expect(at('light.solta')).toEqual({ block: 'light', areaId: 'lav' });
  });

  it('keeps a configuration entity out even with a role; only an appliance takes one in', () => {
    const at = setup({ entities: { 'switch.config': { role: 'equipment' }, 'sensor.lav_estado': { role: 'appliance' } } });
    expect(at('switch.config')).toEqual({ block: null, why: 'category', areaId: null });
    expect(at('sensor.lav_estado')).toEqual({ block: 'appliance', areaId: 'lav' });
  });

  it('ignores a role that does not fit and falls back to the type', () => {
    expect(setup({ entities: { 'light.sofa': { role: 'outlet' } } })('light.sofa')).toEqual({ block: 'light', areaId: 'sala' });
  });

  it('keeps out what hide_entities lists', () => {
    expect(setup({ hide_entities: ['light.sofa'] })('light.sofa')).toEqual({ block: null, why: 'hidden', areaId: null });
  });

  it('makes a marked device an appliance and keeps its other entities inside it', () => {
    const at = setup({ entities: { 'sensor.lav_estado': { role: 'appliance' } } });
    expect(at('sensor.lav_estado')).toEqual({ block: 'appliance', areaId: 'lav' });
    expect(at('switch.lav_turbo')).toEqual({ block: null, why: 'part', areaId: null });
  });
});

describe('areaOf and applianceAreaOf', () => {
  it('takes the area of the configuration, else the entity, else the device; the appliance prefers its device', () => {
    const h = makeHass({
      areas: [area('sala', 'Sala'), area('lav', 'Lavanderia')],
      devices: [device('d1', 'lav', 'Lavadora')],
      entities: [{ entity_id: 'sensor.x', device_id: 'd1', area_id: 'sala', state: 'Idle' }],
    });
    expect(areaOf(h, 'sensor.x')).toBe('sala');
    expect(areaOf(h, 'sensor.x', 'lav')).toBe('lav');
    expect(areaOf(h, 'sensor.x', 'nada')).toBe('sala');
    expect(applianceAreaOf(h, 'sensor.x')).toBe('lav');
    expect(applianceAreaOf(h, 'sensor.x', 'sala')).toBe('sala');
    expect(areaOf(h, 'sensor.nada')).toBeNull();
  });
});
