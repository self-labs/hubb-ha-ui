import type { HomeAssistant } from './types';

/**
 * Integrations that drive a device by infrared. The device never answers, so its state in Home
 * Assistant is the last command sent, not what the device is doing.
 */
const INFRARED_PLATFORMS = new Set(['tasmota_ir', 'smartir']);

export function isInfrared(hass: HomeAssistant, entityId: string): boolean {
  return INFRARED_PLATFORMS.has(hass.entities[entityId]?.platform ?? '');
}
