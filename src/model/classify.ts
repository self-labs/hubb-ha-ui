import type { HomeAssistant } from '../ha/types';
import type { PanelConfig } from './config';

export const SCENE_LABEL = 'hubb_cena';

/** The blocks of a room page, plus the scenes of the house. */
export type Block =
  | 'light'
  | 'outlet'
  | 'equipment'
  | 'appliance'
  | 'action'
  | 'scene'
  | 'climate'
  | 'fan'
  | 'cover'
  | 'media'
  | 'gate'
  | 'lock'
  | 'alert'
  | 'opening'
  | 'presence'
  | 'temperature'
  | 'humidity'
  | 'camera'
  | 'alarm';

/** Binary sensors that light the red strip. `problem` stays out: integrations use it for device faults. */
export const ALERT_CLASSES: ReadonlySet<string> = new Set(['smoke', 'gas', 'carbon_monoxide', 'moisture']);
export const OPENING_CLASSES: ReadonlySet<string> = new Set(['door', 'window', 'garage_door', 'opening']);
export const PRESENCE_CLASSES: ReadonlySet<string> = new Set(['motion', 'occupancy', 'presence']);

/** A cover that is a gate, a garage or a door: by its class, else by its name. */
const GATE_CLASSES = new Set(['gate', 'garage', 'door']);
const GATE_WORDS = /port[aã]o|\bgate\b/;

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

/**
 * Whether a cover is a gate, a garage or a door. Its class decides when it has one ("Cortina da
 * garagem" with the curtain class is a curtain); with no class, "portão" or "gate" in the name.
 */
export function coverIsGate(hass: HomeAssistant, entityId: string): boolean {
  const st = hass.states[entityId];
  const cls = st?.attributes.device_class;
  if (typeof cls === 'string' && cls) return GATE_CLASSES.has(cls);
  const name = String(st?.attributes.friendly_name ?? hass.entities[entityId]?.name ?? entityId).toLocaleLowerCase('pt-BR');
  return GATE_WORDS.test(name);
}

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
    // With no room it stays out in silence (spec, Section 3 step 1): a real house has dozens of such
    // switches (AdGuard, containers) that would bury the ones to review.
    return areaId ? { block: null, why: 'review', areaId } : { block: null, why: 'unsupported', areaId: null };
  }
  const placedAs = (block: Block): Placement => (areaId ? { block, areaId } : roomless);
  if (domain === 'climate') return placedAs('climate');
  if (domain === 'fan') return placedAs('fan');
  if (domain === 'lock') return placedAs('lock');
  if (domain === 'cover') return placedAs(coverIsGate(hass, entityId) ? 'gate' : 'cover');
  // Browser Mod makes a player for every browser; they are screens, not media of a room.
  if (domain === 'media_player' && reg.platform !== 'browser_mod') return placedAs('media');
  const cls = String(hass.states[entityId]?.attributes.device_class ?? '');
  // Alerts, cameras and alarms belong to the house: they count with or without a room.
  if (domain === 'binary_sensor') {
    if (ALERT_CLASSES.has(cls)) return { block: 'alert', areaId };
    // A door or window with no room is out, like everything else: the doors of a fridge have none.
    if (OPENING_CLASSES.has(cls) && areaId) return { block: 'opening', areaId };
    if (PRESENCE_CLASSES.has(cls) && areaId) return { block: 'presence', areaId };
    return { block: null, why: 'unsupported', areaId };
  }
  // A roomless thermometer stays out in silence, like a roomless switch: phones and integrations have dozens.
  if (domain === 'sensor' && (cls === 'temperature' || cls === 'humidity') && areaId) return { block: cls, areaId };
  if (domain === 'camera') return { block: 'camera', areaId };
  if (domain === 'alarm_control_panel') return { block: 'alarm', areaId };
  return { block: null, why: 'unsupported', areaId };
}
