import type { HomeAssistant } from '../ha/types';
import { haptic } from './haptic';

/** One step of − or + on the volume. */
export const VOLUME_STEP = 0.05;
/** Taps this close together leave as one command. */
const GATHER_MS = 300;
/** How long the target stands without Home Assistant confirming it. */
const HOLD_MS = 3000;

const clamp = (v: number): number => Math.round(Math.min(1, Math.max(0, v)) * 100) / 100;

/**
 * The volume a sheet is heading to. Each tap adds to the target, not to the state of Home Assistant,
 * which has not moved yet between quick taps: three taps from 25 go to 40, not to 30 three times.
 */
export class VolumeTarget {
  #send: (level: number) => void;
  #now: () => number;
  #target: number | null = null;
  #at = 0;
  #timer: ReturnType<typeof setTimeout> | null = null;

  constructor(send: (level: number) => void, now: () => number = () => Date.now()) {
    this.#send = send;
    this.#now = now;
  }

  #live(): number | null {
    return this.#target !== null && this.#now() - this.#at < HOLD_MS ? this.#target : null;
  }

  /** One tap of − or +, from the target while it stands, else from `current`. Returns the new target. */
  step(current: number | null, direction: 1 | -1): number {
    return this.set((this.#live() ?? current ?? 0) + direction * VOLUME_STEP);
  }

  /** A level picked on the bar. Returns it, rounded and kept between 0 and 1. */
  set(level: number): number {
    this.#target = clamp(level);
    this.#at = this.#now();
    if (this.#timer) clearTimeout(this.#timer);
    const target = this.#target;
    this.#timer = setTimeout(() => {
      this.#timer = null;
      this.#send(target);
    }, GATHER_MS);
    return target;
  }

  /** What to show: the target until Home Assistant confirms it or it runs out, then `current`. */
  shown(current: number | null): number | null {
    const live = this.#live();
    if (live === null || (current !== null && clamp(current) === live)) {
      this.#target = null;
      return current;
    }
    return live;
  }

  /** The sheet is closing: a level still gathering leaves now, and nothing fires later. */
  dispose(): void {
    if (!this.#timer) return;
    clearTimeout(this.#timer);
    this.#timer = null;
    if (this.#target !== null) this.#send(this.#target);
  }
}

/**
 * One target per speaker, shared by the sheet's − and + and the group's Volume de todas, so a tap on
 * one adds to a tap on the other. Keyed by `callService`, which the frontend keeps across states.
 */
const targets = new WeakMap<HomeAssistant['callService'], Map<string, VolumeTarget>>();

export function volumeTarget(hass: HomeAssistant, entityId: string): VolumeTarget {
  let byId = targets.get(hass.callService);
  if (!byId) targets.set(hass.callService, (byId = new Map()));
  let target = byId.get(entityId);
  if (!target) {
    target = new VolumeTarget((level) => {
      hass.callService('media_player', 'volume_set', { volume_level: level }, { entity_id: entityId }).catch(() => haptic('failure'));
    });
    byId.set(entityId, target);
  }
  return target;
}
