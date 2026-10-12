import type { HomeAssistant } from '../ha/types';

export function setSwitch(hass: HomeAssistant, entityId: string | string[], on: boolean): Promise<unknown> {
  return hass.callService('switch', on ? 'turn_on' : 'turn_off', undefined, { entity_id: entityId });
}
