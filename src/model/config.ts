import { isArtId } from '../art/drawings';
import type { HomeAssistant } from '../ha/types';
import { CFG } from '../strings';
import { isProfileId, type ProfileId } from './profiles';
import { isGateSensor } from './gate-sensor';
import { isSize, wholeRowOnly } from './sizes';
import type { HubbConfig } from './types';

/** The roles an entity can be given in `entities.<id>.role`. */
export const ROLES = ['light', 'outlet', 'equipment', 'appliance', 'action', 'gate', 'scene', 'hidden'] as const;
export type Role = (typeof ROLES)[number];

/** How an item shows on its room page: a role, or a kind its type alone decides. */
export type ItemKind =
  | Role
  | 'climate'
  | 'fan'
  | 'cover'
  | 'media'
  | 'lock'
  | 'door'
  | 'window'
  | 'garage_door'
  | 'opening'
  | 'presence'
  | 'temperature'
  | 'humidity';

/** The domains each role can be given to; `appliance` takes any entity with a device, `hidden` any entity. */
export const ROLE_DOMAINS: Readonly<Record<Exclude<Role, 'hidden' | 'appliance'>, readonly string[]>> = {
  light: ['light', 'switch'],
  outlet: ['switch'],
  equipment: ['switch'],
  action: ['button', 'input_button', 'script'],
  /** A pulse relay, a button or a script that opens the gate, or a cover that does not say it is one. */
  gate: ['switch', 'button', 'input_button', 'script', 'cover'],
  /** A scene or a script in Cenas, put there from the panel (the hubb_cena label still works). */
  scene: ['scene', 'script'],
};

export interface EntitySettings {
  role?: Role;
  name?: string;
  /** An `mdi:*` icon name, drawn by Home Assistant's own `ha-icon`. */
  icon?: string;
  area?: string;
  /** Appliance only: entities of the device left out of the panel. */
  hide: string[];
  remaining?: string;
  progress?: string;
  /** The power and energy sensors of an outlet or equipment, when the panel cannot match them. */
  power?: string;
  energy?: string;
  /** An air conditioner: the modes its sheet offers, and its settings under "Mais ajustes". */
  modes?: string[];
  controls?: string[];
  order?: number;
  /** User ids this item is hidden for. */
  hiddenFor?: string[];
  /** A pulse gate: the door contact or cover that says whether it is open. */
  sensor?: string;
}

/** The settings of an air conditioner that can be kept off its sheet. */
export const CLIMATE_CONTROLS = ['fan', 'swing', 'preset'] as const;

export interface ConfigProblem {
  /** Where in the YAML: "profile", "entities.switch.x.role", "rooms.sala.floor". */
  key: string;
  /** The entity it is about, when there is one. */
  entityId: string | null;
  /** What is wrong, in Portuguese, ready to show. */
  message: string;
}

/** The configuration as the panel uses it: only valid values, plus what was wrong with the rest. */
export interface PanelConfig {
  profile: ProfileId;
  entities: Readonly<Record<string, EntitySettings>>;
  problems: ConfigProblem[];
}

const domainOf = (entityId: string): string => entityId.slice(0, entityId.indexOf('.'));
const isRole = (v: unknown): v is Role => typeof v === 'string' && (ROLES as readonly string[]).includes(v);

/** Whether `role` can be given to `entityId`. */
export function roleFits(hass: HomeAssistant, role: Role, entityId: string): boolean {
  if (role === 'hidden') return true;
  if (role === 'appliance') return !!hass.entities[entityId]?.device_id;
  return ROLE_DOMAINS[role].includes(domainOf(entityId));
}

function exists(hass: HomeAssistant, entityId: string): boolean {
  return !!hass.entities[entityId] || !!hass.states[entityId];
}

