import type { HassEntityState, HomeAssistant } from '../ha/types';
import { CLIMATE } from '../strings';

/** Features of a `climate` entity (ClimateEntityFeature). */
export const CLIMATE_FEATURE = { target: 1, fan: 8, preset: 16, swing: 32, turnOff: 128, turnOn: 256 } as const;
/** Features of a `fan` entity (FanEntityFeature). */
export const FAN_FEATURE = { speed: 1 } as const;

export const has = (st: HassEntityState | undefined, feature: number): boolean =>
  (Number(st?.attributes.supported_features ?? 0) & feature) !== 0;

/** A temperature as people write it in Brazil: "23", "22,5". */
export function degrees(t: number): string {
  return t.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
}

/**
 * The word for an attribute value (fan speed, swing, preset): Home Assistant's own translation when
 * it has one, else ours, else the value as it comes.
 */
export function attributeWord(hass: HomeAssistant, st: HassEntityState, attribute: string, value: string): string {
  const shown = hass.formatEntityAttributeValue?.(st, attribute, value);
  if (shown && shown !== value) return shown;
  return CLIMATE.fanWords[value.toLowerCase()] ?? CLIMATE.modes[value] ?? value;
}

/** The line under an air conditioner: what it is doing and the target ("Resfriando · 23°"). */
export function climateLine(st: HassEntityState): string {
  if (st.state === 'off') return CLIMATE.off;
  // An infrared air conditioner before its first command: there is nothing true to say.
  if (st.state === 'unknown') return '';
  const action = st.attributes.hvac_action;
  const word =
    (typeof action === 'string' && action !== 'off' ? CLIMATE.actions[action] : undefined) ?? CLIMATE.modes[st.state] ?? st.state;
  const target = st.attributes.temperature;
  return typeof target === 'number' && st.state !== 'fan_only' ? `${word} · ${degrees(target)}°` : word;
}

/** Turns an air conditioner on or off; without turn_on it picks a mode it has, cold first. */
export function setClimatePower(hass: HomeAssistant, st: HassEntityState, on: boolean): Promise<unknown> {
  const target = { entity_id: st.entity_id };
  if (!on) {
    return has(st, CLIMATE_FEATURE.turnOff)
      ? hass.callService('climate', 'turn_off', undefined, target)
      : hass.callService('climate', 'set_hvac_mode', { hvac_mode: 'off' }, target);
  }
  if (has(st, CLIMATE_FEATURE.turnOn)) return hass.callService('climate', 'turn_on', undefined, target);
  const modes = Array.isArray(st.attributes.hvac_modes) ? (st.attributes.hvac_modes as string[]) : [];
  const mode = ['cool', 'heat_cool', 'auto', 'heat', 'dry', 'fan_only'].find((m) => modes.includes(m)) ?? 'cool';
  return hass.callService('climate', 'set_hvac_mode', { hvac_mode: mode }, target);
}
