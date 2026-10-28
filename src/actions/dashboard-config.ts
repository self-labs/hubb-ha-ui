import type { HomeAssistant } from '../ha/types';
import type { Role } from '../model/config';
import type { EntityConfig, HubbConfig, RoomOverride, TabId, TabletOverride, TabOverride } from '../model/types';

/** The entries touched by a write, as they were before it; null for an entry that did not exist. */
export type EntityEntries = Record<string, EntityConfig | null>;
export type RoomEntries = Record<string, RoomOverride | null>;
export type TabEntries = Record<string, TabOverride | null>;
export type TabletEntries = Record<string, TabletOverride | null>;

/** The keys at the root of the strategy the panel itself changes (Ajustes). */
export type RootKeys = Partial<Pick<HubbConfig, 'profile' | 'name' | 'house_power'>>;

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

/** The event a successful save sends on `window`, so a screen can show it before Home Assistant rebuilds. */
export const CONFIG_SAVED = 'hubb-config-saved';
export interface ConfigSaved {
  urlPath: string | null;
  strategy: HubbConfig;
}

async function save(hass: HomeAssistant, urlPath: string | null, saved: SavedDashboard, strategy: HubbConfig): Promise<unknown> {
  const result = await hass.callWS!({ type: 'lovelace/config/save', url_path: urlPath, config: { ...saved, strategy } });
  window.dispatchEvent(new CustomEvent<ConfigSaved>(CONFIG_SAVED, { detail: { urlPath, strategy } }));
  return result;
}

/**
 * One write at a time. Each one reads the saved dashboard and saves it whole: two in flight would
 * start from the same copy and the second would undo the first (two quick taps on Adicionar cena).
 */
let queue: Promise<unknown> = Promise.resolve();
function serial<T>(job: () => Promise<T>): Promise<T> {
  const run = queue.then(job, job);
  queue = run.catch(() => undefined);
  return run;
}

function edit<T extends object>(
  hass: HomeAssistant,
  urlPath: string | null,
  section: 'entities' | 'rooms' | 'tabs' | 'tablets',
  ids: readonly string[],
  next: (prev: T | undefined, id: string) => T | null,
): Promise<Record<string, T | null>> {
  return serial(async () => {
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
  });
}

/** Gives roles to entities, keeping the rest of each entry (name, icon, area). */
export function setRoles(hass: HomeAssistant, urlPath: string | null, roles: Readonly<Record<string, Role>>): Promise<EntityEntries> {
  return edit<EntityConfig>(hass, urlPath, 'entities', Object.keys(roles), (prev, id) => ({ ...(prev ?? {}), ...withRole(prev, roles[id]) }));
}

/**
 * A new role, and what Mostrar will give back: Não mostrar keeps the role it covers in `shown_as`
 * (a pulse relay is a gate only by its role), and a role chosen by hand forgets it.
 */
function withRole(prev: EntityConfig | undefined, role: string | undefined): Pick<EntityConfig, 'role' | 'shown_as'> {
  if (role !== 'hidden') return { role, shown_as: undefined };
  return { role, shown_as: prev?.role && prev.role !== 'hidden' ? prev.role : prev?.shown_as };
}

