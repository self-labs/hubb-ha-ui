import type { HassEntityState } from './ha/types';

/**
 * How far the clock of this device runs ahead of the clock of Home Assistant, in milliseconds
 * (negative: behind). A song's position comes with the time of the server; counted from the clock of
 * an iPad 74 s ahead, a song that had just started showed 1:14 (21/10).
 *
 * Learned from the states as they arrive: a state that just changed was stamped by the server a moment
 * before this device got it, so "now here" minus its `last_updated` is the gap plus the time on the
 * way. The smallest one seen is the best guess; it is learned again every few minutes, in case the
 * clock of the device is set in between. Module state: every screen feeds it, every bar reads it.
 */
let best: number | null = null;
let bestAt = 0;
const RELEARN_MS = 10 * 60_000;

export const serverSkew = (): number => best ?? 0;

function sample(gap: number): void {
  const now = Date.now();
  if (best === null || gap < best || now - bestAt > RELEARN_MS) {
    best = gap;
    bestAt = now;
  }
}

/** One sample from a new set of states: the first state that is not the one before. */
export function sampleServerClock(
  before: Readonly<Record<string, HassEntityState>> | undefined,
  after: Readonly<Record<string, HassEntityState>>,
): void {
  if (!before || before === after) return;
  for (const id in after) {
    const st = after[id]!;
    if (st === before[id]) continue;
    const at = st.last_updated ? Date.parse(st.last_updated) : NaN;
    if (Number.isFinite(at)) sample(Date.now() - at);
    return;
  }
}

/** Nothing learned, between tests. */
export function resetServerClockForTests(): void {
  best = null;
  bestAt = 0;
}
