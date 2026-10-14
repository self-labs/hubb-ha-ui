import type { HomeAssistant } from '../ha/types';
import { CFG, REVIEW } from '../strings';
import { APPLIANCE_PLATFORMS, applianceName, findParts, stateSensorOf } from './appliances';
import { applianceAreaOf, areaOf, classify, classifyContext, type ClassifyContext } from './classify';
import { readConfig, type PanelConfig, type Role } from './config';
import { displayName } from './names';
import type { HubbConfig } from './types';

export type ReviewGroup = 'role' | 'appliance' | 'area' | 'config' | 'silent';

/** The groups of the screen, in the order they show. */
export const REVIEW_GROUPS: readonly ReviewGroup[] = ['role', 'appliance', 'area', 'config', 'silent'];

export interface ReviewItem {
  group: ReviewGroup;
  /** The entity it is about; null for a problem of the configuration that names none. */
  entityId: string | null;
  name: string;
  areaName: string | null;
  reason: string;
  /** The roles offered as buttons, each copying its line of YAML; none means nothing to copy. */
  roles: readonly Role[];
  /** The role shown highlighted, and the one "Copiar tudo" takes. */
  suggested: Role | null;
}

/** The part of the review that comes from the registry, and the entities whose silence it watches. */
export interface StaticReview {
  items: ReviewItem[];
  watched: string[];
}

/** An entity of the panel that has not answered for this long goes on the screen. */
export const SILENT_AFTER_MS = 24 * 60 * 60 * 1000;

/** The roles a switch can take. */
const SWITCH_ROLES: readonly Role[] = ['light', 'outlet', 'equipment', 'hidden'];

export function suggestRole(name: string): Role {
  const n = name.toLocaleLowerCase('pt-BR');
  // The Echo and TV switches of the Alexa integration (announcements, communications) are not for the resident.
  if (/\bmode\b|display|do not disturb|não perturbe|announcements|communications|anúncios|comunicações/.test(n)) return 'hidden';
  if (/\bluz\b|luzes|l[aâ]mpada|lumin[aá]ria|plafon|sanca|\bteto\b|spot|pendente|arandela|\bled\b|fita|lustre|abajur/.test(n)) return 'light';
  return 'equipment';
}

export function yamlLine(entityId: string, role: Role): string {
  return `${entityId}: { role: ${role} }`;
}

/** The block "Copiar tudo" gives, ready to go under `strategy:`. */
export function yamlBlock(lines: readonly string[]): string {
  return ['entities:', ...lines.map((l) => `  ${l}`)].join('\n');
}

/** The suggested line of every item of the role and appliance groups. */
export function suggestedLines(items: readonly ReviewItem[]): string[] {
  return items
    .filter((i) => (i.group === 'role' || i.group === 'appliance') && i.entityId !== null && i.suggested !== null)
    .map((i) => yamlLine(i.entityId!, i.suggested!));
}

/** Devices of a known appliance brand with no appliance marked yet, each with the state sensor found. */
function suggestedAppliances(hass: HomeAssistant, cfg: PanelConfig, ctx: ClassifyContext): Map<string, string> {
  const brands = new Set<string>();
  const climate = new Set<string>();
  for (const reg of Object.values(hass.entities)) {
    if (!reg.device_id) continue;
    if (reg.entity_id.startsWith('climate.')) climate.add(reg.device_id);
    if (reg.platform && APPLIANCE_PLATFORMS.includes(reg.platform)) brands.add(reg.device_id);
  }
  const out = new Map<string, string>();
  for (const deviceId of [...brands].sort()) {
    // A climate device waits for the climate module; a device already marked needs nothing.
    if (ctx.applianceDevices.has(deviceId) || climate.has(deviceId)) continue;
    const sensor = stateSensorOf(hass, deviceId, true);
    // Hiding the state sensor (the hidden role or hide_entities) dismisses the suggestion.
    if (!sensor || ctx.hidden.has(sensor) || cfg.entities[sensor]?.role === 'hidden') continue;
    out.set(deviceId, sensor);
  }
  return out;
}

