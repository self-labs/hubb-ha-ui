import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  dropTarget,
  flushTarget,
  HOLD_MS,
  nudgeTarget,
  onTargetChange,
  onTargetNotTaken,
  pendingTarget,
  resetClimateTargetForTests,
  SEND_AFTER_MS,
  setTarget,
  syncTarget,
} from '../../src/actions/climate-target';
import { makeHass, withState, type FakeHass } from '../helpers/fake-hass';

// The target asked with − and + (on the card or on the sheet) and with the arc, until Home Assistant
// shows it: one per air conditioner, shared by the card and the sheet, and it outlives a rebuild.

const ID = 'climate.sala';

function ar(attrs: Record<string, unknown> = {}, state = 'cool', failService = false): FakeHass {
  return makeHass({
    failService,
    entities: [{ entity_id: ID, name: 'Ar', state, attributes: { temperature: 23, min_temp: 16, max_temp: 30, target_temp_step: 1, ...attrs } }],
  });
}

const sent = (h: FakeHass) => h.calls.filter((c) => c.service === 'set_temperature').map((c) => c.data);
const settle = async (): Promise<void> => {
  for (let i = 0; i < 4; i++) await Promise.resolve();
};

describe('a target the device never takes (an LG in Auto takes only 18 and 19, 23/10)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    resetClimateTargetForTests();
    vi.useRealTimers();
  });

  it('is reported once the wait is over, and only then', async () => {
    const h = ar();
    const told: [string, number][] = [];
    const off = onTargetNotTaken((hass, id, value) => hass.callService === h.callService && told.push([id, value]));
    setTarget(h, h.states[ID]!, 21, { now: true });
    await settle();
    vi.advanceTimersByTime(HOLD_MS - 1);
    expect(told).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(told).toEqual([[ID, 21]]);
    expect(pendingTarget(h, ID)).toBeNull();
    off();
  });

  it('is not reported when Home Assistant shows it, when the device refuses it or when the mode changes', async () => {
    const told: number[] = [];
    const off = onTargetNotTaken((_h, _id, value) => told.push(value));
    const shown = ar();
    setTarget(shown, shown.states[ID]!, 21, { now: true });
    await settle();
    syncTarget(withState(shown, ID, 'cool', { temperature: 21, min_temp: 16, max_temp: 30, target_temp_step: 1 }));
    const refused = ar({}, 'cool', true);
    setTarget(refused, refused.states[ID]!, 21, { now: true });
    await settle();
    const moved = ar();
    setTarget(moved, moved.states[ID]!, 21, { now: true });
    await settle();
    syncTarget(withState(moved, ID, 'fan_only', { temperature: null }));
    vi.advanceTimersByTime(HOLD_MS * 2);
    expect(told).toEqual([]);
    off();
  });
});