/** Changes one entity entry; a key set to undefined goes back to what Home Assistant says. */
export function setEntity(hass: HomeAssistant, urlPath: string | null, id: string, patch: Partial<EntityConfig>): Promise<EntityEntries> {
  return edit<EntityConfig>(hass, urlPath, 'entities', [id], (prev) =>
    clean({ ...(prev ?? {}), ...patch, ...('role' in patch ? withRole(prev, patch.role) : {}) }),
  );
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

/** Who sees the tabs of the bar (`tabs.scenes`, `tabs.security`); a key set to undefined goes back to everyone. */
export function setTabs(hass: HomeAssistant, urlPath: string | null, patches: Readonly<Partial<Record<TabId, Partial<TabOverride>>>>): Promise<TabEntries> {
  return edit<TabOverride>(hass, urlPath, 'tabs', Object.keys(patches), (prev, id) => clean({ ...(prev ?? {}), ...patches[id as TabId] }));
}

/** Desfazer: the tab entries as they were before a write. */
export function putBackTabs(hass: HomeAssistant, urlPath: string | null, before: TabEntries): Promise<TabEntries> {
  return edit<TabOverride>(hass, urlPath, 'tabs', Object.keys(before), (_prev, id) => before[id] ?? null);
}

/**
 * The wall tablet of each user (`tablets.<user_id>`): keys merged into the stored entry (a key set to
 * undefined leaves), or null to make them an ordinary user.
 */
export function setTablets(hass: HomeAssistant, urlPath: string | null, entries: Readonly<TabletEntries>): Promise<TabletEntries> {
  return edit<TabletOverride>(hass, urlPath, 'tablets', Object.keys(entries), (prev, id) => {
    const entry = entries[id];
    return entry ? (clean({ ...(prev ?? {}), ...entry }) ?? {}) : null;
  });
}

/** Desfazer: the tablet entries as they were before a write. */
export function putBackTablets(hass: HomeAssistant, urlPath: string | null, before: TabletEntries): Promise<TabletEntries> {
  return edit<TabletOverride>(hass, urlPath, 'tablets', Object.keys(before), (_prev, id) => before[id] ?? null);
}

/**
 * Keys at the root of the strategy (the kind of place, its name, the power sensor of the house); one
 * set to nothing leaves. Returns them as they were, for Desfazer (which is this same call).
 */
export function setRootKeys(hass: HomeAssistant, urlPath: string | null, patch: RootKeys): Promise<RootKeys> {
  return serial(async () => {
    const { saved, strategy } = await read(hass, urlPath);
    const before: Record<string, unknown> = {};
    const next: Record<string, unknown> = { ...strategy };
    for (const [key, value] of Object.entries(patch)) {
      before[key] = (strategy as Record<string, unknown>)[key];
      if (value === undefined || value === '') delete next[key];
      else next[key] = value;
    }
    await save(hass, urlPath, saved, next as HubbConfig);
    return before as RootKeys;
  });
}

/** `value` without the key at `path`; an object left empty on the way down goes too (undefined). */
function without(value: unknown, path: readonly string[]): unknown {
  if (!path.length) return undefined;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  const [head, ...rest] = path as [string, ...string[]];
  const obj = value as Record<string, unknown>;
  if (!(head in obj)) return value;
  const { [head]: inner, ...others } = obj;
  const left = without(inner, rest);
  const next = left === undefined ? others : { ...others, [head]: left };
  return Object.keys(next).length ? next : undefined;
}

/**
 * Takes keys out of the strategy in one save, each named by its path (`['entities', id, 'sensor']`):
 * the wrong lines Revisar lists. Returns the sections touched as they were, for putBackRoot.
 */
export function dropKeys(hass: HomeAssistant, urlPath: string | null, paths: readonly (readonly string[])[]): Promise<Partial<HubbConfig>> {
  return serial(async () => {
    const { saved, strategy } = await read(hass, urlPath);
    const before: Record<string, unknown> = {};
    let next = strategy as unknown as Record<string, unknown>;
    for (const path of paths) {
      const top = path[0];
      if (!top || top === 'type') continue;
      if (!(top in before)) before[top] = next[top];
      next = (without(next, path) as Record<string, unknown> | undefined) ?? {};
    }
    await save(hass, urlPath, saved, { type: strategy.type, ...next } as HubbConfig);
    return before as Partial<HubbConfig>;
  });
}

/** Desfazer of dropKeys: the sections of the strategy as they were; one that did not exist leaves. */
export function putBackRoot(hass: HomeAssistant, urlPath: string | null, before: Partial<HubbConfig>): Promise<unknown> {
  return serial(async () => {
    const { saved, strategy } = await read(hass, urlPath);
    const next: Record<string, unknown> = { ...strategy };
    for (const [key, value] of Object.entries(before)) {
      if (value === undefined) delete next[key];
      else next[key] = value;
    }
    await save(hass, urlPath, saved, next as unknown as HubbConfig);
  });
}

/** Desfazer: the room entries as they were before a write. */
export function putBackRooms(hass: HomeAssistant, urlPath: string | null, before: RoomEntries): Promise<RoomEntries> {
  return edit<RoomOverride>(hass, urlPath, 'rooms', Object.keys(before), (_prev, id) => before[id] ?? null);
}

/**
 * Shows again an entity the configuration hides: gives back the role it had before Não mostrar (none
 * when it had none) and takes it out of hide_entities. Returns the undo, which puts both back as they were.
 */
export function showEntity(hass: HomeAssistant, urlPath: string | null, id: string): Promise<(hass: HomeAssistant) => Promise<unknown>> {
  return serial(() => showNow(hass, urlPath, id));
}

async function showNow(hass: HomeAssistant, urlPath: string | null, id: string): Promise<(hass: HomeAssistant) => Promise<unknown>> {
  const { saved, strategy } = await read(hass, urlPath);
  const entry = strategy.entities?.[id];
  const entities: Record<string, EntityConfig> = { ...(strategy.entities ?? {}) };
  if (entry?.role === 'hidden') {
    const rest = clean({ ...entry, role: entry.shown_as, shown_as: undefined });
    if (rest) entities[id] = rest;
    else delete entities[id];
  }
  const hideEntities = strategy.hide_entities;
  const next: HubbConfig = { ...strategy, entities };
  if (hideEntities) next.hide_entities = hideEntities.filter((e) => e !== id);
  await save(hass, urlPath, saved, next);
  return (h) =>
    serial(async () => {
      const now = await read(h, urlPath);
      const back: Record<string, EntityConfig> = { ...(now.strategy.entities ?? {}) };
      if (entry) back[id] = entry;
      else delete back[id];
      const restored: HubbConfig = { ...now.strategy, entities: back };
      if (hideEntities) restored.hide_entities = hideEntities;
      await save(h, urlPath, now.saved, restored);
    });
}
