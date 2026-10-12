import type { HomeAssistant } from './ha/types';
import type { House, Room } from './model/types';
import { joinPt, lightsInRooms, roomWithLights, S } from './strings';

export interface RoomLightsOn {
  room: Room;
  on: string[];
}

export interface Summary {
  headline: string;
  detail: string;
  lightsOn: number;
}

export function lightsOnByRoom(house: House, hass: HomeAssistant): RoomLightsOn[] {
  return house.rooms
    .map((room) => ({
      room,
      on: room.lights.filter((l) => hass.states[l.entityId]?.state === 'on').map((l) => l.entityId),
    }))
    .filter((g) => g.on.length > 0);
}

/** Outlets of a room that are on. */
export function outletsOnIn(room: Room, hass: HomeAssistant): number {
  return room.outlets.filter((o) => hass.states[o.entityId]?.state === 'on').length;
}

/** The sentence at the top of the home screen. Only lights count: an outlet may be a fridge. */
export function summarize(house: House, hass: HomeAssistant): Summary {
  const groups = lightsOnByRoom(house, hass);
  const lightsOn = groups.reduce((n, g) => n + g.on.length, 0);
  if (lightsOn === 0) return { headline: S.allOff, detail: '', lightsOn };
  if (groups.length === 1) {
    return {
      headline: roomWithLights(groups[0]!.room.name, lightsOn),
      detail: house.rooms.filter((r) => r.lights.length > 0).length > 1 ? S.restOff : '',
      lightsOn,
    };
  }
  return { headline: lightsInRooms(lightsOn, groups.length), detail: `${joinPt(groups.map((g) => g.room.name))}.`, lightsOn };
}
