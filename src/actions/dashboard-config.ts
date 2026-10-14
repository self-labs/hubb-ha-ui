import type { HomeAssistant } from '../ha/types';
import type { Role } from '../model/config';
import type { EntityConfig, HubbConfig, RoomOverride } from '../model/types';

/** The entries touched by a write, as they were before it; null for an entry that did not exist. */
export type EntityEntries = Record<string, EntityConfig | null>;
export type RoomEntries = Record<string, RoomOverride | null>;

interface SavedDashboard {
  strategy?: HubbConfig;
  [key: string]: unknown;
}

/** The dashboard of the page: "/hubb-casa/revisar" gives "hubb-casa"; the default dashboard has none. */
export function dashboardPath(pathname: string = window.location.pathname): string | null {
  const first = pathname.split('/').filter(Boolean)[0];
  return !first || first === 'lovelace' ? null : first;
}

/** An entry without the keys set to nothing; null when nothing is left, so the entry goes away. */
function clean<T extends object>(entry: T): T | null {
  const kept = Object.entries(entry).filter(([, v]) => v !== undefined && v !== '');
  return kept.length ? (Object.fromEntries(kept) as T) : null;
}

/**
 * Reads the saved dashboard, changes some entries of one section of the strategy (`entities` or
 * `rooms`, the same keys the YAML has) and saves it. Home Assistant then rebuilds the dashboard by
 * itself. Throws when there is no WebSocket, when the dashboard is no longer a hubb strategy ("Take
 * control") or when Home Assistant refuses the save (only an administrator may).
 */
async function read(hass: HomeAssistant, urlPath: string | null): Promise<{ saved: SavedDashboard; strategy: HubbConfig }> {
  if (!hass.callWS) throw new Error('no websocket');
  const saved = await hass.callWS<SavedDashboard>({ type: 'lovelace/config', url_path: urlPath });
  const strategy = saved?.strategy;
  if (!strategy || strategy.type !== 'custom:hubb') throw new Error('not a hubb dashboard');
  return { saved, strategy };
}

function save(hass: HomeAssistant, urlPath: string | null, saved: SavedDashboard, strategy: HubbConfig): Promise<unknown> {
  return hass.callWS!({ type: 'lovelace/config/save', url_path: urlPath, config: { ...saved, strategy } });
}

async function edit<T extends object>(
  hass: HomeAssistant,
  urlPath: string | null,
  section: 'entities' | 'rooms',
  ids: readonly string[],
  next: (prev: T | undefined, id: string) => T | null,
): Promise<Record<string, T | null>> {
  const { saved, strategy } = await read(hass, urlPath);
  const entries: Record<string, T> = { ...((strategy[section] as Record<string, T> | undefined) ?? {}) };
  const before: Record<string, T | null> = {};
  for (const id of ids) {
    before[id] = entries[id] ?? null;
    const value = next(entries[id], id);
    if (value === null) delete entries[id];
    else entries[id] = value;
  }
  await save(hass, urlPath, saved, { ...strategy, [section]: entries });
  return before;
}

/** Gives roles to entities, keeping the rest of each entry (name, icon, area). */
export function setRoles(hass: HomeAssistant, urlPath: string | null, roles: Readonly<Record<string, Role>>): Promise<EntityEntries> {
  return edit<EntityConfig>(hass, urlPath, 'entities', Object.keys(roles), (prev, id) => ({ ...(prev ?? {}), role: roles[id] }));
}

/** Changes one entity entry; a key set to undefined goes back to what Home Assistant says. */
export function setEntity(hass: HomeAssistant, urlPath: string | null, id: string, patch: Partial<EntityConfig>): Promise<EntityEntries> {
  return edit<EntityConfig>(hass, urlPath, 'entities', [id], (prev) => clean({ ...(prev ?? {}), ...patch }));
}

/** The place of several items inside their block, in one save. */
export function setOrders(hass: HomeAssistant, urlPath: string | null, orders: Readonly<Record<string, number>>): Promise<EntityEntries> {
  return edit<EntityConfig>(hass, urlPath, 'entities', Object.keys(orders), (prev, id) => ({ ...(prev ?? {}), order: orders[id] }));
}

/** Desfazer: the entity entries as they were before a write. */
export function putBack(hass: HomeAssistant, urlPath: string | null, before: EntityEntries): Promise<EntityEntries> {
  return edit<EntityConfig>(hass, urlPath, 'entities', Object.keys(before), (_prev, id) => before[id] ?? null);
}

/** Changes rooms (hidden, order); a key set to undefined goes back to the default. */
export function setRooms(
  hass: HomeAssistant,
  urlPath: string | null,
  patches: Readonly<Record<string, Partial<RoomOverride>>>,
): Promise<RoomEntries> {
  return edit<RoomOverride>(hass, urlPath, 'rooms', Object.keys(patches), (prev, id) => clean({ ...(prev ?? {}), ...patches[id] }));
}

/** Desfazer: the room entries as they were before a write. */
export function putBackRooms(hass: HomeAssistant, urlPath: string | null, before: RoomEntries): Promise<RoomEntries> {
  return edit<RoomOverride>(hass, urlPath, 'rooms', Object.keys(before), (_prev, id) => before[id] ?? null);
}

/**
 * Shows again an entity the configuration hides: drops the hidden role and takes it out of
 * hide_entities. Returns the undo, which puts both back as they were.
 */
export async function showEntity(hass: HomeAssistant, urlPath: string | null, id: string): Promise<(hass: HomeAssistant) => Promise<unknown>> {
  const { saved, strategy } = await read(hass, urlPath);
  const entry = strategy.entities?.[id];
  const entities: Record<string, EntityConfig> = { ...(strategy.entities ?? {}) };
  if (entry?.role === 'hidden') {
    const rest = clean({ ...entry, role: undefined });
    if (rest) entities[id] = rest;
    else delete entities[id];
  }
  const hideEntities = strategy.hide_entities;
  const next: HubbConfig = { ...strategy, entities };
  if (hideEntities) next.hide_entities = hideEntities.filter((e) => e !== id);
  await save(hass, urlPath, saved, next);
  return async (h) => {
    const now = await read(h, urlPath);
    const back: Record<string, EntityConfig> = { ...(now.strategy.entities ?? {}) };
    if (entry) back[id] = entry;
    else delete back[id];
    const restored: HubbConfig = { ...now.strategy, entities: back };
    if (hideEntities) restored.hide_entities = hideEntities;
    await save(h, urlPath, now.saved, restored);
  };
}
