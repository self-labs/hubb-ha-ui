import { isArtId } from '../art/drawings';
import { artFor } from '../art/resolve';
import type { HomeAssistant } from '../ha/types';
import { CLIMATE, joinPt, KIND_LABELS, S } from '../strings';
import { applianceName, deviceEntities, findParts, isPowerTwin } from './appliances';
import { areaOf, classify, classifyContext, isClimatePart, type ClassifyContext } from './classify';
import { readConfig } from './config';
import { consumptionOf } from './energy';
import { floorTabs, roomFloor } from './floors';
import { displayName } from './names';
import { roomPath } from './paths';
import { isProfileId, PROFILES } from './profiles';
import { hiddenForList, roomHiddenFor, tabHiddenFor, viewerOf } from './visibility';
import type {
  AlarmItem,
  AlertItem,
  AlertKind,
  CameraItem,
  ClimateExtra,
  House,
  HubbConfig,
  OpeningItem,
  OpeningKind,
  Room,
  RoomOverride,
  SceneItem,
  Security,
  SensorItem,
  SensorKind,
} from './types';

const collator = new Intl.Collator('pt-BR', { sensitivity: 'base', numeric: true });
const LAST = Number.MAX_SAFE_INTEGER;
const byName = (a: { name: string }, b: { name: string }): number => collator.compare(a.name, b.name);

export function isDimmable(hass: HomeAssistant, entityId: string): boolean {
  const modes = hass.states[entityId]?.attributes.supported_color_modes;
  return Array.isArray(modes) && modes.some((m) => m !== 'onoff');
}

function sceneDescription(hass: HomeAssistant, entityId: string, hiddenHere: (areaId: string) => boolean): string | null {
  if (!entityId.startsWith('scene.')) return null;
  const members = hass.states[entityId]?.attributes.entity_id;
  if (!Array.isArray(members)) return null;
  const rooms: string[] = [];
  for (const member of members) {
    if (typeof member !== 'string') continue;
    const areaId = areaOf(hass, member);
    // A room hidden for the resident looking is not named, even in a scene of the whole house.
    const name = areaId && !hiddenHere(areaId) ? hass.areas[areaId]?.name : undefined;
    if (name && !rooms.includes(name)) rooms.push(name);
  }
  return rooms.length ? joinPt(rooms) : null;
}

/**
 * A name that is only the room's (the device "Banheiro" in the Banheiro) says nothing on the room page:
 * the kind of item takes its place, numbered when there are several of that kind. A name from the YAML
 * stays.
 */
function plainNames<T extends { entityId: string; name: string }>(
  items: T[],
  roomName: string,
  word: string | ((item: T) => string),
  named: (id: string) => boolean,
): void {
  const wordOf = (i: T): string => (typeof word === 'string' ? word : word(i));
  const bare = items.filter((i) => !named(i.entityId) && collator.compare(i.name, roomName) === 0);
  for (const w of new Set(bare.map(wordOf))) {
    const same = bare.filter((i) => wordOf(i) === w);
    same.forEach((i, n) => {
      i.name = same.length === 1 ? w : `${w} ${n + 1}`;
    });
  }
}

/** An area as a room with nothing in it yet; buildHouse fills it. */
export function newRoom(hass: HomeAssistant, areaId: string, config: HubbConfig = {}): Room {
  const area = hass.areas[areaId]!;
  const override = config.rooms && typeof config.rooms === 'object' && !Array.isArray(config.rooms) ? config.rooms[areaId] : undefined;
  const profile = PROFILES[isProfileId(config.profile) ? config.profile : 'home'];
  const chosen = override?.art;
  return {
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
    hiddenFor: hiddenForList(override?.hidden_for),
  };
}

/** Whether an entity sits on a device that also has an air conditioner: its thermometer reads the air inside it. */
function onClimateDevice(hass: HomeAssistant, entityId: string): boolean {
  const dev = hass.entities[entityId]?.device_id;
  return !!dev && Object.values(hass.entities).some((e) => e.device_id === dev && e.entity_id.startsWith('climate.'));
}

