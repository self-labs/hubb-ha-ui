import type { HomeAssistant } from './ha/types';
import { isShownOption, programOf, remainingMinutes, situation, stateText, type ApplianceItem } from './model/appliances';
import type { House, Room } from './model/types';
import {
  applianceChip,
  devicesOnCount,
  devicesStatus,
  joinPt,
  minutesLeft,
  lightsInRooms,
  onCount,
  outletsOnCount,
  outletStatus,
  roomStatus,
  roomWithLights,
  S,
} from './strings';

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

const lightsOnIn = (room: Room, hass: HomeAssistant): number =>
  room.lights.filter((l) => hass.states[l.entityId]?.state === 'on').length;

/** Lights on across some rooms: the number on a floor tab. */
export function lightsOnAcross(rooms: readonly Room[], hass: HomeAssistant): number {
  return rooms.reduce((n, room) => n + lightsOnIn(room, hass), 0);
}

/** Outlets and equipment of a room that are on. */
export function devicesOnIn(room: Room, hass: HomeAssistant): number {
  return [...room.outlets, ...room.equipment].filter((d) => hass.states[d.entityId]?.state === 'on').length;
}

/** The line under the room name on its page. */
export function roomHeroStatus(room: Room, hass: HomeAssistant): string {
  if (room.lights.length) return roomStatus(lightsOnIn(room, hass), room.lights.length);
  if (room.equipment.length) return devicesStatus(devicesOnIn(room, hass), room.outlets.length + room.equipment.length);
  if (room.outlets.length) return outletStatus(outletsOnIn(room, hass), room.outlets.length);
  const appliance = room.appliances[0];
  return appliance ? applianceLine(hass, appliance) : '';
}

/** The line under a room card on the home: the lights first, then the outlets and the equipment. */
export function roomCardStatus(room: Room, hass: HomeAssistant): string {
  const on = lightsOnIn(room, hass);
  if (on) return onCount(on);
  const busy = busyAppliances([room], hass)[0];
  if (busy) return applianceChipText(hass, busy.item);
  if (room.lights.length) return S.roomOff;
  if (room.equipment.length) {
    const n = devicesOnIn(room, hass);
    return n ? devicesOnCount(n) : S.roomOutletsOff;
  }
  if (room.outlets.length) {
    const plugged = outletsOnIn(room, hass);
    return plugged ? outletsOnCount(plugged) : S.roomOutletsOff;
  }
  const appliance = room.appliances[0];
  return appliance ? applianceLine(hass, appliance) : '';
}

/** The state line of an appliance: "Lavando · faltam 40 min" while it runs or waits paused, the state alone otherwise. */
export function applianceLine(hass: HomeAssistant, item: ApplianceItem): string {
  const text = stateText(hass, item.parts, item.name);
  if (text === null) return S.noState;
  const minutes = remainingMinutes(hass, item.parts);
  return situation(hass, item.parts) !== 'stopped' && minutes !== null && minutes > 0 ? `${text} · ${minutesLeft(minutes)}` : text;
}

export interface PlacedAppliance {
  item: ApplianceItem;
  room: Room;
}

/** The appliances working now, room by room. */
export function busyAppliances(rooms: readonly Room[], hass: HomeAssistant): PlacedAppliance[] {
  return rooms.flatMap((room) =>
    room.appliances.filter((item) => situation(hass, item.parts) === 'working').map((item) => ({ item, room })),
  );
}

/** "Lavadora · 40 min" on the home; the state in place of the time when the time is unknown. */
export function applianceChipText(hass: HomeAssistant, item: ApplianceItem): string {
  const minutes = remainingMinutes(hass, item.parts);
  if (minutes !== null && minutes > 0) return applianceChip(item.name, `${minutes} min`);
  const text = stateText(hass, item.parts, item.name);
  return text ? applianceChip(item.name, text) : item.name;
}

/** The appliance of a device, with its room. */
export function findAppliance(rooms: readonly Room[], deviceId: string): PlacedAppliance | null {
  for (const room of rooms) {
    const item = room.appliances.find((a) => a.deviceId === deviceId);
    if (item) return { item, room };
  }
  return null;
}

/** Under the name on the appliance sheet: the room, and the program when the appliance has one. */
export function applianceSubheading(hass: HomeAssistant, item: ApplianceItem, roomName: string): string {
  const program = programOf(item.parts);
  const st = program ? hass.states[program] : undefined;
  if (!program || !st || !isShownOption(hass, program)) return roomName;
  return `${roomName} · ${hass.formatEntityState ? hass.formatEntityState(st) : st.state}`;
}
