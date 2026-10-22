import { describe, expect, it } from 'vitest';
import { buildHouse } from '../../src/model/build-house';
import { pickRoom } from '../../src/model/pick-room';
import { area, makeHass } from '../helpers/fake-hass';

function house(on: string[] = []) {
  const h = makeHass({
    areas: [area('sala', 'Sala'), area('cozinha', 'Cozinha'), area('quarto', 'Quarto')],
    entities: [
      { entity_id: 'light.sala', area_id: 'sala', name: 'Teto', state: on.includes('sala') ? 'on' : 'off' },
      { entity_id: 'light.cozinha', area_id: 'cozinha', name: 'Bancada', state: on.includes('cozinha') ? 'on' : 'off' },
      { entity_id: 'light.quarto', area_id: 'quarto', name: 'Cama', state: on.includes('quarto') ? 'on' : 'off' },
    ],
  });
  return { h, rooms: buildHouse(h).rooms };
}

const none = { chosen: null, tablet: null, remembered: null };

describe('the room the wide home opens on the right', () => {
  it('the one chosen now wins', () => {
    const { h, rooms } = house(['sala']);
    expect(pickRoom(rooms, h, { ...none, chosen: 'quarto', tablet: 'cozinha' })?.areaId).toBe('quarto');
  });

  it('a chosen room that is gone falls back to the room of the tablet', () => {
    const { h, rooms } = house();
    expect(pickRoom(rooms, h, { ...none, chosen: 'garagem', tablet: 'cozinha' })?.areaId).toBe('cozinha');
  });

  it('a tablet room that is gone falls back to the one remembered on this device', () => {
    const { h, rooms } = house();
    expect(pickRoom(rooms, h, { chosen: null, tablet: 'garagem', remembered: 'quarto' })?.areaId).toBe('quarto');
  });

  it('with nothing chosen, the first room with a light on', () => {
    const { h, rooms } = house(['quarto']);
    expect(pickRoom(rooms, h, none)?.areaId).toBe('quarto');
  });

  it('everything off: the first room', () => {
    const { h, rooms } = house();
    expect(pickRoom(rooms, h, none)?.areaId).toBe(rooms[0]!.areaId);
  });

  it('no room at all: none', () => {
    const { h } = house();
    expect(pickRoom([], h, none)).toBeNull();
  });
});
