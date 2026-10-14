import { isArtId } from '../art/drawings';
import { artFor } from '../art/resolve';
import type { HomeAssistant } from '../ha/types';
import { joinPt, S } from '../strings';
import { applianceName, findParts } from './appliances';
import { areaOf, classify, classifyContext } from './classify';
import { readConfig } from './config';
import { floorTabs, roomFloor } from './floors';
import { displayName } from './names';
import { roomPath } from './paths';
import { isProfileId, PROFILES } from './profiles';
import type { House, HubbConfig, Room, RoomOverride, SceneItem } from './types';

const collator = new Intl.Collator('pt-BR', { sensitivity: 'base', numeric: true });
const LAST = Number.MAX_SAFE_INTEGER;
const byName = (a: { name: string }, b: { name: string }): number => collator.compare(a.name, b.name);

export function isDimmable(hass: HomeAssistant, entityId: string): boolean {
  const modes = hass.states[entityId]?.attributes.supported_color_modes;
  return Array.isArray(modes) && modes.some((m) => m !== 'onoff');
}

function sceneDescription(hass: HomeAssistant, entityId: string): string | null {
  if (!entityId.startsWith('scene.')) return null;
  const members = hass.states[entityId]?.attributes.entity_id;
  if (!Array.isArray(members)) return null;
  const rooms: string[] = [];
  for (const member of members) {
    if (typeof member !== 'string') continue;
    const areaId = areaOf(hass, member);
    const name = areaId ? hass.areas[areaId]?.name : undefined;
    if (name && !rooms.includes(name)) rooms.push(name);
  }
  return rooms.length ? joinPt(rooms) : null;
}

/**
 * A name that is only the room's (the device "Banheiro" in the Banheiro) says nothing on the room page:
 * the kind of item takes its place, numbered when there are several. A name from the YAML stays.
 */
function plainNames(items: { entityId: string; name: string }[], roomName: string, word: string, named: (id: string) => boolean): void {
  const bare = items.filter((i) => !named(i.entityId) && collator.compare(i.name, roomName) === 0);
  bare.forEach((i, n) => {
    i.name = bare.length === 1 ? word : `${word} ${n + 1}`;
  });
}

const hasContent = (r: Room): boolean =>
  r.lights.length + r.outlets.length + r.equipment.length + r.appliances.length + r.actions.length > 0;

