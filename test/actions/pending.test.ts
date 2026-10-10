import { describe, expect, it } from 'vitest';
import { PendingTracker } from '../../src/actions/pending';

function clock() {
  let t = 0;
  return { now: () => t, advance: (ms: number) => { t += ms; } };
}

describe('PendingTracker', () => {
  it('is idle for an entity nobody touched', () => {
    expect(new PendingTracker().status('light.a', 'on')).toBe('idle');
  });

  it('waits until the state matches what was asked', () => {
    const c = clock();
    const t = new PendingTracker(3000, 4000, c.now);
    t.start('light.a', 'off');
    expect(t.status('light.a', 'on')).toBe('pending');
    expect(t.expected('light.a')).toBe('off');
    expect(t.status('light.a', 'off')).toBe('idle');
    expect(t.expected('light.a')).toBeNull();
  });

  it('fails after the timeout, shows the failure for a while, then forgets', () => {
    const c = clock();
    const t = new PendingTracker(3000, 4000, c.now);
    t.start('light.a', 'off');
    c.advance(3000);
    expect(t.status('light.a', 'on')).toBe('failed');
    expect(t.expected('light.a')).toBeNull();
    c.advance(3999);
    expect(t.status('light.a', 'on')).toBe('failed');
    c.advance(1);
    expect(t.status('light.a', 'on')).toBe('idle');
  });

  it('starts over when asked again, even after a failure', () => {
    const c = clock();
    const t = new PendingTracker(3000, 4000, c.now);
    t.start('light.a', 'off');
    c.advance(3500);
    t.status('light.a', 'on');
    t.start('light.a', 'on');
    expect(t.status('light.a', 'off')).toBe('pending');
  });
});
