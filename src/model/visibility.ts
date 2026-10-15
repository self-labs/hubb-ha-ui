import type { HomeAssistant } from '../ha/types';
import type { HubbConfig, TabId } from './types';

/**
 * The resident the panel is filtered for; null for an administrator, who always sees everything
 * (decision A of the visibility spec), and while Home Assistant has not said who is looking.
 */
export function viewerOf(hass: HomeAssistant): string | null {
  const user = hass.user;
  return user && !user.is_admin ? user.id : null;
}

/** The user ids of a `hidden_for` list; anything that is not a list reads as none (readConfig reports it). */
export function hiddenForList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}

/** An entry of the YAML hiding something from users Home Assistant no longer has. */
export interface StaleEntry {
  section: 'rooms' | 'entities' | 'tabs';
  key: string;
  /** What `hidden_for` keeps once cleaned. */
  keep: string[];
}

/** The rooms and items whose `hidden_for` names an id `known` does not have. */
export function staleEntries(config: HubbConfig, known: ReadonlySet<string>): StaleEntry[] {
  const out: StaleEntry[] = [];
  for (const section of ['rooms', 'entities', 'tabs'] as const) {
    const entries: unknown = config[section];
    if (!entries || typeof entries !== 'object' || Array.isArray(entries)) continue;
    for (const [key, entry] of Object.entries(entries as Record<string, { hidden_for?: unknown } | undefined>)) {
      // A key of tabs other than scenes and security is a mistake the review reports on its own.
      if (section === 'tabs' && key !== 'scenes' && key !== 'security') continue;
      const ids = hiddenForList(entry?.hidden_for);
      const keep = ids.filter((id) => known.has(id));
      if (keep.length < ids.length) out.push({ section, key, keep });
    }
  }
  return out;
}

/** Whether `tabs.<tab>.hidden_for` hides a tab of the bar from the resident looking. */
export function tabHiddenFor(config: HubbConfig, tab: TabId, viewer: string | null): boolean {
  if (viewer === null) return false;
  const tabs = config.tabs && typeof config.tabs === 'object' && !Array.isArray(config.tabs) ? config.tabs : {};
  return hiddenForList(tabs[tab]?.hidden_for).includes(viewer);
}

/** Whether `rooms.<area>.hidden_for` hides the room from the resident looking. */
export function roomHiddenFor(config: HubbConfig, areaId: string, viewer: string | null): boolean {
  if (viewer === null) return false;
  const rooms = config.rooms && typeof config.rooms === 'object' && !Array.isArray(config.rooms) ? config.rooms : {};
  return hiddenForList(rooms[areaId]?.hidden_for).includes(viewer);
}
