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

  it('dates the failure from the end of the wait, not from when someone looks', () => {
    const c = clock();
    const t = new PendingTracker(3000, 4000, c.now);
    t.start('light.a', 'off');
    c.advance(60000);
    expect(t.status('light.a', 'on')).toBe('idle');
  });

  it('drops the failure as soon as a late confirmation arrives', () => {
    const c = clock();
    const t = new PendingTracker(3000, 4000, c.now);
    t.start('light.a', 'off');
    c.advance(3000);
    expect(t.status('light.a', 'on')).toBe('failed');
    c.advance(500);
    expect(t.status('light.a', 'off')).toBe('idle');
  });

  it('waits for a new state when it asked for the state the entity already had', () => {
    const t = new PendingTracker();
    const before = { state: 'on' };
    t.start('light.a', 'on', before);
    expect(t.status('light.a', 'on', before)).toBe('pending');
    expect(t.status('light.a', 'on', { state: 'on' })).toBe('idle');
  });

  it('says how long until the status changes by time alone', () => {
    const c = clock();
    const t = new PendingTracker(3000, 4000, c.now);
    expect(t.msUntilChange('light.a')).toBeNull();
    t.start('light.a', 'off');
    c.advance(1000);
    expect(t.msUntilChange('light.a')).toBe(2000);
    c.advance(2000);
    t.status('light.a', 'on');
    expect(t.msUntilChange('light.a')).toBe(4000);
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