export function staticReview(hass: HomeAssistant, config: HubbConfig): StaticReview {
  const cfg = readConfig(hass, config);
  const ctx = classifyContext(hass, cfg, config.hide_entities);
  const areaName = (id: string | null): string | null => (id ? (hass.areas[id]?.name ?? null) : null);
  const suggested = suggestedAppliances(hass, cfg, ctx);
  const items: ReviewItem[] = cfg.problems.map((p) => ({
    group: 'config',
    entityId: p.entityId,
    name: p.key,
    areaName: null,
    reason: p.message,
    roles: [],
    suggested: null,
  }));
  const watched: string[] = [];
  const devices = new Set<string>();
  // A room hidden by the configuration is not on the panel: nothing in it is reviewed or watched.
  const rooms = config.rooms && typeof config.rooms === 'object' && !Array.isArray(config.rooms) ? config.rooms : {};
  const hiddenRooms = new Set(Object.keys(rooms).filter((a) => rooms[a]?.hidden));
  for (const entityId of Object.keys(hass.entities).sort()) {
    const placed = classify(hass, entityId, ctx);
    if (placed.areaId && hiddenRooms.has(placed.areaId)) continue;
    const reg = hass.entities[entityId]!;
    if (placed.block === 'appliance') {
      const deviceId = reg.device_id!;
      if (devices.has(deviceId)) continue;
      devices.add(deviceId);
      const parts = findParts(hass, deviceId, entityId, cfg.entities[entityId]);
      if (parts.state) watched.push(parts.state);
      else {
        items.push({
          group: 'config',
          entityId,
          name: `entities.${entityId}`,
          areaName: areaName(placed.areaId),
          reason: CFG.applianceNoState(entityId),
          roles: [],
          suggested: null,
        });
      }
      continue;
    }
    // A scene is never "unavailable", and a button reads "unknown" until it is first pressed.
    if (placed.block === 'scene' || placed.block === 'action') continue;
    if (placed.block !== null) {
      watched.push(entityId);
      continue;
    }
    const name = cfg.entities[entityId]?.name ?? displayName(hass, entityId, null);
    if (placed.why === 'review' && !(reg.device_id && suggested.has(reg.device_id))) {
      items.push({
        group: 'role',
        entityId,
        name,
        areaName: areaName(placed.areaId),
        reason: REVIEW.noClass,
        roles: SWITCH_ROLES,
        suggested: suggestRole(name),
      });
    } else if (placed.why === 'no-area' && reg.platform !== 'browser_mod') {
      items.push({ group: 'area', entityId, name, areaName: null, reason: REVIEW.noArea, roles: ['hidden'], suggested: null });
    }
  }
  for (const [deviceId, sensor] of suggested) {
    items.push({
      group: 'appliance',
      entityId: sensor,
      name: applianceName(hass, deviceId),
      areaName: areaName(applianceAreaOf(hass, sensor)),
      reason: REVIEW.applianceFound,
      roles: ['appliance'],
      suggested: 'appliance',
    });
  }
  return { items, watched };
}

/** The watched entities that have been unavailable or unknown for more than a day. */
export function silentReview(hass: HomeAssistant, watched: readonly string[], now: number = Date.now()): ReviewItem[] {
  const out: ReviewItem[] = [];
  for (const entityId of watched) {
    const st = hass.states[entityId];
    if (!st || (st.state !== 'unavailable' && st.state !== 'unknown') || !st.last_changed) continue;
    const since = Date.parse(st.last_changed);
    if (!Number.isFinite(since) || now - since <= SILENT_AFTER_MS) continue;
    const when = new Date(since).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    const areaId = areaOf(hass, entityId);
    out.push({
      group: 'silent',
      entityId,
      name: displayName(hass, entityId, null),
      areaName: areaId ? (hass.areas[areaId]?.name ?? null) : null,
      reason: REVIEW.silentSince(when),
      roles: [],
      suggested: null,
    });
  }
  return out;
}

let memo: { key: readonly unknown[]; result: StaticReview } | null = null;

/**
 * The registry part of the review, computed again only when the registry or the configuration
 * changes: the home asks for the count on every update of Home Assistant. A change of attributes
 * alone (an outlet class) waits for the next registry change, like the dashboard itself.
 */
export function cachedStaticReview(hass: HomeAssistant, config: HubbConfig): StaticReview {
  const key = [hass.entities, hass.devices, hass.areas, hass.floors, config];
  if (memo && memo.key.length === key.length && memo.key.every((k, i) => k === key[i])) return memo.result;
  memo = { key, result: staticReview(hass, config) };
  return memo.result;
}

/** Everything "Revisar o painel" lists now; its length is the number on the key. */
export function reviewItems(hass: HomeAssistant, config: HubbConfig, now: number = Date.now()): ReviewItem[] {
  const base = cachedStaticReview(hass, config);
  return [...base.items, ...silentReview(hass, base.watched, now)];
}
