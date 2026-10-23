import { describe, expect, it } from 'vitest';
import { buildHouse } from '../../src/model/build-house';
import { classify, classifyContext } from '../../src/model/classify';
import { readConfig } from '../../src/model/config';
import { suggestRole } from '../../src/model/review';
import { area, makeHass } from '../helpers/fake-hass';

function house() {
  return makeHass({
    areas: [area('sala', 'Sala'), area('entrada', 'Entrada')],
    entities: [
      { entity_id: 'climate.ar', area_id: 'sala', name: 'Ar', state: 'off' },
      { entity_id: 'fan.teto', area_id: 'sala', name: 'Ventilador', state: 'off' },
      { entity_id: 'cover.cortina', area_id: 'sala', name: 'Cortina', state: 'closed', attributes: { device_class: 'curtain' } },
      { entity_id: 'cover.persiana', area_id: 'sala', name: 'Persiana', state: 'open' },
      { entity_id: 'cover.portao_garagem', area_id: 'entrada', state: 'closed', attributes: { friendly_name: 'Portão Garagem' } },
      { entity_id: 'cover.basculante', area_id: 'entrada', name: 'Basculante', state: 'closed', attributes: { device_class: 'garage' } },
      { entity_id: 'lock.porta', area_id: 'entrada', name: 'Porta', state: 'locked' },
      { entity_id: 'media_player.tv', area_id: 'sala', name: 'TV', state: 'off' },
      { entity_id: 'media_player.celular', area_id: 'sala', state: 'off', platform: 'browser_mod' },
      { entity_id: 'switch.portao', area_id: 'entrada', name: 'Portão social', state: 'off' },
    ],
  });
}

describe('the kinds of M3', () => {
  it('places climate, fans, curtains, media and access by their type, and a pulse relay by the gate role', () => {
    const h = house();
    const ctx = classifyContext(h, readConfig(h, { entities: { 'switch.portao': { role: 'gate' } } }));
    const ids = [
      'climate.ar',
      'fan.teto',
      'cover.cortina',
      'cover.persiana',
      'cover.portao_garagem',
      'cover.basculante',
      'lock.porta',
      'media_player.tv',
      'media_player.celular',
      'switch.portao',
    ];
    expect(ids.map((id) => classify(h, id, ctx).block)).toEqual(['climate', 'fan', 'cover', 'cover', 'gate', 'gate', 'lock', 'media', null, 'gate']);
  });

  it('builds the new blocks of each room', () => {
    const built = buildHouse(house(), { entities: { 'switch.portao': { role: 'gate' } } });
    const sala = built.rooms.find((r) => r.areaId === 'sala')!;
    const entrada = built.rooms.find((r) => r.areaId === 'entrada')!;
    expect(sala.climate).toEqual([
      { entityId: 'climate.ar', name: 'Ar', kind: 'climate', extras: [] },
      { entityId: 'fan.teto', name: 'Ventilador', kind: 'fan' },
    ]);
    expect(sala.covers.map((c) => c.name)).toEqual(['Cortina', 'Persiana']);
    expect(sala.media).toEqual([{ entityId: 'media_player.tv', name: 'TV', ma: null }]);
    expect(entrada.access).toEqual([
      { entityId: 'cover.basculante', name: 'Basculante', kind: 'cover' },
      { entityId: 'lock.porta', name: 'Porta', kind: 'lock' },
      { entityId: 'cover.portao_garagem', name: 'Portão Garagem', kind: 'cover' },
      { entityId: 'switch.portao', name: 'Portão social', kind: 'pulse' },
    ]);
  });

  it('suggests the gate role for a gate', () => {
    expect(['Portão Paraíso', 'Gate'].map(suggestRole)).toEqual(['gate', 'gate']);
  });

  it('suggests a light named after the gate as a light', () => {
    expect(['Luz do portão', 'Refletor Portão', 'Lâmpada portão', 'Spot do gate'].map(suggestRole)).toEqual(['light', 'light', 'light', 'light']);
  });

  it('decides a cover by its class when it has one, and by "portão" in the name only when it has none', () => {
    const h = makeHass({
      areas: [area('garagem', 'Garagem')],
      entities: [
        { entity_id: 'cover.cortina_garagem', area_id: 'garagem', name: 'Cortina da garagem', state: 'open', attributes: { device_class: 'curtain' } },
        { entity_id: 'cover.janela_portao', area_id: 'garagem', name: 'Janela do portão', state: 'open', attributes: { device_class: 'window' } },
        { entity_id: 'cover.basculante', area_id: 'garagem', name: 'Basculante', state: 'closed', attributes: { device_class: 'garage' } },
        { entity_id: 'cover.persiana_garagem', area_id: 'garagem', name: 'Persiana garagem', state: 'open' },
        { entity_id: 'cover.portao', area_id: 'garagem', name: 'Portão', state: 'closed' },
      ],
    });
    const ctx = classifyContext(h, readConfig(h, {}));
    const ids = ['cover.cortina_garagem', 'cover.janela_portao', 'cover.basculante', 'cover.persiana_garagem', 'cover.portao'];
    expect(ids.map((id) => classify(h, id, ctx).block)).toEqual(['cover', 'cover', 'gate', 'cover', 'gate']);
  });
});
