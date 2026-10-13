import type { HomeAssistant } from '../ha/types';
import type { PanelConfig } from './config';

export const SCENE_LABEL = 'hubb_cena';

/** The blocks of a room page, plus the scenes of the house. */
export type Block = 'light' | 'outlet' | 'equipment' | 'appliance' | 'action' | 'scene';

/** Why an entity stays off the panel. */
export type Exclusion =
  /** Hidden in Home Assistant, in hide_entities, with the hidden role, or not in the registry. */
  | 'hidden'
  /** Belongs to a device that is an appliance; it shows inside the appliance. */
  | 'part'
  /** A configuration or diagnostic entity. */
  | 'category'
  /** Would show, but has no room. */
  | 'no-area'
  /** A switch with no class and no role: the installer decides on "Revisar o painel". */
  | 'review'
  /** A type the later modules handle (climate, cover, media, sensors, loose buttons). */
  | 'unsupported';

export type Placement =
  | { block: Block; areaId: string | null }
  | { block: null; why: Exclusion; areaId: string | null };

export interface ClassifyContext {
  cfg: PanelConfig;
  hidden: ReadonlySet<string>;
  /** Devices with an entity whose role is appliance. */
  applianceDevices: ReadonlySet<string>;
}

export function classifyContext(hass: HomeAssistant, cfg: PanelConfig, hideEntities: readonly string[] = []): ClassifyContext {
  const applianceDevices = new Set<string>();
  for (const [entityId, s] of Object.entries(cfg.entities)) {
    const deviceId = hass.entities[entityId]?.device_id;
    if (s.role === 'appliance' && deviceId) applianceDevices.add(deviceId);
  }
  return { cfg, hidden: new Set(hideEntities), applianceDevices };
}

/** The room of an entity: the `area` of the configuration, else its own area, else its device's. */
export function areaOf(hass: HomeAssistant, entityId: string, override?: string): string | null {
  if (override && hass.areas[override]) return override;
  const reg = hass.entities[entityId];
  if (!reg) return null;
  if (reg.area_id) return reg.area_id;
  return reg.device_id ? (hass.devices[reg.device_id]?.area_id ?? null) : null;
}

/** The room of an appliance: the `area` of the configuration, else its device's, else the entity's own. */
export function applianceAreaOf(hass: HomeAssistant, entityId: string, override?: string): string | null {
  if (override && hass.areas[override]) return override;
  const reg = hass.entities[entityId];
  const deviceArea = reg?.device_id ? (hass.devices[reg.device_id]?.area_id ?? null) : null;
  return deviceArea ?? reg?.area_id ?? null;
}

const domainOf = (entityId: string): string => entityId.slice(0, entityId.indexOf('.'));
const roomless: Placement = { block: null, why: 'no-area', areaId: null };

/** Where an entity goes on the panel, or why it stays off. The one rule every screen uses. */
export function classify(hass: HomeAssistant, entityId: string, ctx: ClassifyContext): Placement {
  const reg = hass.entities[entityId];
  if (!reg) return { block: null, why: 'hidden', areaId: null };
  const s = ctx.cfg.entities[entityId];
  const role = s?.role;
  if (reg.hidden || ctx.hidden.has(entityId) || role === 'hidden') return { block: null, why: 'hidden', areaId: null };
  if (role === 'appliance') {
    const areaId = applianceAreaOf(hass, entityId, s?.area);
    return areaId ? { block: 'appliance', areaId } : roomless;
  }
  if (role) {
    const areaId = areaOf(hass, entityId, s?.area);
    return areaId ? { block: role, areaId } : roomless;
  }
  if (reg.device_id && ctx.applianceDevices.has(reg.device_id)) return { block: null, why: 'part', areaId: null };
  if (reg.entity_category) return { block: null, why: 'category', areaId: null };
  const domain = domainOf(entityId);
  const areaId = areaOf(hass, entityId, s?.area);
  if ((domain === 'scene' || domain === 'script') && reg.labels.includes(SCENE_LABEL)) return { block: 'scene', areaId };
  if (domain === 'light') return areaId ? { block: 'light', areaId } : roomless;
  if (domain === 'switch') {
    if (hass.states[entityId]?.attributes.device_class === 'outlet') return areaId ? { block: 'outlet', areaId } : roomless;
    return { block: null, why: 'review', areaId };
  }
  return { block: null, why: 'unsupported', areaId };
}
