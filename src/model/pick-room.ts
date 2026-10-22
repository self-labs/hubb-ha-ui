import type { HomeAssistant } from '../ha/types';
import type { Room } from './types';

/**
 * The room the wide home opens on its right side: the one picked now, then the room of the wall
 * tablet, then the one this device remembers, then the first with a light on, then the first. A room
 * that is not on the list any more (hidden for the viewer, its area deleted) is skipped.
 */
export function pickRoom(
  rooms: readonly Room[],
  hass: HomeAssistant,
  wanted: { chosen: string | null; tablet: string | null; remembered: string | null },
): Room | null {
  return wantedRoom(rooms, wanted) ?? rooms.find((r) => r.lights.some((l) => hass.states[l.entityId]?.state === 'on')) ?? rooms[0] ?? null;
}

/**
 * The room picked now, then the room of the wall tablet, then the one this device remembers, when
 * it is on the list; null otherwise. The home looks for it on every floor, and shows its floor.
 */
export function wantedRoom(
  rooms: readonly Room[],
  wanted: { chosen: string | null; tablet: string | null; remembered: string | null },
): Room | null {
  for (const id of [wanted.chosen, wanted.tablet, wanted.remembered]) {
    const room = id ? rooms.find((r) => r.areaId === id) : undefined;
    if (room) return room;
  }
  return null;
}
