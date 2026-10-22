import type { HomeAssistant } from '../ha/types';
import { isPoweredOff, situation, type ApplianceParts } from '../model/appliances';
import { pressAction } from './action';

/** How long Iniciar waits for an appliance switched off to wake after Ligar, and then to run. */
export const WAKE_MS = 10000;
const POLL_MS = 250;

/** Where an Iniciar from off is: switching the appliance on, or started and waiting for it to run. */
export type Wake = 'waking' | 'starting';

/**
 * The wakes on their way, by start button. Module state: Home Assistant rebuilds the page while the
 * appliance wakes (its state changes), and the new sheet must hold its row still too.
 */
const wakes = new Map<string, Wake>();
const listeners = new Set<() => void>();

function setWake(start: string, wake: Wake | null): void {
  if (wake) wakes.set(start, wake);
  else wakes.delete(start);
  for (const listener of listeners) listener();
}

export function wakeOf(start: string): Wake | null {
  return wakes.get(start) ?? null;
}

/** Called whenever a wake begins, moves on or ends; returns the call that stops listening. */
export function onWakeChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Waits until `done` holds, polling the newest hass; false when the time runs out. */
async function waitFor(done: () => boolean): Promise<boolean> {
  const deadline = Date.now() + WAKE_MS;
  while (!done()) {
    if (Date.now() >= deadline) return false;
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }
  return true;
}

/**
 * Iniciar on an appliance that is switched off: Ligar, wait until its state leaves off, then Iniciar.
 * An Electrolux washer in Idle ignores Iniciar alone; Ligar takes it to Ready To Start in about 3 s
 * (Gustavo's house, 21 and 22/10). `current` gives the newest hass, since the one tapped stops
 * changing. When it does not wake, Iniciar is never sent and the promise fails.
 *
 * The wake lasts until the appliance runs: on the way, Ready To Start would turn the row into
 * Iniciar and Desligar, and a second tap on the place of Iniciar switched the washer off (22/10).
 * A tap while a wake is on its way does nothing.
 */
export async function wakeThenStart(
  hass: HomeAssistant,
  current: () => HomeAssistant | undefined,
  parts: ApplianceParts,
  on: string,
  start: string,
): Promise<void> {
  if (wakes.has(start)) return;
  const now = (): HomeAssistant => current() ?? hass;
  setWake(start, 'waking');
  try {
    await pressAction(hass, on);
    if (!(await waitFor(() => !isPoweredOff(now(), parts)))) throw new Error('the appliance did not switch on');
    setWake(start, 'starting');
    await pressAction(hass, start);
    // Iniciar went through: an appliance slow to run only gives the row back, it does not fail.
    await waitFor(() => situation(now(), parts) !== 'stopped');
  } finally {
    setWake(start, null);
  }
}
