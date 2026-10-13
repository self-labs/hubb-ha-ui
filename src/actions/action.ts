import type { HomeAssistant } from '../ha/types';

/** Runs an action: `press` for a button or an input_button, `turn_on` for a script. */
export function pressAction(hass: HomeAssistant, entityId: string): Promise<unknown> {
  const domain = entityId.slice(0, entityId.indexOf('.'));
  return hass.callService(domain, domain === 'script' ? 'turn_on' : 'press', undefined, { entity_id: entityId });
}
