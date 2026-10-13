import { describe, expect, it } from 'vitest';
import {
  cachedStaticReview,
  reviewItems,
  silentReview,
  SILENT_AFTER_MS,
  staticReview,
  suggestedLines,
  suggestRole,
  yamlBlock,
  yamlLine,
  type ReviewItem,
} from '../../src/model/review';
import type { HubbConfig } from '../../src/model/types';
import { CASA2_CONFIG, casa2Hass } from '../fixtures/casa-exemplo-2';
import { area, device, makeHass } from '../helpers/fake-hass';

const brief = (items: ReviewItem[]) => items.map((i) => [i.group, i.entityId, i.suggested]);
const LIGHTS_ONLY: HubbConfig = { entities: { 'switch.escritorio_luz': { role: 'light' }, 'switch.varanda_luz': { role: 'light' } } };

describe('suggestRole and the lines of YAML', () => {
  it('suggests hidden for the announcements and communications switches of an Echo or a TV', () => {
    expect(
      ['Quarto Echo Dot de Gustavo Announcements', 'Quarto TV Communications', 'Anúncios', 'Comunicações'].map(suggestRole),
    ).toEqual(['hidden', 'hidden', 'hidden', 'hidden']);
  });

  it('suggests hidden for modes and displays, light for light words, equipment for the rest', () => {
    expect(
      ['Jet mode', 'Display light', 'Não perturbe', 'Luz da varanda', 'Spot bancada', 'Fita LED', 'Lâmpada', 'Bomba', 'Portão'].map(suggestRole),
    ).toEqual(['hidden', 'hidden', 'hidden', 'light', 'light', 'light', 'light', 'equipment', 'equipment']);
  });

  it('writes the lines the installer pastes', () => {
    expect(yamlLine('switch.jet_mode', 'hidden')).toBe('switch.jet_mode: { role: hidden }');
    expect(yamlBlock(['switch.a: { role: light }', 'switch.b: { role: hidden }'])).toBe(
      'entities:\n  switch.a: { role: light }\n  switch.b: { role: hidden }',
    );
  });
});

describe('staticReview', () => {
  it('lists the switch with no class with its roles, and watches what the panel shows', () => {
    const r = staticReview(casa2Hass(), CASA2_CONFIG);
    expect(r.items.map((i) => [i.group, i.entityId, i.name, i.areaName, i.suggested])).toEqual([
      ['role', 'switch.jet_mode', 'Jet mode', 'Escritório', 'hidden'],
    ]);
    expect(r.items[0]!.roles).toEqual(['light', 'outlet', 'equipment', 'hidden']);
    expect(r.watched).toEqual(['sensor.lavadora_appliancestate', 'switch.escritorio_luz', 'switch.varanda_luz']);
  });

  it('suggests the appliance of a known brand, and keeps its options out of the switches to review', () => {
    const r = staticReview(casa2Hass(), LIGHTS_ONLY);
    expect(brief(r.items)).toEqual([
      ['role', 'switch.jet_mode', 'hidden'],
      ['appliance', 'sensor.lavadora_appliancestate', 'appliance'],
    ]);
    expect(r.items[1]).toMatchObject({ name: 'Lavadora', areaName: 'Terraço', roles: ['appliance'] });
    expect(suggestedLines(r.items)).toEqual(['switch.jet_mode: { role: hidden }', 'sensor.lavadora_appliancestate: { role: appliance }']);
  });

  it('lets the installer dismiss a suggested appliance by hiding its state sensor', () => {
    const r = staticReview(casa2Hass(), { entities: { ...LIGHTS_ONLY.entities, 'sensor.lavadora_appliancestate': { role: 'hidden' } } });
    expect(r.items.some((i) => i.group === 'appliance')).toBe(false);
  });

  it('does not suggest a climate device, which waits for the climate module', () => {
    const h = makeHass({
      areas: [area('quarto', 'Quarto')],
      devices: [device('d_ar', 'quarto', 'Ar')],
      entities: [
        { entity_id: 'climate.ar', device_id: 'd_ar', state: 'cool', platform: 'electrolux_status' },
        { entity_id: 'sensor.ar_appliancestate', device_id: 'd_ar', state: 'Running', platform: 'electrolux_status' },
      ],
    });
    expect(staticReview(h, {}).items).toEqual([]);
  });

  it('leaves out the switches with no class and no room, which no role could put on the panel', () => {
    const h = makeHass({
      entities: [
        { entity_id: 'switch.adguard_home_protecao', name: 'Proteção', state: 'on', platform: 'adguard' },
        { entity_id: 'switch.alferes_app_container', name: 'Container', state: 'on', platform: 'portainer' },
      ],
    });
    expect(staticReview(h, {}).items).toEqual([]);
  });

  it('lists what would show but has no room, except the screens that Browser Mod creates', () => {
    const h = makeHass({
      entities: [
        { entity_id: 'light.corredor', name: 'Corredor', state: 'off' },
        { entity_id: 'light.celular_screen', state: 'unavailable', platform: 'browser_mod' },
      ],
    });
    const items = staticReview(h, {}).items;
    expect(brief(items)).toEqual([['area', 'light.corredor', null]]);
    expect(items[0]!.roles).toEqual(['hidden']);
  });

  it('lists the problems of the configuration, and an appliance with no state it can read', () => {
    const h = makeHass({
      areas: [area('cozinha', 'Cozinha')],
      devices: [device('d_forno', 'cozinha', 'Forno')],
      entities: [{ entity_id: 'button.forno_ligar', device_id: 'd_forno', state: 'unknown' }],
    });
    const r = staticReview(h, { profile: 'clinica', entities: { 'button.forno_ligar': { role: 'appliance' } } });
    expect(r.items.map((i) => [i.group, i.name, i.reason])).toEqual([
      ['config', 'profile', 'Perfil "clinica" não existe; vale Casa.'],
      [
        'config',
        'entities.button.forno_ligar',
        '"button.forno_ligar": aparelho sem estado reconhecido; use remaining ou progress, ou marque o sensor de estado.',
      ],
    ]);
  });
});

