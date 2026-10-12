import { isArtId } from '../art/drawings';
import { artFor } from '../art/resolve';
import type { HomeAssistant } from '../ha/types';
import { joinPt } from '../strings';
import { displayName } from './names';
import { roomPath } from './paths';
import type { House, HubbConfig, Room, SceneItem } from './types';

export const SCENE_LABEL = 'hubb_cena';

const collator = new Intl.Collator('pt-BR', { sensitivity: 'base', numeric: true });
const LAST = Number.MAX_SAFE_INTEGER;

/** The area of an entity, else the area of its device. */
export function entityAreaId(hass: HomeAssistant, entityId: string): string | null {
  const reg = hass.entities[entityId];
  if (!reg) return null;
  if (reg.area_id) return reg.area_id;
  return reg.device_id ? (hass.devices[reg.device_id]?.area_id ?? null) : null;
}

export function isDimmable(hass: HomeAssistant, entityId: string): boolean {
  const modes = hass.states[entityId]?.attributes.supported_color_modes;
  return Array.isArray(modes) && modes.some((m) => m !== 'onoff');
}

function isShown(hass: HomeAssistant, entityId: string, hidden: ReadonlySet<string>): boolean {
  const reg = hass.entities[entityId];
  return !!reg && !reg.hidden && !reg.entity_category && !hidden.has(entityId);
}

function sceneDescription(hass: HomeAssistant, entityId: string): string | null {
  if (!entityId.startsWith('scene.')) return null;
  const members = hass.states[entityId]?.attributes.entity_id;
  if (!Array.isArray(members)) return null;
  const rooms: string[] = [];
  for (const member of members) {
    if (typeof member !== 'string') continue;
    const areaId = entityAreaId(hass, member);
    const name = areaId ? hass.areas[areaId]?.name : undefined;
    if (name && !rooms.includes(name)) rooms.push(name);
  }
  return rooms.length ? joinPt(rooms) : null;
}

export function buildHouse(hass: HomeAssistant, config: HubbConfig = {}): House {
  const hidden = new Set(config.hide_entities ?? []);
  const overrides = config.rooms ?? {};
  const rooms = new Map<string, Room>();
  const scenes: SceneItem[] = [];
  let weatherEntityId: string | null = null;

  const roomFor = (areaId: string): Room | null => {
    const known = rooms.get(areaId);
    if (known) return known;
    const area = hass.areas[areaId];
    const override = overrides[areaId];
    if (!area || override?.hidden) return null;
    const chosen = override?.art;
    const room: Room = {
      areaId,
      path: roomPath(areaId),
      name: area.name,
      photo: override?.photo ?? area.picture ?? null,
      icon: area.icon ?? null,
      art: isArtId(chosen) ? chosen : artFor(area.name, area.icon),
      lights: [],
      outlets: [],
      scenes: [],
    };
    rooms.set(areaId, room);
    return room;
  };

  for (const entityId of Object.keys(hass.entities).sort()) {
    const domain = entityId.slice(0, entityId.indexOf('.'));
    if (domain === 'weather') {
      if (!weatherEntityId && hass.states[entityId]) weatherEntityId = entityId;
      continue;
    }
    if (!isShown(hass, entityId, hidden)) continue;
    const areaId = entityAreaId(hass, entityId);
    if (domain === 'light') {
      const room = areaId ? roomFor(areaId) : null;
      if (room) {
        room.lights.push({ entityId, name: displayName(hass, entityId, room.name), dimmable: isDimmable(hass, entityId) });
      }
    } else if (domain === 'switch' && hass.states[entityId]?.attributes.device_class === 'outlet') {
      // Only a switch the installer marked as an outlet; any other switch stays out of the panel.
      const room = areaId ? roomFor(areaId) : null;
      if (room) room.outlets.push({ entityId, name: displayName(hass, entityId, room.name) });
    } else if ((domain === 'scene' || domain === 'script') && hass.entities[entityId].labels.includes(SCENE_LABEL)) {
      scenes.push({ entityId, name: displayName(hass, entityId, null), areaId, description: sceneDescription(hass, entityId) });
    }
  }

  const order = config.scenes ?? [];
  const rank = (id: string): number => {
    const i = order.indexOf(id);
    return i === -1 ? LAST : i;
  };
  scenes.sort((a, b) => rank(a.entityId) - rank(b.entityId) || collator.compare(a.name, b.name));

  const shown = [...rooms.values()].filter((r) => r.lights.length > 0 || r.outlets.length > 0);
  for (const room of shown) {
    room.lights.sort((a, b) => collator.compare(a.name, b.name));
    room.outlets.sort((a, b) => collator.compare(a.name, b.name));
    room.scenes = scenes.filter((s) => s.areaId === room.areaId);
  }
  shown.sort(
    (a, b) =>
      (overrides[a.areaId]?.order ?? LAST) - (overrides[b.areaId]?.order ?? LAST) || collator.compare(a.name, b.name),
  );

  return { name: config.name || hass.config.location_name || 'Casa', rooms: shown, scenes, weatherEntityId };
}

export function allLightIds(house: House): string[] {
  return house.rooms.flatMap((r) => r.lights.map((l) => l.entityId));
}

/**
 * A room as a screen receives it. A dashboard frozen with "Take control" on 2026.10.2 keeps rooms
 * with no `art` and no `outlets`; filling them in keeps those screens working after an update.
 */
export function normalizeRoom(room: Room): Room {
  return {
    ...room,
    art: isArtId(room.art) ? room.art : artFor(room.name, room.icon),
    outlets: Array.isArray(room.outlets) ? room.outlets : [],
  };
}
