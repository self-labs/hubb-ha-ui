import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VolumeTarget } from '../src/actions/volume';

describe('the volume target', () => {
  let sent: number[];
  let v: VolumeTarget;
  beforeEach(() => {
    vi.useFakeTimers();
    sent = [];
    v = new VolumeTarget((level) => sent.push(level));
  });
  afterEach(() => {
    v.dispose();
    vi.useRealTimers();
  });

  it('adds up quick taps from the target, not from the state that has not moved yet', () => {
    expect(v.step(0.25, 1)).toBe(0.3);
    expect(v.step(0.25, 1)).toBe(0.35);
    expect(v.step(0.25, 1)).toBe(0.4);
    vi.advanceTimersByTime(299);
    expect(sent).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(sent).toEqual([0.4]);
  });

  it('shows the target until Home Assistant confirms it, or for 3 s at most', () => {
    v.step(0.25, 1);
    expect(v.shown(0.25)).toBe(0.3);
    expect(v.shown(0.3)).toBe(0.3);
    expect(v.shown(0.25)).toBe(0.25);
    v.step(0.25, 1);
    vi.advanceTimersByTime(3000);
    expect(v.shown(0.25)).toBe(0.25);
  });

  it('stays between 0 and 1', () => {
    expect(v.step(0.98, 1)).toBe(1);
    v.dispose();
    v = new VolumeTarget((level) => sent.push(level));
    expect(v.step(0.02, -1)).toBe(0);
    expect(v.shown(null)).toBe(0);
  });

  it('sends a level set on the bar, and the waiting one at once when disposed, never later', () => {
    v.set(0.6);
    vi.advanceTimersByTime(300);
    expect(sent).toEqual([0.6]);
    v.step(0.6, 1);
    v.dispose();
    expect(sent).toEqual([0.6, 0.65]);
    vi.advanceTimersByTime(300);
    expect(sent).toEqual([0.6, 0.65]);
    v.dispose();
    expect(sent).toEqual([0.6, 0.65]);
  });
});