describe('silentReview', () => {
  const now = Date.parse('2026-10-12T20:00:00Z');
  const h = makeHass({
    areas: [area('sala', 'Sala')],
    entities: [
      { entity_id: 'light.velha', area_id: 'sala', name: 'Velha', state: 'unavailable', last_changed: '2026-10-10T08:00:00Z' },
      { entity_id: 'light.nova', area_id: 'sala', name: 'Nova', state: 'unavailable', last_changed: '2026-10-12T19:00:00Z' },
      { entity_id: 'light.boa', area_id: 'sala', name: 'Boa', state: 'on', last_changed: '2026-10-01T08:00:00Z' },
    ],
  });

  it('lists what the panel shows and has not answered for more than a day', () => {
    const items = silentReview(h, ['light.velha', 'light.nova', 'light.boa'], now);
    expect(items.map((i) => [i.group, i.entityId, i.name, i.areaName])).toEqual([['silent', 'light.velha', 'Velha', 'Sala']]);
    expect(items[0]!.reason).toMatch(/^Sem resposta desde \d{2}\/\d{2}/);
    expect(items[0]!.roles).toEqual([]);
    expect(SILENT_AFTER_MS).toBe(86_400_000);
  });
});

describe('cachedStaticReview', () => {
  it('reuses the registry review while the registry has not changed', () => {
    const h = casa2Hass();
    const first = cachedStaticReview(h, CASA2_CONFIG);
    expect(cachedStaticReview({ ...h, states: { ...h.states } }, CASA2_CONFIG)).toBe(first);
    expect(cachedStaticReview({ ...h, entities: { ...h.entities } }, CASA2_CONFIG)).not.toBe(first);
  });

  it('adds the silent entities on top of the registry review', () => {
    const h = casa2Hass();
    h.states['switch.varanda_luz'] = { entity_id: 'switch.varanda_luz', state: 'unavailable', attributes: {}, last_changed: '2026-10-01T00:00:00Z' };
    expect(brief(reviewItems(h, CASA2_CONFIG, Date.parse('2026-10-12T20:00:00Z')))).toEqual([
      ['role', 'switch.jet_mode', 'hidden'],
      ['silent', 'switch.varanda_luz', null],
    ]);
  });
});
