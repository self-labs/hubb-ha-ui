import { describe, expect, it, vi } from 'vitest';
import { restoreCalls, runCalls, sceneLights, snapshotLights, withUndo } from '../../src/actions/undo';
import { makeHass, withState } from '../helpers/fake-hass';

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

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
    await flush();
    expect(h.calls.slice(1).map((c) => [c.service, c.target?.entity_id])).toEqual([
      ['turn_on', 'light.a'],
      ['turn_on', 'light.b'],
    ]);
  });

  it('puts back only the lights that changed, once a change has arrived', async () => {
    const h = hass();
    let undo: (() => void) | null = null;
    await withUndo(h, ['light.a', 'light.b', 'light.c'], () => Promise.resolve(), (fn) => { undo = fn; }, {
      current: () => withState(h, 'light.a', 'off'),
    });
    undo!();
    await flush();
    expect(h.calls.map((c) => [c.service, c.target?.entity_id])).toEqual([['turn_on', 'light.a']]);
  });

  it('stops what the action started before putting the lights back', async () => {
    const h = hass();
    let undo: (() => void) | null = null;
    await withUndo(h, ['light.c'], () => Promise.resolve(), (fn) => { undo = fn; }, {
      stop: [{ domain: 'script', service: 'turn_off', target: { entity_id: 'script.chegar' } }],
    });
    undo!();
    await flush();
    expect(h.calls.map((c) => `${c.domain}.${c.service}`)).toEqual(['script.turn_off', 'light.turn_off']);
  });

  it('withdraws the offer when the action fails', async () => {
    const h = hass(true);
    const failed = vi.fn();
    await withUndo(h, ['light.a'], () => h.callService('light', 'turn_off'), () => undefined, { failed });
    expect(failed).toHaveBeenCalledOnce();
  });

  it('keeps the offer when the action fails after some lights already changed', async () => {
    const h = hass(true);
    const failed = vi.fn();
    await withUndo(h, ['light.a', 'light.b'], () => h.callService('light', 'turn_off'), () => undefined, {
      failed,
      current: () => withState(h, 'light.a', 'off'),
    });
    expect(failed).not.toHaveBeenCalled();
  });

  it('always puts back the lights the action targets, even the ones whose change has not arrived', async () => {
    const h = hass();
    let undo: (() => void) | null = null;
    await withUndo(h, ['light.a', 'light.b'], () => Promise.resolve(), (fn) => { undo = fn; }, {
      targets: ['light.a', 'light.b'],
      current: () => withState(h, 'light.a', 'off'),
    });
    undo!();
    await flush();
    expect(h.calls.map((c) => `${c.service} ${String(c.target?.entity_id)}`)).toEqual(['turn_on light.a', 'turn_on light.b']);
  });

  it('waits at most 2.5 s for an action that hangs before putting the lights back', async () => {
    vi.useFakeTimers();
    try {
      const h = hass();
      let undo: (() => void) | null = null;
      void withUndo(h, ['light.c'], () => new Promise(() => undefined), (fn) => { undo = fn; });
      undo!();
      await vi.advanceTimersByTimeAsync(2000);
      expect(h.calls).toEqual([]);
      await vi.advanceTimersByTimeAsync(600);
      expect(h.calls.map((c) => c.service)).toEqual(['turn_off']);
    } finally {
      vi.useRealTimers();
    }
  });

  it('vibrates as a failure, with no unhandled rejection, when putting back fails', async () => {
    const h = hass(true);
    const seen: string[] = [];
    const listener = (e: Event) => seen.push((e as CustomEvent<string>).detail);
    window.addEventListener('haptic', listener);
    let undo: (() => void) | null = null;
    await withUndo(h, ['light.a'], () => Promise.resolve(), (fn) => { undo = fn; });
    undo!();
    await flush();
    window.removeEventListener('haptic', listener);
    expect(seen).toEqual(['failure']);
  });

  it('finds the lights a scene touches, on the panel or not', () => {
    const h = makeHass({
      entities: [{ entity_id: 'scene.noite', state: 'unknown', attributes: { entity_id: ['light.sofa', 'switch.tv', 'light.jardim', 7] } }],
    });
    expect(sceneLights(h, 'scene.noite')).toEqual(['light.sofa', 'light.jardim']);
    expect(sceneLights(h, 'script.chegar')).toEqual([]);
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

describe('undo for a switch with the light role', () => {
  it('puts it back through the switch domain, on or off only', () => {
    expect(
      restoreCalls([
        { entityId: 'switch.teto', on: true, brightness: null },
        { entityId: 'switch.varanda', on: false, brightness: null },
      ]),
    ).toEqual([
      { domain: 'switch', service: 'turn_on', target: { entity_id: 'switch.teto' } },
      { domain: 'switch', service: 'turn_off', target: { entity_id: 'switch.varanda' } },
    ]);
  });

  it('counts the switch lights a scene sets among its lights, and only those', () => {
    const h = makeHass({
      entities: [{ entity_id: 'scene.noite', state: 'unknown', attributes: { entity_id: ['light.sofa', 'switch.teto', 'switch.bomba'] } }],
    });
    expect(sceneLights(h, 'scene.noite', ['switch.teto', 'light.sofa'])).toEqual(['light.sofa', 'switch.teto']);
    expect(sceneLights(h, 'scene.noite')).toEqual(['light.sofa']);
  });
});
