import type { HassEntityState, HomeAssistant } from '../ha/types';
import { targetLimits } from '../model/arc';
import { haptic } from './haptic';

/** The target goes out once the taps on − and + stop for this long. */
export const SEND_AFTER_MS = 800;
/**
 * The target asked stays on screen at most this long, waiting for Home Assistant to show it; then it
 * was not taken (an LG in Auto takes only 18 and 19 and ignores the rest without an error, 23/10). LG
 * ThinQ shows a target it took in about 3 s.
 */
export const HOLD_MS = 6000;

/** Hands the command that left to whoever asked it, to show a refusal on its own screen. */
export type Follow = (sent: Promise<unknown>) => void;

interface Pending {
  value: number;
  /** The mode the device was in when the first tap came. */
  mode: string;
  hass: HomeAssistant;
  follow?: Follow;
  send: ReturnType<typeof setTimeout> | null;
  hold: ReturnType<typeof setTimeout> | null;
}

/**
 * The target asked for an air conditioner (− and + on its card or its sheet, the arc), until Home
 * Assistant shows it. Module state, like `src/sheets.ts`: the card and the sheet share it, and it
 * outlives the rebuild Home Assistant makes of the page after a registry change. Kept per connection
 * (`hass.callService`, the same object across every update of the frontend, like `kept` of the review
 * screen): another Home Assistant, or another test, starts with nothing.
 */
let byConnection = new WeakMap<HomeAssistant['callService'], Map<string, Pending>>();
const listeners = new Set<() => void>();
const notTaken = new Set<(hass: HomeAssistant, entityId: string, value: number) => void>();

function pendingOf(hass: HomeAssistant): Map<string, Pending> {
  let map = byConnection.get(hass.callService);
  if (!map) byConnection.set(hass.callService, (map = new Map()));
  return map;
}

export const pendingTarget = (hass: HomeAssistant, entityId: string): number | null => pendingOf(hass).get(entityId)?.value ?? null;

export function onTargetChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function tell(): void {
  listeners.forEach((fn) => fn());
}

/** Calls `fn` when a target went out and the device never showed it within `HOLD_MS`. */
export function onTargetNotTaken(fn: (hass: HomeAssistant, entityId: string, value: number) => void): () => void {
  notTaken.add(fn);
  return () => notTaken.delete(fn);
}

function clear(p: Pending): void {
  if (p.send) clearTimeout(p.send);
  if (p.hold) clearTimeout(p.hold);
  p.send = null;
  p.hold = null;
}

/** Forgets `p`; false when another target took its place meanwhile. */
function forget(entityId: string, p: Pending): boolean {
  const pending = pendingOf(p.hass);
  if (pending.get(entityId) !== p) return false;
  clear(p);
  pending.delete(entityId);
  tell();
  return true;
}

function fire(entityId: string, p: Pending): void {
  p.send = null;
  haptic('light');
  const sent = p.hass.callService('climate', 'set_temperature', { temperature: p.value }, { entity_id: entityId }, false);
  p.follow?.(sent);
  // Refused: the target on screen goes back to the one the device keeps.
  sent.catch(() => forget(entityId, p));
  if (p.hold) clearTimeout(p.hold);
  p.hold = setTimeout(() => {
    if (forget(entityId, p)) notTaken.forEach((fn) => fn(p.hass, entityId, p.value));
  }, HOLD_MS);
}

function queue(hass: HomeAssistant, st: HassEntityState, value: number, now: boolean, follow?: Follow): void {
  const id = st.entity_id;
  const pending = pendingOf(hass);
  let p = pending.get(id);
  if (!p) {
    p = { value, mode: st.state, hass, follow, send: null, hold: null };
    pending.set(id, p);
  } else {
    p.value = value;
    p.hass = hass;
    if (follow) p.follow = follow;
  }
  clear(p);
  const it = p;
  if (now) fire(id, it);
  else it.send = setTimeout(() => fire(id, it), SEND_AFTER_MS);
  tell();
}

/**
 * One degree up or down from the target on screen, sent with the next taps after they stop. A half
 * degree set elsewhere goes to the next whole one; at a limit nothing moves, and below the lowest
 * target Home Assistant allows (an LG in Auto at 17 with 18 as the lowest) − does not jump up.
 */
export function nudgeTarget(hass: HomeAssistant, st: HassEntityState, direction: 1 | -1, follow?: Follow): void {
  const { min, max, step } = targetLimits(st.attributes);
  const now = pendingTarget(hass, st.entity_id) ?? Number(st.attributes.temperature);
  if (!Number.isFinite(now)) return;
  const moved = direction > 0 ? Math.floor(now / step) * step + step : Math.ceil(now / step) * step - step;
  const next = Math.min(max, Math.max(min, moved));
  if ((next - now) * direction <= 0) return;
  haptic('selection');
  queue(hass, st, next, false, follow);
}

/** A target picked on the arc: at once when the finger lets go, with the grouping of the taps otherwise. */
export function setTarget(hass: HomeAssistant, st: HassEntityState, value: number, opts: { now?: boolean; follow?: Follow } = {}): void {
  queue(hass, st, value, !!opts.now, opts.follow);
}

/**
 * The newest hass: a target Home Assistant now shows is done, and one whose device moved to a mode with
 * no target (Ventilar, off) is dropped, since it would be refused. A blink (a moment unavailable, the
 * target missing for one update) is not that.
 */
export function syncTarget(hass: HomeAssistant): void {
  for (const [id, p] of [...pendingOf(hass)]) {
    p.hass = hass;
    const st = hass.states[id];
    if (!st || st.state === 'unavailable' || st.state === 'unknown') continue;
    if (st.state !== p.mode && typeof st.attributes.temperature !== 'number') forget(id, p);
    else if (!p.send && st.attributes.temperature === p.value) forget(id, p);
  }
}

/** The sheet closed before the target went out: the resident saw it, so it goes now. */
export function flushTarget(hass: HomeAssistant, entityId: string): void {
  const p = pendingOf(hass).get(entityId);
  if (!p?.send) return;
  p.hass = hass;
  clear(p);
  fire(entityId, p);
}

/** Forgets a target that has not gone out (a mode was tapped: the target belonged to the mode left). */
export function dropTarget(hass: HomeAssistant, entityId: string): void {
  const p = pendingOf(hass).get(entityId);
  if (p) forget(entityId, p);
}

/** Nothing pending, between tests. */
export function resetClimateTargetForTests(): void {
  byConnection = new WeakMap();
}
