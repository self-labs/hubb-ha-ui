import { basePath } from './actions/navigate';

/**
 * The room open on the right side of the wide home. Module state, like the edit mode: Home Assistant
 * rebuilds the screens after a save or a registry change, and the page must not jump to another room.
 * Also kept on the device, like the floor, so the panel opens where it was left.
 */
let chosen: string | null = null;
const listeners = new Set<() => void>();

const storageKey = (): string => `hubb-room:${basePath()}`;

export const selectedRoom = (): string | null => chosen;

/** The room last picked on this device for this dashboard; null when the browser keeps no storage. */
export function rememberedRoom(): string | null {
  try {
    return window.localStorage.getItem(storageKey());
  } catch {
    return null;
  }
}

export function selectRoom(areaId: string): void {
  try {
    window.localStorage.setItem(storageKey(), areaId);
  } catch {
    // A private window or blocked storage: the room is kept only while the page stays open.
  }
  if (chosen === areaId) return;
  chosen = areaId;
  listeners.forEach((fn) => fn());
}

export function onSelectionChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Nothing picked and nothing remembered, between tests. */
export function resetSelectionForTests(): void {
  chosen = null;
  try {
    window.localStorage.removeItem(storageKey());
  } catch {
    // Nothing to forget.
  }
}
