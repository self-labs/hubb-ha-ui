import type { HomeAssistant } from './ha/types';

/** The newest hass any screen received: the one on screen keeps getting updates, a hidden one does not. */
let latest: HomeAssistant | undefined;

export function setLatestHass(hass: HomeAssistant): void {
  latest = hass;
}

export function latestHass(): HomeAssistant | undefined {
  return latest;
}
