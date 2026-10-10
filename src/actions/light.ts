import type { HassEntityState, HomeAssistant } from '../ha/types';

export function setLight(
  hass: HomeAssistant,
  entityId: string | string[],
  on: boolean,
  brightnessPct?: number,
): Promise<unknown> {
  if (!on) return hass.callService('light', 'turn_off', undefined, { entity_id: entityId });
  return hass.callService(
    'light',
    'turn_on',
    brightnessPct === undefined ? undefined : { brightness_pct: brightnessPct },
    { entity_id: entityId },
  );
}

/** 0 to 100, only for a light that is on and reports a brightness. */
export function brightnessPct(state: HassEntityState | undefined): number | null {
  const b = state?.attributes.brightness;
  return state?.state === 'on' && typeof b === 'number' ? Math.round((b / 255) * 100) : null;
}

export function runScene(hass: HomeAssistant, entityId: string): Promise<unknown> {
  return hass.callService(entityId.slice(0, entityId.indexOf('.')), 'turn_on', undefined, { entity_id: entityId });
}
