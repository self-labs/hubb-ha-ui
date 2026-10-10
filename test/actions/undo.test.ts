import { describe, expect, it, vi } from 'vitest';
import { restoreCalls, runCalls, snapshotLights, withUndo } from '../../src/actions/undo';
import { makeHass } from '../helpers/fake-hass';

function hass(failService = false) {
  return makeHass({
    failService,
    entities: [
      { entity_id: 'light.a', state: 'on', attributes: { brightness: 128 } },
      { entity_id: 'light.b', state: 'on', attributes: {} },
      { entity_id: 'light.c', state: 'off' },
      { entity_id: 'light.d', state: 'unavailable' },
    ],
  });
}

describe('undo', () => {
  it('snapshots what each light was, skipping unknown and unavailable ones', () => {
    expect(snapshotLights(hass(), ['light.a', 'light.b', 'light.c', 'light.d', 'light.missing'])).toEqual([
      { entityId: 'light.a', on: true, brightness: 128 },
      { entityId: 'light.b', on: true, brightness: null },
      { entityId: 'light.c', on: false, brightness: null },
    ]);
  });

  it('turns a snapshot into the calls that put things back', () => {
    const calls = restoreCalls([
      { entityId: 'light.a', on: true, brightness: 128 },
      { entityId: 'light.b', on: true, brightness: null },
      { entityId: 'light.c', on: false, brightness: null },
    ]);
    expect(calls).toEqual([
      { domain: 'light', service: 'turn_on', data: { brightness: 128 }, target: { entity_id: 'light.a' } },
      { domain: 'light', service: 'turn_on', target: { entity_id: 'light.b' } },
      { domain: 'light', service: 'turn_off', target: { entity_id: 'light.c' } },
    ]);
  });

  it('runs every call', async () => {
    const h = hass();
    await runCalls(h, [{ domain: 'light', service: 'turn_off', target: { entity_id: 'light.a' } }]);
    expect(h.calls).toHaveLength(1);
  });

  it('offers the undo before the action finishes, and the undo restores the snapshot', async () => {
    const h = hass();
    let undo: (() => void) | null = null;
    const action = vi.fn(() => h.callService('light', 'turn_off', undefined, { entity_id: ['light.a', 'light.b'] }));
    await withUndo(h, ['light.a', 'light.b'], action, (fn) => {
      undo = fn;
      expect(action).not.toHaveBeenCalled();
    });
    expect(action).toHaveBeenCalledOnce();
    undo!();
    await Promise.resolve();
    expect(h.calls.slice(1).map((c) => [c.service, c.target?.entity_id])).toEqual([
      ['turn_on', 'light.a'],
      ['turn_on', 'light.b'],
    ]);
  });

  it('vibrates as a failure when the action fails', async () => {
    const h = hass(true);
    const seen: string[] = [];
    const listener = (e: Event) => seen.push((e as CustomEvent<string>).detail);
    window.addEventListener('haptic', listener);
    await withUndo(h, ['light.a'], () => h.callService('light', 'turn_off'), () => undefined);
    window.removeEventListener('haptic', listener);
    expect(seen).toEqual(['failure']);
  });
});
