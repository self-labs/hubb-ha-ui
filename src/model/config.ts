import { isArtId } from '../art/drawings';
import type { HomeAssistant } from '../ha/types';
import { CFG } from '../strings';
import { isProfileId, type ProfileId } from './profiles';
import type { HubbConfig } from './types';

/** The roles an entity can be given in `entities.<id>.role`. */
export const ROLES = ['light', 'outlet', 'equipment', 'appliance', 'action', 'hidden'] as const;
export type Role = (typeof ROLES)[number];

/** The domains each role can be given to; `appliance` takes any entity with a device, `hidden` any entity. */
export const ROLE_DOMAINS: Readonly<Record<Exclude<Role, 'hidden' | 'appliance'>, readonly string[]>> = {
  light: ['light', 'switch'],
  outlet: ['switch'],
  equipment: ['switch'],
  action: ['button', 'input_button', 'script'],
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
}

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
    if (!value || typeof value !== 'object') {
      add(at, entityId, CFG.badEntry);
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
    if (typeof v.name === 'string' && v.name.trim()) s.name = v.name.trim();
    if (v.icon !== undefined) {
      if (typeof v.icon === 'string' && v.icon.startsWith('mdi:')) s.icon = v.icon;
      else add(`${at}.icon`, entityId, CFG.badIcon(String(v.icon)));
    }
    if (v.area !== undefined) {
      if (typeof v.area === 'string' && hass.areas[v.area]) s.area = v.area;
      else add(`${at}.area`, entityId, CFG.unknownArea(String(v.area)));
    }
    if (Array.isArray(v.hide)) s.hide = v.hide.filter((h): h is string => typeof h === 'string');
    for (const key of ['remaining', 'progress'] as const) {
      const ref = v[key];
      if (ref === undefined) continue;
      if (typeof ref === 'string' && hass.states[ref]) s[key] = ref;
      else add(`${at}.${key}`, entityId, CFG.missingEntity(String(ref)));
    }
    entities[entityId] = s;
  }

  for (const [areaId, room] of Object.entries(config.rooms ?? {})) {
    const at = `rooms.${areaId}`;
    if (!hass.areas[areaId]) add(at, null, CFG.unknownArea(areaId));
    if (room?.art !== undefined && !isArtId(room.art)) add(`${at}.art`, null, CFG.unknownArt(String(room.art)));
    if (room?.floor !== undefined && !hass.floors?.[room.floor]) add(`${at}.floor`, null, CFG.unknownFloor(String(room.floor)));
  }

  return { profile, entities, problems };
}
