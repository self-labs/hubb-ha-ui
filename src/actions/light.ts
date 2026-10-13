import type { HassEntityState, HomeAssistant } from '../ha/types';

/**
 * Turns lights on or off. A `switch` with the light role goes through `switch.*`, with no brightness;
 * a mixed list makes one call per domain, all of them sent before the first failure is raised.
 */
export function setLight(
  hass: HomeAssistant,
  entityId: string | string[],
  on: boolean,
  brightnessPct?: number,
): Promise<unknown> {
  const ids = Array.isArray(entityId) ? entityId : [entityId];
  // The target keeps the shape it came in: one id stays a string, a list stays a list.
  const target = (group: string[]) => ({ entity_id: Array.isArray(entityId) ? group : group[0]! });
  const switches = ids.filter((id) => id.startsWith('switch.'));
  const lights = ids.filter((id) => !id.startsWith('switch.'));
  const calls: Promise<unknown>[] = [];
  if (lights.length) {
    calls.push(
      on
        ? hass.callService('light', 'turn_on', brightnessPct === undefined ? undefined : { brightness_pct: brightnessPct }, target(lights))
        : hass.callService('light', 'turn_off', undefined, target(lights)),
    );
  }
  if (switches.length) calls.push(hass.callService('switch', on ? 'turn_on' : 'turn_off', undefined, target(switches)));
  return calls.length === 1 ? calls[0]! : Promise.all(calls);
}

/** 0 to 100, only for a light that is on and reports a brightness. */
export function brightnessPct(state: HassEntityState | undefined): number | null {
  const b = state?.attributes.brightness;
  return state?.state === 'on' && typeof b === 'number' ? Math.round((b / 255) * 100) : null;
}

export function runScene(hass: HomeAssistant, entityId: string): Promise<unknown> {
  return hass.callService(entityId.slice(0, entityId.indexOf('.')), 'turn_on', undefined, { entity_id: entityId });
}
