import { describe, expect, it } from 'vitest';
import { buildHouse, normalizeRoom } from '../../src/model/build-house';
import { classify, classifyContext } from '../../src/model/classify';
import { readConfig } from '../../src/model/config';
import { reviewItems } from '../../src/model/review';
import { area, makeHass } from '../helpers/fake-hass';

// A ceiling TV hides behind a flap that opens, stops and closes: a cover the installer shows as Flap
// ("Mostrar como > Flap"), in a block of its own instead of Cortinas (Gustavo, 14/11).
function house() {
  return makeHass({
    areas: [area('sala', 'Sala'), area('entrada', 'Entrada'), area('quarto', 'Quarto')],
    entities: [
      { entity_id: 'cover.sala_cortina', area_id: 'sala', name: 'Cortina', state: 'open', attributes: { device_class: 'curtain' } },
      { entity_id: 'cover.sala_flap', area_id: 'sala', name: 'Flap', state: 'closed' },
      { entity_id: 'cover.entrada_flap', area_id: 'entrada', name: 'Portão', state: 'closed' },
      { entity_id: 'cover.quarto_flap', area_id: 'quarto', name: 'Flap', state: 'closed' },
      { entity_id: 'light.sala_luz', area_id: 'sala', name: 'Luz', state: 'off' },
    ],
  });
}

const CONFIG = {
  entities: { 'cover.sala_flap': { role: 'flap' }, 'cover.entrada_flap': { role: 'flap' }, 'cover.quarto_flap': { role: 'flap' } },
};

describe('the flap role', () => {
  it('is accepted on a cover and refused on a light', () => {
    const h = house();
    const ok = readConfig(h, { entities: { 'cover.sala_flap': { role: 'flap' } } });
    expect(ok.entities['cover.sala_flap']?.role).toBe('flap');
    expect(ok.problems).toEqual([]);
    const refused = readConfig(h, { entities: { 'light.sala_luz': { role: 'flap' } } });
    expect(refused.problems.map((p) => p.message)).toEqual(['role: flap não serve para light.']);
  });

  it('places a cover in the flap block, even when its name says gate', () => {
    const h = house();
    const ctx = classifyContext(h, readConfig(h, CONFIG));
    expect(classify(h, 'cover.sala_flap', ctx)).toEqual({ block: 'flap', areaId: 'sala' });
    // The role wins over the name: "Portão" with the flap role stays a flap, not a gate.
    expect(classify(h, 'cover.entrada_flap', ctx)).toEqual({ block: 'flap', areaId: 'entrada' });
  });

  it('builds the flaps of a room apart from its curtains, and a room with only a flap is listed', () => {
    const built = buildHouse(house(), CONFIG);
    const sala = built.rooms.find((r) => r.areaId === 'sala')!;
    expect(sala.covers.map((c) => c.name)).toEqual(['Cortina']);
    expect(sala.flaps).toEqual([{ entityId: 'cover.sala_flap', name: 'Flap' }]);
    const quarto = built.rooms.find((r) => r.areaId === 'quarto')!;
    expect(quarto.flaps).toHaveLength(1);
    expect(quarto.covers).toEqual([]);
  });

  it('fills flaps in for a room frozen before the role existed', () => {
    const room = buildHouse(house(), CONFIG).rooms[0]!;
    const { flaps: _gone, ...old } = room;
    expect(normalizeRoom(old as typeof room).flaps).toEqual([]);
  });

  it('counts a flap and a curtain named alike, in one room, as duplicates on the review', () => {
    const h = makeHass({
      areas: [area('sala', 'Sala')],
      entities: [
        { entity_id: 'cover.a', area_id: 'sala', name: 'Cortina', state: 'open', attributes: { device_class: 'curtain' } },
        { entity_id: 'cover.b', area_id: 'sala', name: 'Cortina', state: 'closed' },
      ],
    });
    const config = { entities: { 'cover.b': { role: 'flap' } } };
    const ids = reviewItems(h, config)
      .filter((i) => i.group === 'duplicate')
      .map((i) => i.entityId);
    expect(ids.sort()).toEqual(['cover.a', 'cover.b']);
  });
});
