import { afterEach, describe, expect, it, vi } from 'vitest';
import { WAKE_MS, onWakeChange, wakeOf, wakeThenStart } from '../../src/actions/appliance';
import { buildHouse } from '../../src/model/build-house';
import { CASA2_CONFIG, casa2Hass } from '../fixtures/casa-exemplo-2';
import { withState, type FakeHass } from '../helpers/fake-hass';

const parts = (h: FakeHass) => buildHouse(h, CASA2_CONFIG).rooms.find((r) => r.areaId === 'terraco')!.appliances[0]!.parts;
const pressed = (h: FakeHass) => h.calls.map((c) => `${c.service} ${(c.target as { entity_id: string }).entity_id}`);
const ON = 'button.lavadora_executecommand_2';
const START = 'button.lavadora_executecommand_5';
const STATE = 'sensor.lavadora_appliancestate';

describe('wakeThenStart', () => {
  afterEach(() => vi.useRealTimers());

  it('presses Ligar, waits for the washer to leave Idle, then presses Iniciar', async () => {
    vi.useFakeTimers();
    const idle = casa2Hass('Idle', '80');
    let now: FakeHass = idle;
    const done = wakeThenStart(idle, () => now, parts(idle), ON, START);
    await vi.advanceTimersByTimeAsync(1000);
    expect(pressed(idle)).toEqual([`press ${ON}`]);
    now = withState(idle, STATE, 'Ready To Start');
    await vi.advanceTimersByTimeAsync(500);
    expect(pressed(idle)).toEqual([`press ${ON}`, `press ${START}`]);
    now = withState(idle, STATE, 'Running');
    await vi.advanceTimersByTimeAsync(500);
    await done;
  });

  it('never presses Iniciar when the washer does not wake, and says so', async () => {
    vi.useFakeTimers();
    const idle = casa2Hass('Idle', '80');
    const done = wakeThenStart(idle, () => idle, parts(idle), ON, START);
    const failed = expect(done).rejects.toThrow();
    await vi.advanceTimersByTimeAsync(WAKE_MS + 500);
    await failed;
    expect(pressed(idle)).toEqual([`press ${ON}`]);
    expect(wakeOf(START)).toBeNull();
  });

  it('says it is switching on, then starting until the washer runs, and tells whoever listens', async () => {
    vi.useFakeTimers();
    const idle = casa2Hass('Idle', '80');
    let now: FakeHass = idle;
    const heard = vi.fn();
    const stop = onWakeChange(heard);
    const done = wakeThenStart(idle, () => now, parts(idle), ON, START);
    await vi.advanceTimersByTimeAsync(300);
    expect(wakeOf(START)).toBe('waking');
    now = withState(idle, STATE, 'Ready To Start');
    await vi.advanceTimersByTimeAsync(300);
    expect(wakeOf(START)).toBe('starting');
    now = withState(idle, STATE, 'Running');
    await vi.advanceTimersByTimeAsync(300);
    await done;
    expect(wakeOf(START)).toBeNull();
    expect(heard).toHaveBeenCalledTimes(3);
    stop();
  });

  it('lets a second tap go while the first is still on its way', async () => {
    vi.useFakeTimers();
    const idle = casa2Hass('Idle', '80');
    let now: FakeHass = idle;
    const first = wakeThenStart(idle, () => now, parts(idle), ON, START);
    await vi.advanceTimersByTimeAsync(300);
    await wakeThenStart(idle, () => now, parts(idle), ON, START);
    expect(pressed(idle)).toEqual([`press ${ON}`]);
    now = withState(idle, STATE, 'Running');
    await vi.advanceTimersByTimeAsync(300);
    await first;
  });
});
