import { describe, expect, it } from 'vitest';
import { floorTabs, OTHER_FLOOR, pickFloor, roomFloor, roomsOn } from '../../src/model/floors';
import type { Room } from '../../src/model/types';
import { area, floor, makeHass } from '../helpers/fake-hass';

const room = (areaId: string, floorId: string | null): Room => ({
  areaId,
  path: areaId,
  name: areaId,
  photo: null,
  icon: null,
  art: 'casa',
  floorId,
  lights: [],
  outlets: [],
  equipment: [],
  appliances: [],
  actions: [],
  climate: [],
  covers: [],
  media: [],
  access: [],
  scenes: [],
  hidden: [],
  openings: [],
  presence: [],
  temperature: null,
  humidity: null,
  sensors: [],
});

function hass() {
  return makeHass({
    floors: [floor('superior', 'Superior', 1), floor('terreo', 'Térreo', 0), floor('anexo', 'Anexo', null), floor('mezanino', 'Mezanino', 1)],
    areas: [area('sala', 'Sala', null, 'terreo'), area('quarto', 'Quarto', null, 'apagado'), area('varanda', 'Varanda')],
  });
}

describe('roomFloor', () => {
  it('takes the floor of the configuration, else the floor of the area, and only floors that exist', () => {
    const h = hass();
    expect(roomFloor(h, 'sala')).toBe('terreo');
    expect(roomFloor(h, 'sala', { floor: 'superior' })).toBe('superior');
    expect(roomFloor(h, 'sala', { floor: 'terceiro' })).toBe('terreo');
    expect(roomFloor(h, 'quarto')).toBeNull();
    expect(roomFloor(h, 'varanda')).toBeNull();
  });
});

describe('floorTabs', () => {
  it('shows no tabs while the rooms sit on one floor or on none', () => {
    const h = hass();
    expect(floorTabs(h, [room('a', 'terreo'), room('b', 'terreo'), room('c', null)])).toEqual([]);
    expect(floorTabs(h, [room('a', null)])).toEqual([]);
  });

  it('orders the tabs by level, then by name, with no level at the end and "Outros" last', () => {
    const tabs = floorTabs(hass(), [room('a', 'superior'), room('b', 'anexo'), room('c', 'terreo'), room('d', 'mezanino'), room('e', null)]);
    expect(tabs).toEqual([
      { floorId: 'terreo', name: 'Térreo' },
      { floorId: 'mezanino', name: 'Mezanino' },
      { floorId: 'superior', name: 'Superior' },
      { floorId: 'anexo', name: 'Anexo' },
      { floorId: OTHER_FLOOR, name: 'Outros' },
    ]);
  });

  it('gives each tab its rooms', () => {
    const rooms = [room('a', 'terreo'), room('b', null), room('c', 'terreo')];
    expect(roomsOn(rooms, 'terreo').map((r) => r.areaId)).toEqual(['a', 'c']);
    expect(roomsOn(rooms, OTHER_FLOOR).map((r) => r.areaId)).toEqual(['b']);
  });
});

describe('pickFloor', () => {
  const tabs = [{ floorId: 'terreo', name: 'Térreo' }, { floorId: 'primeiro', name: '1º andar' }];

  it('opens the tab chosen, else the one remembered, while it still exists; else the first', () => {
    expect(pickFloor(tabs, 'primeiro', 'terreo')).toBe('primeiro');
    expect(pickFloor(tabs, null, 'primeiro')).toBe('primeiro');
    expect(pickFloor(tabs, null, 'apagado')).toBe('terreo');
    expect(pickFloor(tabs, 'apagado', null)).toBe('terreo');
    expect(pickFloor([], 'terreo', 'terreo')).toBeNull();
  });
});