export function readConfig(hass: HomeAssistant, config: HubbConfig): PanelConfig {
  const problems: ConfigProblem[] = [];
  const add = (key: string, entityId: string | null, message: string): void => {
    problems.push({ key, entityId, message });
  };

  let profile: ProfileId = 'home';
  if (config.profile !== undefined) {
    if (isProfileId(config.profile)) profile = config.profile;
    else add('profile', null, CFG.unknownProfile(String(config.profile)));
  }

  const entities: Record<string, EntitySettings> = {};
  const raw = config.entities && typeof config.entities === 'object' ? config.entities : {};
  for (const [entityId, value] of Object.entries(raw)) {
    const at = `entities.${entityId}`;
    if (!exists(hass, entityId)) {
      add(at, entityId, CFG.missingEntity(entityId));
      continue;
    }
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      add(at, entityId, CFG.badEntry(entityId));
      continue;
    }
    const v = value as Record<string, unknown>;
    const s: EntitySettings = { hide: [] };
    if (v.role !== undefined) {
      const reg = hass.entities[entityId];
      if (!isRole(v.role)) add(`${at}.role`, entityId, CFG.unknownRole(String(v.role)));
      else if (v.role === 'appliance' && !reg?.device_id) add(`${at}.role`, entityId, CFG.applianceNeedsDevice(entityId));
      else if (!roleFits(hass, v.role, entityId)) add(`${at}.role`, entityId, CFG.roleDoesNotFit(v.role, domainOf(entityId)));
      // A configuration or diagnostic entity stays out (spec, Section 3); only the parts of an appliance pass.
      else if (reg?.entity_category && v.role !== 'appliance' && v.role !== 'hidden') add(`${at}.role`, entityId, CFG.categoryRole(entityId));
      else s.role = v.role;
    }
    if (v.name !== undefined) {
      if (typeof v.name === 'string') {
        if (v.name.trim()) s.name = v.name.trim();
      } else add(`${at}.name`, entityId, CFG.badName(entityId));
    }
    if (v.order !== undefined) {
      if (typeof v.order === 'number' && Number.isFinite(v.order)) s.order = v.order;
      else add(`${at}.order`, entityId, CFG.badOrder(entityId));
    }
    if (v.icon !== undefined) {
      if (typeof v.icon === 'string' && v.icon.startsWith('mdi:')) s.icon = v.icon;
      else add(`${at}.icon`, entityId, CFG.badIcon(String(v.icon)));
    }
    if (v.area !== undefined) {
      if (typeof v.area === 'string' && hass.areas[v.area]) s.area = v.area;
      else add(`${at}.area`, entityId, CFG.unknownArea(String(v.area)));
    }
    // hide, remaining and progress tune an appliance; on any other role they would do nothing.
    const appliance = v.role === 'appliance';
    if (v.hide !== undefined) {
      // An appliance leaves entities of its device off its sheet; an air conditioner, its functions.
      if (!appliance && !entityId.startsWith('climate.')) add(`${at}.hide`, entityId, CFG.hideOnly);
      else if (Array.isArray(v.hide)) s.hide = v.hide.filter((h): h is string => typeof h === 'string');
    }
    for (const key of ['remaining', 'progress'] as const) {
      const ref = v[key];
      if (ref === undefined) continue;
      if (!appliance) {
        add(`${at}.${key}`, entityId, CFG.applianceOnly(key));
        continue;
      }
      if (typeof ref === 'string' && hass.states[ref]) s[key] = ref;
      else add(`${at}.${key}`, entityId, CFG.missingEntity(String(ref)));
    }
    // What the sheet of an air conditioner offers: the installer keeps what the device really does.
    const climate = entityId.startsWith('climate.');
    if (v.modes !== undefined) {
      if (!climate) add(`${at}.modes`, entityId, CFG.climateOnly('modes'));
      else if (Array.isArray(v.modes) && v.modes.every((m) => typeof m === 'string')) s.modes = v.modes;
      else add(`${at}.modes`, entityId, CFG.badList('modes', 'cool, dry'));
    }
    if (v.controls !== undefined) {
      const wrong = Array.isArray(v.controls) ? v.controls.find((c) => !(CLIMATE_CONTROLS as readonly unknown[]).includes(c)) : undefined;
      if (!climate) add(`${at}.controls`, entityId, CFG.climateOnly('controls'));
      else if (!Array.isArray(v.controls)) add(`${at}.controls`, entityId, CFG.badList('controls', 'fan, swing'));
      else if (wrong !== undefined) add(`${at}.controls`, entityId, CFG.badControls(String(wrong)));
      else s.controls = v.controls;
    }
    // The consumption of an outlet or equipment whose sensors the panel cannot match by itself.
    for (const key of ['power', 'energy'] as const) {
      const ref = v[key];
      if (ref === undefined) continue;
      if (typeof ref === 'string' && hass.states[ref]) s[key] = ref;
      else add(`${at}.${key}`, entityId, CFG.missingEntity(String(ref)));
    }
    // Screens read the size through sizeOf; here only what is wrong with it.
    if (v.size !== undefined) {
      if (!isSize(v.size)) add(`${at}.size`, entityId, CFG.badSize(String(v.size)));
      else if (v.size !== 'large' && wholeRowOnly(entityId, typeof v.role === 'string' ? v.role : undefined)) {
        add(`${at}.size`, entityId, CFG.sizeDoesNotFit(v.size));
      }
    }
    if (v.hidden_for !== undefined) {
      if (Array.isArray(v.hidden_for) && v.hidden_for.every((u) => typeof u === 'string')) s.hiddenFor = v.hidden_for;
      else add(`${at}.hidden_for`, entityId, CFG.badList('hidden_for', 'id do usuário'));
    }
    // The sensor of a pulse gate: a cover or a lock says its own state. The role read is the one
    // accepted above, so a sensor on a refused role is reported too.
    if (v.sensor !== undefined) {
      const ref = v.sensor;
      if (s.role !== 'gate' || /^(cover|lock)\./.test(entityId)) add(`${at}.sensor`, entityId, CFG.sensorOnly);
      else if (typeof ref !== 'string' || !hass.states[ref]) add(`${at}.sensor`, entityId, CFG.missingEntity(String(ref)));
      else if (!isGateSensor(hass, ref)) add(`${at}.sensor`, entityId, CFG.notAGateSensor(ref));
      else s.sensor = ref;
    }
    entities[entityId] = s;
  }

  // Who sees each tab of the bar: only scenes and security can be kept from someone.
  const tabs: unknown = config.tabs;
  if (tabs !== undefined) {
    if (!tabs || typeof tabs !== 'object' || Array.isArray(tabs)) add('tabs', null, CFG.badTabs);
    else {
      for (const [key, tab] of Object.entries(tabs as Record<string, unknown>)) {
        if (key !== 'scenes' && key !== 'security') {
          add(`tabs.${key}`, null, CFG.unknownTab(key));
          continue;
        }
        const hiddenFor = (tab as { hidden_for?: unknown } | null)?.hidden_for;
        if (hiddenFor !== undefined && !(Array.isArray(hiddenFor) && hiddenFor.every((u) => typeof u === 'string'))) {
          add(`tabs.${key}.hidden_for`, null, CFG.badList('hidden_for', 'id do usuário'));
        }
      }
    }
  }

  const rooms: unknown = config.rooms;
  const roomsOk = rooms === undefined || (!!rooms && typeof rooms === 'object' && !Array.isArray(rooms));
  if (!roomsOk) add('rooms', null, CFG.badRooms);
  for (const [areaId, room] of Object.entries(roomsOk ? (config.rooms ?? {}) : {})) {
    const at = `rooms.${areaId}`;
    if (!hass.areas[areaId]) add(at, null, CFG.unknownArea(areaId));
    if (room?.art !== undefined && !isArtId(room.art)) add(`${at}.art`, null, CFG.unknownArt(String(room.art)));
    if (room?.floor !== undefined && !hass.floors?.[room.floor]) add(`${at}.floor`, null, CFG.unknownFloor(String(room.floor)));
    const hiddenFor: unknown = room?.hidden_for;
    if (hiddenFor !== undefined && !(Array.isArray(hiddenFor) && hiddenFor.every((u) => typeof u === 'string'))) {
      add(`${at}.hidden_for`, null, CFG.badList('hidden_for', 'id do usuário'));
    }
  }

  return { profile, entities, problems };
}
