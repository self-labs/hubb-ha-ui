import { describe, expect, it } from 'vitest';
import { buildHouse, normalizeHouse } from '../../src/model/build-house';
import type { House, HubbConfig } from '../../src/model/types';
import { area, makeHass, type FakeEntity } from '../helpers/fake-hass';

// Scenes in their room, rooms with only scenes, and the four of the home (spec Cenas no cômodo, 07/11).

const LIA = 'u_lia';

function scene(id: string, name: string, areaId: string | null = null): FakeEntity {
  return { entity_id: `scene.${id}`, area_id: areaId, name, state: 'scening', labels: ['hubb_cena'] };
}

function clinic(scenes: FakeEntity[] = [scene('atendimento', 'Atendimento', 'recepcao')], resident = false) {
  return makeHass({
    user: resident ? { id: LIA, name: 'Lia', is_admin: false } : { id: 'u_gustavo', name: 'Gustavo', is_admin: true },
    areas: [area('recepcao', 'Recepção'), area('consultorio_1', 'Consultório 1')],
    entities: [{ entity_id: 'light.teto', area_id: 'recepcao', name: 'Teto', state: 'on' }, ...scenes],
  });
}

const room = (house: House, areaId: string) => house.rooms.find((r) => r.areaId === areaId);
const ids = (items: { entityId: string }[] | undefined) => (items ?? []).map((s) => s.entityId);

const six = ['a', 'b', 'c', 'd', 'e', 'f'].map((k) => scene(k, `Cena ${k.toUpperCase()}`));
const order = six.map((s) => s.entity_id);

describe('a scene in its room', () => {
  it('goes to the room the panel gives it, over its area in Home Assistant', () => {
    const house = buildHouse(clinic(), { entities: { 'scene.atendimento': { area: 'consultorio_1' } } });
    expect(ids(room(house, 'consultorio_1')?.scenes)).toEqual(['scene.atendimento']);
    expect(ids(room(house, 'recepcao')?.scenes)).toEqual([]);
  });

  it('stays only on Cenas with area none, even with an area in Home Assistant', () => {
    const house = buildHouse(clinic(), { entities: { 'scene.atendimento': { area: 'none' } } });
    expect(ids(room(house, 'recepcao')?.scenes)).toEqual([]);
    expect(ids(house.scenes)).toEqual(['scene.atendimento']);
  });

  it('makes a room with only scenes show', () => {
    const house = buildHouse(clinic([scene('atendimento', 'Atendimento', 'consultorio_1')]));
    const consultorio = room(house, 'consultorio_1');
    expect(consultorio?.lights).toEqual([]);
    expect(ids(consultorio?.scenes)).toEqual(['scene.atendimento']);
  });

  it('keeps the scene on Cenas when its room is hidden for everyone', () => {
    const config: HubbConfig = { rooms: { consultorio_1: { hidden: true } } };
    const house = buildHouse(clinic([scene('atendimento', 'Atendimento', 'consultorio_1')]), config);
    expect(room(house, 'consultorio_1')).toBeUndefined();
    expect(ids(house.scenes)).toEqual(['scene.atendimento']);
  });

  it('takes the scene from whoever its room is hidden for, on Cenas and on the home', () => {
    const config: HubbConfig = { rooms: { consultorio_1: { hidden_for: [LIA] } } };
    const house = buildHouse(clinic([scene('atendimento', 'Atendimento', 'consultorio_1')], true), config);
    expect(house.scenes).toEqual([]);
    expect(house.homeScenes).toEqual([]);
  });

  it('carries the light it follows, or null', () => {
    const scenes = [scene('atendimento', 'Atendimento', 'recepcao'), scene('limpeza', 'Limpeza', 'recepcao')];
    const house = buildHouse(clinic(scenes), { entities: { 'scene.atendimento': { follows: 'light.teto' } } });
    const byId = Object.fromEntries(house.scenes.map((s) => [s.entityId, s.follows]));
    expect(byId).toEqual({ 'scene.atendimento': 'light.teto', 'scene.limpeza': null });
  });
});

describe('the four scenes of the home', () => {
  it('are the first four of the order when none is pinned', () => {
    expect(ids(buildHouse(clinic(six), { scenes: order }).homeScenes)).toEqual(order.slice(0, 4));
  });

  it('are only the pinned ones, in the order of Cenas, with no others to fill in', () => {
    const config: HubbConfig = { scenes: order, entities: { 'scene.e': { pinned: true }, 'scene.b': { pinned: true } } };
    expect(ids(buildHouse(clinic(six), config).homeScenes)).toEqual(['scene.b', 'scene.e']);
  });

  it('are four at most', () => {
    const entities = Object.fromEntries(order.slice(0, 5).map((id) => [id, { pinned: true }]));
    expect(ids(buildHouse(clinic(six), { scenes: order, entities }).homeScenes)).toEqual(order.slice(0, 4));
  });

  it('leave out a pinned scene hidden for the resident, without filling in', () => {
    const config: HubbConfig = {
      scenes: order,
      entities: { 'scene.a': { pinned: true, hidden_for: [LIA] }, 'scene.c': { pinned: true } },
    };
    expect(ids(buildHouse(clinic(six, true), config).homeScenes)).toEqual(['scene.c']);
  });

  it('leave a resident with none when every pinned scene is hidden for them, never the first four', () => {
    const config: HubbConfig = { scenes: order, entities: { 'scene.a': { pinned: true, hidden_for: [LIA] } } };
    expect(ids(buildHouse(clinic(six, true), config).homeScenes)).toEqual([]);
    expect(ids(buildHouse(clinic(six), config).homeScenes)).toEqual(['scene.a']);
  });

  it('leave a resident with none when the pinned scene sits in a room hidden for them', () => {
    const scenes = [scene('atendimento', 'Atendimento', 'consultorio_1'), ...six];
    const config: HubbConfig = { rooms: { consultorio_1: { hidden_for: [LIA] } }, entities: { 'scene.atendimento': { pinned: true } } };
    expect(ids(buildHouse(clinic(scenes, true), config).homeScenes)).toEqual([]);
  });

  it('are the first four again when the pinned scene is no scene of Cenas any more', () => {
    const config: HubbConfig = { scenes: order, entities: { 'scene.a': { pinned: true, role: 'hidden' } } };
    expect(ids(buildHouse(clinic(six), config).homeScenes)).toEqual(order.slice(1, 5));
  });

  it('come back on a dashboard frozen before them: the first four scenes', () => {
    const house = buildHouse(clinic(six), { scenes: order });
    const frozen = { ...house } as Partial<House>;
    delete frozen.homeScenes;
    expect(ids(normalizeHouse(frozen as House).homeScenes)).toEqual(order.slice(0, 4));
  });
});
