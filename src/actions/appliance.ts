import type { HomeAssistant } from '../ha/types';
import { isPoweredOff, type ApplianceParts } from '../model/appliances';
import { pressAction } from './action';

/** How long Iniciar waits for an appliance switched off to wake after Ligar. */
export const WAKE_MS = 10000;
const POLL_MS = 250;

/**
 * Iniciar on an appliance that is switched off: Ligar, wait until its state leaves off, then Iniciar.
 * An Electrolux washer in Idle ignores Iniciar alone; Ligar takes it to Ready To Start in about 3 s
 * (Gustavo's house, 21 and 22/10). `current` gives the newest hass, since the one tapped stops
 * changing. When it does not wake, Iniciar is never sent and the promise fails.
 */
export async function wakeThenStart(
  hass: HomeAssistant,
  current: () => HomeAssistant | undefined,
  parts: ApplianceParts,
  on: string,
  start: string,
): Promise<void> {
  await pressAction(hass, on);
  const deadline = Date.now() + WAKE_MS;
  while (isPoweredOff(current() ?? hass, parts)) {
    if (Date.now() >= deadline) throw new Error('the appliance did not switch on');
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }
  await pressAction(hass, start);
}
