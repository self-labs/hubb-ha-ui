/**
 * Whether the panel is in edit mode. Module state, not a property of a screen: Home Assistant rebuilds
 * the views after every save, and the mode must survive that rebuild.
 */
let on = false;
const listeners = new Set<() => void>();

export function isEditing(): boolean {
  return on;
}

export function setEditing(value: boolean): void {
  if (on === value) return;
  on = value;
  listeners.forEach((listener) => listener());
}

/** Calls `listener` whenever the mode changes; returns the function that stops it. */
export function onEditingChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