/** Whether the security tab has anything to show. */
export function hasSecurity(house: House): boolean {
  const s = house.security;
  return s.alarms.length + s.cameras.length + s.openings.length + s.access.length > 0;
}

/**
 * The functions of an air conditioner that its device keeps in entities of their own: Luz do display,
 * Economia de energia, the timers. Each model has its own; the power switch repeats the button of the
 * sheet, and a diagnostic entity or one the installer placed elsewhere is not one of them.
 */
function climateExtras(hass: HomeAssistant, entityId: string, ctx: ClassifyContext): ClimateExtra[] {
  const deviceId = hass.entities[entityId]?.device_id;
  if (!deviceId) return [];
  const order = { switch: 0, select: 1, number: 2 } as const;
  return deviceEntities(hass, deviceId)
    .filter((id) => {
      const reg = hass.entities[id]!;
      return (
        isClimatePart(hass, id, ctx.climateDevices) &&
        reg.entity_category !== 'diagnostic' &&
        !ctx.cfg.entities[id]?.role &&
        !ctx.hidden.has(id) &&
        !isPowerTwin(hass, id)
      );
    })
    .map((id): ClimateExtra => {
      const shown = displayName(hass, id, null);
      const key = hass.entities[id]?.translation_key ?? '';
      const name = CLIMATE.extraWords[key] ?? CLIMATE.extraWords[shown.toLocaleLowerCase('en')] ?? shown;
      return { entityId: id, name, kind: id.slice(0, id.indexOf('.')) as ClimateExtra['kind'] };
    })
    .sort((a, b) => order[a.kind] - order[b.kind] || byName(a, b));
}

const hasContent = (r: Room): boolean =>
  r.lights.length + r.outlets.length + r.equipment.length + r.appliances.length + r.actions.length +
    r.climate.length + r.covers.length + r.media.length + r.access.length >
  0;