export function buildHouse(hass: HomeAssistant, config: HubbConfig = {}): House {
  const cfg = readConfig(hass, config);
  const profile = PROFILES[cfg.profile];
  const ctx = classifyContext(hass, cfg, config.hide_entities);
  const overrides: Record<string, RoomOverride> =
    config.rooms && typeof config.rooms === 'object' && !Array.isArray(config.rooms) ? config.rooms : {};
  const rooms = new Map<string, Room>();
  const scenes: SceneItem[] = [];
  const placedDevices = new Set<string>();
  let weatherEntityId: string | null = null;

  const roomFor = (areaId: string | null): Room | null => {
    if (!areaId) return null;
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
      art: isArtId(chosen) ? chosen : artFor(area.name, area.icon, profile.defaultArt, profile.generic),
      floorId: roomFloor(hass, areaId, override),
      lights: [],
      outlets: [],
      equipment: [],
      appliances: [],
      actions: [],
      scenes: [],
      hidden: [],
    };
    rooms.set(areaId, room);
    return room;
  };

  for (const entityId of Object.keys(hass.entities).sort()) {
    if (entityId.startsWith('weather.')) {
      if (!weatherEntityId && hass.states[entityId]) weatherEntityId = entityId;
      continue;
    }
    const placed = classify(hass, entityId, ctx);
    if (placed.block === null) {
      // Hidden by the configuration (not by Home Assistant): the editor lists it to show it again.
      const reg = hass.entities[entityId];
      const byConfig = ctx.hidden.has(entityId) || cfg.entities[entityId]?.role === 'hidden';
      if (placed.why === 'hidden' && byConfig && reg && !reg.hidden) {
        const room = roomFor(areaOf(hass, entityId, cfg.entities[entityId]?.area));
        if (room) room.hidden.push({ entityId, name: cfg.entities[entityId]?.name ?? displayName(hass, entityId, room.name) });
      }
      continue;
    }
    const s = cfg.entities[entityId];
    if (placed.block === 'scene') {
      scenes.push({
        entityId,
        name: s?.name ?? displayName(hass, entityId, null),
        areaId: placed.areaId,
        description: sceneDescription(hass, entityId),
      });
      continue;
    }
    const room = roomFor(placed.areaId);
    if (!room) continue;
    const name = s?.name ?? displayName(hass, entityId, room.name);
    if (placed.block === 'light') {
      // A switch with the light role has no brightness: never a sheet, never a bar.
      room.lights.push({ entityId, name, dimmable: entityId.startsWith('light.') && isDimmable(hass, entityId) });
    } else if (placed.block === 'outlet') {
      room.outlets.push({ entityId, name });
    } else if (placed.block === 'equipment') {
      room.equipment.push({ entityId, name, icon: s?.icon ?? null });
    } else if (placed.block === 'action') {
      room.actions.push({ entityId, name, icon: s?.icon ?? null });
    } else {
      // Two entities of one device marked as appliance still make one appliance: the device.
      const deviceId = hass.entities[entityId]!.device_id!;
      if (placedDevices.has(deviceId)) continue;
      placedDevices.add(deviceId);
      room.appliances.push({ deviceId, entityId, name: applianceName(hass, deviceId, s), parts: findParts(hass, deviceId, entityId, s) });
    }
  }

  const order = config.scenes ?? [];
  const rank = (id: string): number => {
    const i = order.indexOf(id);
    return i === -1 ? LAST : i;
  };
  scenes.sort((a, b) => rank(a.entityId) - rank(b.entityId) || byName(a, b));

  const shown = [...rooms.values()].filter(hasContent);
  const named = (id: string): boolean => !!cfg.entities[id]?.name;
  const rankOf = (id: string): number => cfg.entities[id]?.order ?? LAST;
  const byOrder = (a: { entityId: string; name: string }, b: { entityId: string; name: string }): number =>
    rankOf(a.entityId) - rankOf(b.entityId) || byName(a, b);
  for (const room of shown) {
    plainNames(room.lights, room.name, S.lightWord, named);
    plainNames(room.outlets, room.name, S.outletWord, named);
    plainNames(room.equipment, room.name, S.equipmentWord, named);
    room.lights.sort(byOrder);
    room.outlets.sort(byOrder);
    room.equipment.sort(byOrder);
    room.appliances.sort(byOrder);
    room.actions.sort(byOrder);
    room.hidden.sort(byName);
    room.scenes = scenes.filter((s) => s.areaId === room.areaId);
  }
  shown.sort((a, b) => (overrides[a.areaId]?.order ?? LAST) - (overrides[b.areaId]?.order ?? LAST) || byName(a, b));

  return {
    name: config.name || hass.config.location_name || 'Casa',
    profile: cfg.profile,
    homeLabel: profile.homeLabel,
    floors: floorTabs(hass, shown),
    rooms: shown,
    hiddenRooms: Object.keys(overrides)
      .filter((areaId) => overrides[areaId]?.hidden && hass.areas[areaId])
      .map((areaId) => ({ areaId, name: hass.areas[areaId]!.name }))
      .sort(byName),
    scenes,
    weatherEntityId,
  };
}

export function allLightIds(house: House): string[] {
  return house.rooms.flatMap((r) => r.lights.map((l) => l.entityId));
}

const list = <T>(value: T[] | undefined): T[] => (Array.isArray(value) ? value : []);

/**
 * A room as a screen receives it. A dashboard frozen with "Take control" on an older version keeps
 * rooms without the newer fields; filling them in keeps those screens working after an update.
 */
export function normalizeRoom(room: Room): Room {
  return {
    ...room,
    art: isArtId(room.art) ? room.art : artFor(room.name, room.icon),
    floorId: typeof room.floorId === 'string' ? room.floorId : null,
    outlets: list(room.outlets),
    equipment: list(room.equipment),
    appliances: list(room.appliances),
    actions: list(room.actions),
    hidden: list(room.hidden),
  };
}

/** The house as the home screen receives it, frozen dashboards included. */
export function normalizeHouse(house: House): House {
  return {
    ...house,
    profile: isProfileId(house.profile) ? house.profile : 'home',
    homeLabel: typeof house.homeLabel === 'string' && house.homeLabel ? house.homeLabel : S.home,
    floors: list(house.floors),
    hiddenRooms: list(house.hiddenRooms),
    rooms: house.rooms.map(normalizeRoom),
  };
}
