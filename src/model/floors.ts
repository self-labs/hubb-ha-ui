import type { HomeAssistant } from '../ha/types';
import { S } from '../strings';
import type { Room, RoomOverride } from './types';

/** One floor tab of the home. */
export interface FloorItem {
  /** A Home Assistant floor id, or OTHER_FLOOR for the rooms with none. */
  floorId: string;
  name: string;
}

/** The tab of the rooms with no floor, when the others have one. */
export const OTHER_FLOOR = 'hubb:outros';

const collator = new Intl.Collator('pt-BR', { sensitivity: 'base', numeric: true });

/** The floor of an area: `rooms.<area>.floor`, else its floor in Home Assistant; only floors that still exist. */
export function roomFloor(hass: HomeAssistant, areaId: string, override?: RoomOverride): string | null {
  const floors = hass.floors ?? {};
  if (override?.floor && floors[override.floor]) return override.floor;
  const id = hass.areas[areaId]?.floor_id;
  return id && floors[id] ? id : null;
}

/** The tabs for the rooms shown: none unless they sit on two or more floors; "Outros" last for the rooms with none. */
export function floorTabs(hass: HomeAssistant, rooms: readonly Room[]): FloorItem[] {
  const ids = [...new Set(rooms.map((r) => r.floorId).filter((f): f is string => f !== null))];
  if (ids.length < 2) return [];
  const floors = hass.floors ?? {};
  const level = (id: string): number => floors[id]?.level ?? Number.MAX_SAFE_INTEGER;
  ids.sort((a, b) => level(a) - level(b) || collator.compare(floors[a]!.name, floors[b]!.name));
  const tabs: FloorItem[] = ids.map((floorId) => ({ floorId, name: floors[floorId]!.name }));
  if (rooms.some((r) => r.floorId === null)) tabs.push({ floorId: OTHER_FLOOR, name: S.otherFloor });
  return tabs;
}

/** The rooms of one tab. */
export function roomsOn(rooms: readonly Room[], floorId: string): Room[] {
  return rooms.filter((r) => (r.floorId ?? OTHER_FLOOR) === floorId);
}

/** The tab to open: the one chosen, else the one remembered on the device, while it exists; else the lowest. */
export function pickFloor(floors: readonly FloorItem[], chosen: string | null, remembered: string | null): string | null {
  if (floors.length === 0) return null;
  for (const id of [chosen, remembered]) if (id && floors.some((f) => f.floorId === id)) return id;
  return floors[0]!.floorId;
}