export function buildHouse(hass: HomeAssistant, config: HubbConfig = {}): House {
  const cfg = readConfig(hass, config);
  const profile = PROFILES[cfg.profile];
  const viewer = viewerOf(hass);
  const viewerHidden = new Set(viewer ? Object.keys(cfg.entities).filter((id) => cfg.entities[id]!.hiddenFor?.includes(viewer)) : []);
  // An appliance is its device: hidden through one of its marked entities, it is hidden through all.
  const hiddenAppliances = new Set(
    [...viewerHidden].filter((id) => cfg.entities[id]?.role === 'appliance').map((id) => hass.entities[id]?.device_id),
  );
  for (const [id, s] of Object.entries(cfg.entities)) {
    if (s.role === 'appliance' && hiddenAppliances.has(hass.entities[id]?.device_id)) viewerHidden.add(id);
  }
  const ctx = classifyContext(hass, cfg, config.hide_entities, viewerHidden);
  // A tab hidden for the resident takes what only lives in it (spec, Section 8): every scene for
  // Cenas; the alarm card, the cameras and the lists of Segurança. Doors and gates stay in their rooms.
  const scenesHidden = tabHiddenFor(config, 'scenes', viewer);
  const securityHidden = tabHiddenFor(config, 'security', viewer);
  /** A room hidden for the resident looking: nothing of it reaches them but a danger alert. */
  const hiddenHere = (areaId: string | null): boolean => !!areaId && roomHiddenFor(config, areaId, viewer);
  const overrides: Record<string, RoomOverride> =
    config.rooms && typeof config.rooms === 'object' && !Array.isArray(config.rooms) ? config.rooms : {};
  const rooms = new Map<string, Room>();
  const scenes: SceneItem[] = [];
  const placedDevices = new Set<string>();
  const alerts: AlertItem[] = [];
  const alarms: AlarmItem[] = [];
  const cameras: CameraItem[] = [];
  const openings: OpeningItem[] = [];
  let weatherEntityId: string | null = null;

  const roomFor = (areaId: string | null): Room | null => {
    if (!areaId) return null;
    const known = rooms.get(areaId);
    if (known) return known;
    if (!hass.areas[areaId] || overrides[areaId]?.hidden || hiddenHere(areaId)) return null;
    const room = newRoom(hass, areaId, config);
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
      if (scenesHidden || hiddenHere(placed.areaId)) continue;
      const sceneIcon = s?.icon ?? hass.states[entityId]?.attributes.icon;
      scenes.push({
        entityId,
        name: s?.name ?? displayName(hass, entityId, null),
        areaId: placed.areaId,
        description: sceneDescription(hass, entityId, hiddenHere),
        icon: typeof sceneIcon === 'string' && sceneIcon.startsWith('mdi:') ? sceneIcon : null,
      });
      continue;
    }
    if (placed.block === 'alert' || placed.block === 'opening' || placed.block === 'camera' || placed.block === 'alarm') {
      // The house's own: listed with or without a room, the room only names where it is.
      // A danger alert and the alarm are the house's: the room they hang in does not hide them.
      if (placed.block !== 'alert' && placed.block !== 'alarm' && hiddenHere(placed.areaId)) continue;
      const home = roomFor(placed.areaId);
      // Decision B: smoke in a room hidden for the resident still names it, with no page to lead to.
      const roomName = home?.name ?? (hiddenHere(placed.areaId) ? (hass.areas[placed.areaId!]?.name ?? null) : null);
      const path = home?.path ?? null;
      const name = s?.name ?? displayName(hass, entityId, roomName);
      const cls = String(hass.states[entityId]?.attributes.device_class ?? '');
      if (placed.block === 'alert') alerts.push({ entityId, kind: cls as AlertKind, name, roomName, path });
      else if (placed.block === 'camera') {
        if (!securityHidden) cameras.push({ entityId, name, roomName });
      } else if (placed.block === 'alarm') {
        // Decision B: whoever the alarm is hidden for loses its card, never the warning that it went off.
        if (!securityHidden && !ctx.viewerHidden.has(entityId)) alarms.push({ entityId, name });
        alerts.push({ entityId, kind: 'alarm', name, roomName: null, path: null });
      } else {
        const opening: OpeningItem = { entityId, name, kind: cls as OpeningKind, roomName, path };
        if (!securityHidden) openings.push(opening);
        home?.openings.push(opening);
        home?.sensors.push({ entityId, name, kind: opening.kind });
      }
      continue;
    }
    const room = roomFor(placed.areaId);
    if (!room) continue;
    if (placed.block === 'presence') {
      room.presence.push(entityId);
      room.sensors.push({ entityId, name: s?.name ?? displayName(hass, entityId, room.name), kind: 'presence' });
      continue;
    }
    if (placed.block === 'temperature' || placed.block === 'humidity') {
      // The thermometer inside an air conditioner is the air conditioner's: its card already says it,
      // and its integration names it in English ("Room temperature"). It feeds the room line only.
      if (!onClimateDevice(hass, entityId)) {
        room.sensors.push({ entityId, name: s?.name ?? displayName(hass, entityId, room.name), kind: placed.block });
      }
      // A dedicated thermometer first, the inside sensor of an air conditioner after it; then by id.
      const current = room[placed.block];
      if (current === null || (onClimateDevice(hass, current) && !onClimateDevice(hass, entityId))) room[placed.block] = entityId;
      continue;
    }
    const name = s?.name ?? displayName(hass, entityId, room.name);
    if (placed.block === 'light') {
      // A switch with the light role has no brightness: never a sheet, never a bar.
      room.lights.push({ entityId, name, dimmable: entityId.startsWith('light.') && isDimmable(hass, entityId) });
    } else if (placed.block === 'outlet') {
      room.outlets.push({ entityId, name, ...consumptionOf(hass, entityId, s) });
    } else if (placed.block === 'equipment') {
      room.equipment.push({ entityId, name, icon: s?.icon ?? null, ...consumptionOf(hass, entityId, s) });
    } else if (placed.block === 'action') {
      room.actions.push({ entityId, name, icon: s?.icon ?? null });
    } else if (placed.block === 'climate' || placed.block === 'fan') {
      room.climate.push({
        entityId,
        name,
        kind: placed.block,
        modes: s?.modes,
        controls: s?.controls,
        ...(placed.block === 'climate' ? { extras: climateExtras(hass, entityId, ctx), hide: s?.hide.length ? s.hide : undefined } : {}),
      });
    } else if (placed.block === 'cover') {
      room.covers.push({ entityId, name });
    } else if (placed.block === 'media') {
      room.media.push({ entityId, name, ma: ctx.maPairs.get(entityId) ?? null });
    } else if (placed.block === 'gate' || placed.block === 'lock') {
      const domain = entityId.slice(0, entityId.indexOf('.'));
      const kind = placed.block === 'lock' ? 'lock' : domain === 'cover' ? 'cover' : 'pulse';
      room.access.push({ entityId, name, kind, ...(kind === 'pulse' && s?.sensor ? { sensor: s.sensor } : {}) });
    } else {
      // Two entities of one device marked as appliance still make one appliance: the device.
      const deviceId = hass.entities[entityId]!.device_id!;
      if (placedDevices.has(deviceId)) continue;
      placedDevices.add(deviceId);
      room.appliances.push({ deviceId, entityId, name: applianceName(hass, deviceId, s), parts: findParts(hass, deviceId, entityId, s) });
    }
  }

  // A cover used as the sensor of a pulse gate leaves Acesso for everyone: its slide would move the
  // sensor, and for whoever cannot see the gate it would be a way around that.
  const sensorCovers = new Set(Object.values(cfg.entities).flatMap((e) => (e.sensor?.startsWith('cover.') ? [e.sensor] : [])));
  for (const room of rooms.values()) {
    if (sensorCovers.size) room.access = room.access.filter((a) => !sensorCovers.has(a.entityId));
    // A contact speaks through the card of its gate, in the same room only: Sensores shows it in the
    // edit mode alone, and it still counts as open (decision B). Whoever cannot see the gate keeps it.
    const gateOf = new Map(room.access.flatMap((a) => (a.sensor ? [[a.sensor, a.entityId] as const] : [])));
    if (gateOf.size) room.sensors = room.sensors.map((x) => (gateOf.has(x.entityId) ? { ...x, pairedWith: gateOf.get(x.entityId) } : x));
  }

  const order = config.scenes ?? [];
  const rank = (id: string): number => {
    const i = order.indexOf(id);
    return i === -1 ? LAST : i;
  };
  scenes.sort((a, b) => rank(a.entityId) - rank(b.entityId) || byName(a, b));

  const shown = [...rooms.values()].filter(hasContent);
  // A room with nothing to control keeps its page while it has a sensor, or an item hidden there: the
  // installer brings that one back from "Escondidos neste cômodo".
  const sensorRooms = [...rooms.values()].filter(
    (r) =>
      !hasContent(r) &&
      (r.openings.length > 0 || r.presence.length > 0 || r.temperature !== null || r.humidity !== null || (viewer === null && r.hidden.length > 0)),
  );
  const named = (id: string): boolean => !!cfg.entities[id]?.name;
  const rankOf = (id: string): number => cfg.entities[id]?.order ?? LAST;
  const byOrder = (a: { entityId: string; name: string }, b: { entityId: string; name: string }): number =>
    rankOf(a.entityId) - rankOf(b.entityId) || byName(a, b);
  for (const room of sensorRooms) {
    room.openings.sort(byName);
    room.sensors.sort(byOrder);
    room.hidden.sort(byName);
  }
  for (const room of shown) {
    plainNames(room.lights, room.name, S.lightWord, named);
    plainNames(room.outlets, room.name, S.outletWord, named);
    plainNames(room.equipment, room.name, S.equipmentWord, named);
    plainNames(room.climate, room.name, (c) => (c.kind === 'climate' ? S.climateWord : KIND_LABELS[c.kind]), named);
    plainNames(room.covers, room.name, KIND_LABELS.cover, named);
    plainNames(room.media, room.name, KIND_LABELS.media, named);
    plainNames(room.access, room.name, (a) => (a.kind === 'lock' ? KIND_LABELS.lock : KIND_LABELS.gate), named);
    room.lights.sort(byOrder);
    room.outlets.sort(byOrder);
    room.equipment.sort(byOrder);
    room.appliances.sort(byOrder);
    room.actions.sort(byOrder);
    room.climate.sort(byOrder);
    room.covers.sort(byOrder);
    room.media.sort(byOrder);
    room.access.sort(byOrder);
    room.sensors.sort(byOrder);
    room.hidden.sort(byName);
    room.scenes = scenes.filter((s) => s.areaId === room.areaId);
  }
  shown.sort((a, b) => (overrides[a.areaId]?.order ?? LAST) - (overrides[b.areaId]?.order ?? LAST) || byName(a, b));
  // Room by room, the roomless at the end; by name inside a room.
  openings.sort((a, b) => (a.roomName === null ? 1 : 0) - (b.roomName === null ? 1 : 0) || collator.compare(a.roomName ?? '', b.roomName ?? '') || byName(a, b));
  for (const room of shown) room.openings.sort(byName);
  // An alert leads to a room page only when the resident has that page; else to the security tab.
  const pages = new Set([...shown, ...sensorRooms].map((r) => r.path));
  for (const alert of alerts) if (alert.path !== null && !pages.has(alert.path)) alert.path = null;
  const security: Security = {
    alarms: alarms.sort(byName),
    cameras: cameras.sort(byName),
    openings,
    access: securityHidden ? [] : shown.flatMap((r) => r.access.map((a) => ({ ...a, roomName: r.name }))),
  };
  // What "Adicionar cena" offers the installer: scenes and scripts not in Cenas, not hidden in Home
  // Assistant, and not placed elsewhere on purpose (an action or a gate of a room).
  const inCenas = new Set(scenes.map((s) => s.entityId));
  const sceneCandidates = hass.user?.is_admin
    ? Object.keys(hass.entities)
        .filter((id) => (id.startsWith('scene.') || id.startsWith('script.')) && !inCenas.has(id))
        .filter((id) => !hass.entities[id]!.hidden && !hass.entities[id]!.entity_category && !ctx.hidden.has(id))
        .filter((id) => !['action', 'gate'].includes(cfg.entities[id]?.role ?? ''))
        .map((id) => ({ entityId: id, name: cfg.entities[id]?.name ?? displayName(hass, id, null) }))
        .sort(byName)
    : [];

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
    alerts: alerts.sort((a, b) => a.entityId.localeCompare(b.entityId)),
    security,
    sensorRooms,
    sceneCandidates,
  };
}

