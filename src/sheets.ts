import { isEditing, onEditingChange } from './editing';

/**
 * The sheets open on each screen. Home Assistant rebuilds a strategy dashboard after every save and
 * whenever a registry changes (the WiiM group player hides or shows itself when speakers join), and
 * the new screen opens the same sheet again: a tap inside a sheet never closes it (Gustavo, 15/10 and
 * 20/10). Closing it forgets it, and so does leaving the edit mode. Module state, like the edit mode.
 */
interface Kept {
  value: unknown;
  /** The screen that has it open now. */
  owner: object;
  /** When that screen left the page; null while it is on it. */
  left: number | null;
}

const kept = new Map<string, Kept>();

/** A screen that comes this soon after the last one left is the same page rebuilt, not a new visit. */
export const REBUILD_MS = 2000;

onEditingChange(() => {
  if (!isEditing()) kept.clear();
});

/** Remembers what `owner` has open under `key`, or forgets it when `value` is null. */
export function keepSheet(key: string, owner: object, value: unknown): void {
  if (value === null || value === undefined) kept.delete(key);
  else kept.set(key, { value, owner, left: null });
}

/** What the page `owner` replaces had open under `key`; `owner` takes it over. */
export function keptSheet<T>(key: string, owner: object): T | null {
  const k = kept.get(key);
  if (!k) return null;
  if (k.left !== null && Date.now() - k.left > REBUILD_MS) {
    kept.delete(key);
    return null;
  }
  k.owner = owner;
  k.left = null;
  return k.value as T;
}

/** `owner` left the page: what it had open waits a moment for the rebuilt page. */
export function leaveSheets(owner: object): void {
  const now = Date.now();
  for (const k of kept.values()) if (k.owner === owner) k.left = now;
}
