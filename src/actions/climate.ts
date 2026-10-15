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

/** The sign after a reading: "°" for Celsius, the house's own unit; "°F" spelled out, so 75 does not read as a fever. */
export function degreeSign(unit: unknown): string {
  return unit === '°F' ? '°F' : '°';
}

/**
 * The word for an attribute value (fan speed, swing, preset): ours first, written for the headings of
 * the sheet ("Ventilação: Baixa", "Oscilação: Desligada"), so a row never mixes them with the
 * masculine words of Home Assistant; then Home Assistant's own translation; null when neither names
 * it ("MiddleTop1", "position_3"): a raw value of an integration says nothing to a resident, so the
 * sheet leaves it out (Gustavo, 14/10).
 */
export function knownWord(hass: HomeAssistant, st: HassEntityState, attribute: string, value: string): string | null {
  const ours = CLIMATE.fanWords[value.toLowerCase()] ?? CLIMATE.modes[value];
  if (ours) return ours;
  const shown = hass.formatEntityAttributeValue?.(st, attribute, value);
  return shown && shown !== value ? shown : null;
}

/** The values of an attribute list that have a name, each with it, in their order. */
export function namedValues(hass: HomeAssistant, st: HassEntityState, attribute: string, values: readonly string[]): [string, string][] {
  return values.flatMap((v): [string, string][] => {
    const word = knownWord(hass, st, attribute, v);
    return word ? [[v, word]] : [];
  });
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

/** Whether the power button can do anything: an air conditioner with no way to go off has none. */
export function canPower(st: HassEntityState): boolean {
  return has(st, CLIMATE_FEATURE.turnOff) || (Array.isArray(st.attributes.hvac_modes) && st.attributes.hvac_modes.includes('off'));
}

/**
 * Turns an air conditioner on or off; without turn_on it picks a mode it has, cold first, among the
 * modes the installer kept (`kept`) when there are any.
 */
export function setClimatePower(hass: HomeAssistant, st: HassEntityState, on: boolean, kept?: readonly string[] | null): Promise<unknown> {
  const target = { entity_id: st.entity_id };
  if (!on) {
    return has(st, CLIMATE_FEATURE.turnOff)
      ? hass.callService('climate', 'turn_off', undefined, target)
      : hass.callService('climate', 'set_hvac_mode', { hvac_mode: 'off' }, target);
  }
  if (has(st, CLIMATE_FEATURE.turnOn)) return hass.callService('climate', 'turn_on', undefined, target);
  const all = Array.isArray(st.attributes.hvac_modes) ? (st.attributes.hvac_modes as string[]) : [];
  const modes = kept?.length ? all.filter((m) => kept.includes(m)) : all;
  const mode = ['cool', 'heat_cool', 'auto', 'heat', 'dry', 'fan_only'].find((m) => modes.includes(m)) ?? 'cool';
  return hass.callService('climate', 'set_hvac_mode', { hvac_mode: mode }, target);
}
