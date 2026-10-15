import { degreeSign } from './actions/climate';
import type { HomeAssistant } from './ha/types';
import { applianceReach, isShownOption, programOf, remainingMinutes, situation, stateText, type ApplianceItem } from './model/appliances';
import type { House, OpeningItem, Room } from './model/types';
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
  REACH,
  SENSE,
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
  // Two rooms read well; a list of six shouts (Gustavo, 14/10): the count says enough.
  const detail = groups.length <= 2 ? `${joinPt(groups.map((g) => g.room.name))}.` : '';
  return { headline: lightsInRooms(lightsOn, groups.length), detail, lightsOn };
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

/** A sensor that reads a number now; null when it is down, unknown or empty. */
function reading(hass: HomeAssistant, entityId: string | null): number | null {
  const state = entityId ? hass.states[entityId]?.state : undefined;
  const v = Number(state);
  return state !== undefined && state !== '' && Number.isFinite(v) ? v : null;
}

/** "24° · 61%": what the thermometer and the hygrometer of the room read; null when they read nothing. */
export function roomClimate(hass: HomeAssistant, room: Room): string | null {
  const t = reading(hass, room.temperature);
  const u = reading(hass, room.humidity);
  const sign = degreeSign(room.temperature ? hass.states[room.temperature]?.attributes.unit_of_measurement : undefined);
  const parts = [t !== null ? `${Math.round(t)}${sign}` : null, u !== null ? `${Math.round(u)}%` : null].filter((p): p is string => p !== null);
  return parts.length ? parts.join(' · ') : null;
}

/** The doors and windows open now: only `on` counts, a sensor that is down says nothing. */
export const openNow = (hass: HomeAssistant, openings: readonly OpeningItem[]): OpeningItem[] =>
  openings.filter((o) => hass.states[o.entityId]?.state === 'on');

/** "Janela aberta", "Porta aberta"; an opening sensor of no known kind says its name. */
export const openingWord = (o: OpeningItem): string => SENSE.open[o.kind] ?? SENSE.openNamed(o.name);

/** Someone is in the room: a motion, occupancy or presence sensor is on. */
export const occupied = (hass: HomeAssistant, room: Room): boolean => room.presence.some((id) => hass.states[id]?.state === 'on');

/** The line under the room name on its page. */
export function roomHeroStatus(room: Room, hass: HomeAssistant): string {
  if (room.lights.length) return roomStatus(lightsOnIn(room, hass), room.lights.length);
  if (room.equipment.length) return devicesStatus(devicesOnIn(room, hass), room.outlets.length + room.equipment.length);
  if (room.outlets.length) return outletStatus(outletsOnIn(room, hass), room.outlets.length);
  const appliance = room.appliances[0];
  return appliance ? applianceLine(hass, appliance) : '';
}

/** The line under a room card on the home, after "Ocupado · " while someone is in it. */
export function roomCardStatus(room: Room, hass: HomeAssistant): string {
  const line = cardLine(room, hass);
  return occupied(hass, room) ? SENSE.occupiedLine(line) : line;
}

/** The lights first, then the outlets and the equipment, then the appliance. */
function cardLine(room: Room, hass: HomeAssistant): string {
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
  const reach = applianceReach(hass, item.parts);
  // Out of reach, the state on screen is the last one it sent: it may be stale.
  if (reach === 'offline') return REACH.offline;
  const working = situation(hass, item.parts) !== 'stopped';
  // While it works the time left matters more; stopped, what keeps it from starting from here.
  if (reach === 'remote-off' && !working) return REACH.remoteOff;
  const text = stateText(hass, item.parts, item.name);
  if (text === null) return S.noState;
  const minutes = remainingMinutes(hass, item.parts);
  return working && minutes !== null && minutes > 0 ? `${text} · ${minutesLeft(minutes)}` : text;
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
