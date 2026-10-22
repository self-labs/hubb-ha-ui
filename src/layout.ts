import type { ReactiveController, ReactiveControllerHost } from 'lit';
import { basePath } from './actions/navigate';
import { layoutFor, type Layout } from './model/layout';

/** Where the area of the panel sits on the screen, for what is fixed to it (bar, sheet, toast). */
export interface Area {
  left: number;
  top: number;
  width: number;
}

/**
 * The layout of the panel and where its area sits, as the screen on show measured them. Module
 * state, like the edit mode: Home Assistant rebuilds the screens after a save or a registry change,
 * and the new ones must not start over from the phone layout.
 */
let now: Layout = 'phone';
let area: Area = { left: 0, top: 0, width: 0 };
const listeners = new Set<() => void>();

export const layoutNow = (): Layout => now;
export const areaNow = (): Area => area;

/** Whether the rail of the wide layout (Casa, Cenas, Segurança) is put away; null until read from the device. */
let railAway: boolean | null = null;
const railKey = (): string => `hubb-rail:${basePath()}`;

export function railHidden(): boolean {
  if (railAway === null) {
    try {
      railAway = window.localStorage.getItem(railKey()) === 'hidden';
    } catch {
      railAway = false;
    }
  }
  return railAway;
}

/** Puts the rail away or brings it back, on every screen; the device remembers it. */
export function setRailHidden(hidden: boolean): void {
  try {
    if (hidden) window.localStorage.setItem(railKey(), 'hidden');
    else window.localStorage.removeItem(railKey());
  } catch {
    // A private window or blocked storage: kept only while the page stays open.
  }
  if (railHidden() === hidden) return;
  railAway = hidden;
  listeners.forEach((fn) => fn());
}

/**
 * What the screen on show measured of itself. A hidden one (Home Assistant keeps views it may show
 * again, at width 0) says nothing.
 */
export function reportArea(rect: { left: number; top: number; width: number; height: number }, viewportHeight: number): void {
  if (rect.width <= 0) return;
  // Only the height changed (the keyboard of an Android tablet lying down): it stays wide. Leaving
  // would take the editor open on the right away while the installer types in it.
  const keyboard = now === 'wide' && rect.width === area.width;
  const next = keyboard ? now : layoutFor(rect.width, viewportHeight, now);
  const moved = rect.left !== area.left || rect.top !== area.top || rect.width !== area.width;
  area = { left: rect.left, top: rect.top, width: rect.width };
  if (next === now && !moved) return;
  now = next;
  listeners.forEach((fn) => fn());
}

export function onLayoutChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/**
 * Keeps `screenLayout` of an element that is not a screen (the bar, a sheet, the undo) in step with
 * the panel, while it is on the page; the element reflects it as `screen-layout` for its styles.
 */
export class LayoutWatcher implements ReactiveController {
  #host: ReactiveControllerHost & { screenLayout: Layout };
  #off: (() => void) | null = null;

  constructor(host: ReactiveControllerHost & { screenLayout: Layout }) {
    this.#host = host;
    host.addController(this);
  }

  hostConnected(): void {
    this.#host.screenLayout = now;
    this.#off = onLayoutChange(() => (this.#host.screenLayout = now));
  }

  hostDisconnected(): void {
    this.#off?.();
    this.#off = null;
  }
}

/** Back to a phone with no area, between tests. */
export function resetLayoutForTests(): void {
  railAway = null;
  try {
    window.localStorage.removeItem(railKey());
  } catch {
    // Nothing to forget.
  }
  now = 'phone';
  area = { left: 0, top: 0, width: 0 };
  listeners.forEach((fn) => fn());
}