describe('the target of an air conditioner, until Home Assistant shows it', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    resetClimateTargetForTests();
    vi.useRealTimers();
  });

  it('two taps on + go out as one command, after the taps stop', () => {
    const h = ar();
    nudgeTarget(h, h.states[ID]!, 1);
    nudgeTarget(h, h.states[ID]!, 1);
    expect(pendingTarget(h, ID)).toBe(25);
    vi.advanceTimersByTime(SEND_AFTER_MS - 1);
    expect(sent(h)).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(sent(h)).toEqual([{ temperature: 25 }]);
  });

  it('a half degree set elsewhere goes to the next whole one, and a limit stops it', () => {
    let h = ar({ temperature: 23.5 });
    nudgeTarget(h, h.states[ID]!, 1);
    expect(pendingTarget(h, ID)).toBe(24);
    resetClimateTargetForTests();
    nudgeTarget(h, h.states[ID]!, -1);
    expect(pendingTarget(h, ID)).toBe(23);
    resetClimateTargetForTests();
    h = ar({ temperature: 30 });
    nudgeTarget(h, h.states[ID]!, 1);
    expect(pendingTarget(h, ID)).toBeNull();
  });

  it('an LG in Auto at 17 with 18 as the lowest: − sends nothing, never a jump up to 18', () => {
    const h = ar({ temperature: 17, min_temp: 18 }, 'auto');
    nudgeTarget(h, h.states[ID]!, -1);
    vi.advanceTimersByTime(SEND_AFTER_MS);
    expect(pendingTarget(h, ID)).toBeNull();
    expect(sent(h)).toEqual([]);
  });

  it('the arc let go sends at once, once', () => {
    const h = ar();
    setTarget(h, h.states[ID]!, 21, { now: true });
    expect(sent(h)).toEqual([{ temperature: 21 }]);
    vi.advanceTimersByTime(SEND_AFTER_MS);
    expect(sent(h)).toHaveLength(1);
  });

  it('a refusal goes back to the target the device keeps, and the caller hears of it', async () => {
    const h = ar({}, 'cool', true);
    let failed = false;
    nudgeTarget(h, h.states[ID]!, 1, (p) => p.catch(() => (failed = true)));
    vi.advanceTimersByTime(SEND_AFTER_MS);
    await settle();
    expect(failed).toBe(true);
    expect(pendingTarget(h, ID)).toBeNull();
  });

  it('forgets the target once Home Assistant shows it, or after a while when it never does', () => {
    let h = ar();
    nudgeTarget(h, h.states[ID]!, 1);
    vi.advanceTimersByTime(SEND_AFTER_MS);
    h = withState(h, ID, 'cool', { temperature: 24, min_temp: 16, max_temp: 30, target_temp_step: 1 });
    syncTarget(h);
    expect(pendingTarget(h, ID)).toBeNull();
    nudgeTarget(h, h.states[ID]!, 1);
    vi.advanceTimersByTime(SEND_AFTER_MS + HOLD_MS);
    expect(pendingTarget(h, ID)).toBeNull();
  });

  it('the mode changed elsewhere to one with no target: the target is dropped, never sent to Ventilar', () => {
    let h = ar();
    nudgeTarget(h, h.states[ID]!, 1);
    // A blink (a moment unavailable) is not that.
    h = withState(h, ID, 'unavailable', {});
    syncTarget(h);
    expect(pendingTarget(h, ID)).toBe(24);
    h = withState(h, ID, 'fan_only', { min_temp: 16, max_temp: 30 });
    syncTarget(h);
    syncTarget(h);
    expect(pendingTarget(h, ID)).toBeNull();
    vi.advanceTimersByTime(SEND_AFTER_MS);
    expect(sent(h)).toEqual([]);
  });

  it('the card and the sheet share one target: their taps add up and go out once', () => {
    const h = ar();
    let told = 0;
    const off = onTargetChange(() => told++);
    nudgeTarget(h, h.states[ID]!, 1);
    nudgeTarget(h, h.states[ID]!, 1);
    nudgeTarget(h, h.states[ID]!, -1);
    expect(pendingTarget(h, ID)).toBe(24);
    expect(told).toBeGreaterThan(0);
    vi.advanceTimersByTime(SEND_AFTER_MS);
    expect(sent(h)).toEqual([{ temperature: 24 }]);
    off();
  });

  it('a rebuild of Home Assistant in the middle keeps the target, and it goes out once', () => {
    const h = ar();
    nudgeTarget(h, h.states[ID]!, 1);
    const rebuilt = withState(h, ID, 'cool', { temperature: 23, min_temp: 16, max_temp: 30, target_temp_step: 1 });
    syncTarget(rebuilt);
    expect(pendingTarget(h, ID)).toBe(24);
    vi.advanceTimersByTime(SEND_AFTER_MS);
    // The rebuilt hass shares the calls of the first one, as the frontend keeps one connection.
    expect(sent(rebuilt)).toEqual([{ temperature: 24 }]);
  });

  it('the sheet closing sends what is waiting at once, once', () => {
    const h = ar();
    nudgeTarget(h, h.states[ID]!, 1);
    flushTarget(h, ID);
    expect(sent(h)).toEqual([{ temperature: 24 }]);
    vi.advanceTimersByTime(SEND_AFTER_MS);
    expect(sent(h)).toHaveLength(1);
  });

  it('a mode tapped drops the target that had not gone out', () => {
    const h = ar();
    nudgeTarget(h, h.states[ID]!, 1);
    dropTarget(h, ID);
    vi.advanceTimersByTime(SEND_AFTER_MS);
    expect(pendingTarget(h, ID)).toBeNull();
    expect(sent(h)).toEqual([]);
  });
});
