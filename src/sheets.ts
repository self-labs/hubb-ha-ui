import { isEditing, onEditingChange } from './editing';

/**
 * The sheet of the edit mode that was open when a save went out, by screen. Home Assistant rebuilds
 * the views after every save and the new screen opens it again, so the installer taps one person
 * after another in "Quem vê" without opening it each time (Gustavo, 15/10). Module state, like the
 * edit mode itself; leaving the edit mode forgets it.
 */
const open = new Map<string, unknown>();

onEditingChange(() => {
  if (!isEditing()) open.clear();
});

/** Remembers what `screen` has open, or forgets it when `value` is null. */
export function keepSheet(screen: string, value: unknown): void {
  if (value === null || value === undefined) open.delete(screen);
  else open.set(screen, value);
}

/** What `screen` had open before the rebuild, while the edit mode lasts. */
export function keptSheet<T>(screen: string): T | null {
  return isEditing() ? ((open.get(screen) as T | undefined) ?? null) : null;
}