export function allLightIds(house: House): string[] {
  return house.rooms.flatMap((r) => r.lights.map((l) => l.entityId));
}

const list = <T>(value: T[] | undefined): T[] => (Array.isArray(value) ? value : []);

/**
 * The Sensores of a room frozen before they existed (2026.10.8 and older): its openings by their
 * names, its presence and its thermometer by kind, which is what the row of words they replaced said.
 */
function frozenSensors(room: Room): SensorItem[] {
  const byKind = (entityId: string, kind: SensorKind): SensorItem => ({ entityId, name: KIND_LABELS[kind], kind });
  return [
    ...list(room.openings).map((o): SensorItem => ({ entityId: o.entityId, name: o.name, kind: o.kind })),
    ...list(room.presence).map((id) => byKind(id, 'presence')),
    ...(typeof room.temperature === 'string' ? [byKind(room.temperature, 'temperature')] : []),
    ...(typeof room.humidity === 'string' ? [byKind(room.humidity, 'humidity')] : []),
  ];
}

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
    climate: list(room.climate),
    covers: list(room.covers),
    media: list(room.media),
    access: list(room.access),
    hidden: list(room.hidden),
    openings: list(room.openings),
    presence: list(room.presence),
    temperature: typeof room.temperature === 'string' ? room.temperature : null,
    humidity: typeof room.humidity === 'string' ? room.humidity : null,
    sensors: Array.isArray(room.sensors) ? room.sensors : frozenSensors(room),
    hiddenFor: list(room.hiddenFor),
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
    alerts: list(house.alerts),
    security: {
      alarms: list(house.security?.alarms),
      cameras: list(house.security?.cameras),
      openings: list(house.security?.openings),
      access: list(house.security?.access),
    },
    sensorRooms: list(house.sensorRooms).map(normalizeRoom),
    sceneCandidates: list(house.sceneCandidates),
  };
}
