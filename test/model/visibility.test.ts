import { describe, expect, it } from 'vitest';
import { allLightIds, buildHouse, normalizeRoom } from '../../src/model/build-house';
import { readConfig } from '../../src/model/config';
import type { Room } from '../../src/model/types';
import { generateDashboard } from '../../src/strategy/generate';
import { area, makeHass, type FakeHass } from '../helpers/fake-hass';

const LIA = 'u_lia';

/** A sala and a kitnet; `who` is the user looking. */
function house(who: { id: string; name: string; is_admin: boolean }): FakeHass {
  return makeHass({
    user: who,
    areas: [area('sala', 'Sala'), area('kitnet', 'Kitnet')],
    entities: [
      { entity_id: 'light.sala', area_id: 'sala', name: 'Teto', state: 'on' },
      { entity_id: 'light.abajur', area_id: 'sala', name: 'Abajur', state: 'off' },
      { entity_id: 'light.kitnet', area_id: 'kitnet', name: 'Teto', state: 'on' },
      { entity_id: 'binary_sensor.kitnet_porta', area_id: 'kitnet', name: 'Porta', state: 'on', attributes: { device_class: 'door' } },
      { entity_id: 'binary_sensor.kitnet_fumaca', area_id: 'kitnet', name: 'Fumaça', state: 'on', attributes: { device_class: 'smoke' } },
      { entity_id: 'camera.kitnet', area_id: 'kitnet', name: 'Câmera', state: 'idle' },
      { entity_id: 'scene.kitnet_noite', area_id: 'kitnet', name: 'Noite', state: 'scening', labels: ['hubb_cena'] },
    ],
  });
}
const resident = () => house({ id: LIA, name: 'Lia', is_admin: false });
const installer = () => house({ id: 'u_gustavo', name: 'Gustavo', is_admin: true });
const kitnetHidden = { rooms: { kitnet: { hidden_for: [LIA] } } };

describe('what each person sees', () => {
  it('hides a room and everything in it from the resident it is hidden for', () => {
    const built = buildHouse(resident(), kitnetHidden);
    expect(built.rooms.map((r) => r.areaId)).toEqual(['sala']);
    expect(built.scenes).toEqual([]);
    expect(built.security.cameras).toEqual([]);
    expect(built.security.openings).toEqual([]);
    // "Apagar tudo" turns off what the resident sees, never the kitnet.
    expect(allLightIds(built)).toEqual(['light.abajur', 'light.sala']);
  });

  it('still warns the resident of smoke in a room hidden from them, naming it, with no page to open (decision B)', () => {
    expect(buildHouse(resident(), kitnetHidden).alerts).toEqual([
      { entityId: 'binary_sensor.kitnet_fumaca', kind: 'smoke', roomName: 'Kitnet', path: null },
    ]);
  });

  it('shows everything to an administrator, even one listed in hidden_for, and keeps who it is hidden for (decision A)', () => {
    const built = buildHouse(installer(), { rooms: { kitnet: { hidden_for: [LIA, 'u_gustavo'] } } });
    expect(built.rooms.map((r) => r.areaId).sort()).toEqual(['kitnet', 'sala']);
    expect(built.rooms.find((r) => r.areaId === 'kitnet')!.hiddenFor).toEqual([LIA, 'u_gustavo']);
    expect(built.rooms.find((r) => r.areaId === 'sala')!.hiddenFor).toEqual([]);
  });

  it('hides one item and keeps the rest of its room', () => {
    const built = buildHouse(resident(), { entities: { 'light.abajur': { hidden_for: [LIA] }, 'camera.kitnet': { hidden_for: [LIA] } } });
    expect(built.rooms.find((r) => r.areaId === 'sala')!.lights.map((l) => l.entityId)).toEqual(['light.sala']);
    expect(built.rooms.find((r) => r.areaId === 'kitnet')!.lights.map((l) => l.entityId)).toEqual(['light.kitnet']);
    expect(built.security.cameras).toEqual([]);
  });

  it('keeps a danger alert the YAML hides from the resident (decision B)', () => {
    const built = buildHouse(resident(), { entities: { 'binary_sensor.kitnet_fumaca': { hidden_for: [LIA] } } });
    expect(built.alerts.map((a) => a.entityId)).toEqual(['binary_sensor.kitnet_fumaca']);
  });

  it('takes an item moved into a hidden room away with the room', () => {
    const built = buildHouse(resident(), { ...kitnetHidden, entities: { 'light.abajur': { area: 'kitnet' } } });
    expect(allLightIds(built)).toEqual(['light.sala']);
  });

  it('generates no page for a room hidden for the resident, nor for one with nothing left for them', () => {
    const paths = (config: object, h: FakeHass) => generateDashboard(config, h).views.map((v) => v.path);
    expect(paths(kitnetHidden, resident())).not.toContain('kitnet');
    expect(paths(kitnetHidden, installer())).toContain('kitnet');
    const all = ['light.kitnet', 'binary_sensor.kitnet_porta', 'camera.kitnet', 'scene.kitnet_noite'];
    const emptied = { entities: Object.fromEntries(all.map((id) => [id, { hidden_for: [LIA] }])) };
    expect(paths(emptied, resident())).not.toContain('kitnet');
    expect(paths(emptied, resident())).toContain('sala');
  });

  it('reports a hidden_for that is not a list', () => {
    const r = readConfig(resident(), {
      rooms: { kitnet: { hidden_for: LIA as unknown as string[] } },
      entities: { 'light.sala': { hidden_for: 'x' as unknown as string[] } },
    });
    expect(r.problems.map((p) => [p.key, p.message])).toEqual([
      ['entities.light.sala.hidden_for', 'hidden_for precisa ser uma lista, por exemplo [id do usuário].'],
      ['rooms.kitnet.hidden_for', 'hidden_for precisa ser uma lista, por exemplo [id do usuário].'],
    ]);
  });

  it('leaves a dashboard frozen before this version as it was', () => {
    const frozen = { ...buildHouse(installer(), {}).rooms[0]!, hiddenFor: undefined } as unknown as Room;
    expect(normalizeRoom(frozen).hiddenFor).toEqual([]);
  });
});
