import { mdiFan, mdiFire, mdiPower, mdiSnowflake, mdiSunSnowflakeVariant, mdiThermostatAuto, mdiWaterPercent } from '@mdi/js';
import type { HassEntityState } from '../ha/types';
import { CLIMATE } from '../strings';

/** The colour of each mode, as in Home Assistant: blue cold, orange heat (tokens `--hubb-mode-*`). */
const COLOR: Readonly<Record<string, string>> = {
  cool: 'cool',
  heat: 'heat',
  auto: 'auto',
  heat_cool: 'auto',
  dry: 'dry',
  fan_only: 'fan',
};

const ICON: Readonly<Record<string, string>> = {
  cool: mdiSnowflake,
  heat: mdiFire,
  auto: mdiThermostatAuto,
  heat_cool: mdiSunSnowflakeVariant,
  dry: mdiWaterPercent,
  fan_only: mdiFan,
  off: mdiPower,
};

/** What a mode does, for a device that does not report `hvac_action` ("Ventilar" reads "Ventilando"). */
const DOING: Readonly<Record<string, string>> = { cool: 'cooling', heat: 'heating', dry: 'drying', fan_only: 'fan' };

export const modeColor = (mode: string): string => `var(--hubb-mode-${COLOR[mode] ?? 'off'})`;

/** The ink of a mode: its words and icons over its tint (`--hubb-mode-*-ink`). */
export const modeInk = (mode: string): string => `var(--hubb-mode-${COLOR[mode] ?? 'off'}-ink)`;

/** The colour and the ink of a mode, for a `style` attribute: `--mode` and `--mode-ink`. */
export const modeVars = (mode: string): string => `--mode: ${modeColor(mode)}; --mode-ink: ${modeInk(mode)}`;

export const modeIcon = (mode: string): string => ICON[mode] ?? mdiThermostatAuto;

/**
 * What the air conditioner is doing, in one word: "Resfriando", "Em espera" at its target (as the home
 * says, by `climateLine`), "Ventilando", "Desligado".
 */
export function modeDoing(st: HassEntityState): string {
  if (st.state === 'off') return CLIMATE.off;
  // An infrared unit before its first command: there is nothing true to say.
  if (st.state === 'unknown') return '';
  const action = st.attributes.hvac_action;
  const said = typeof action === 'string' && action !== 'off' ? CLIMATE.actions[action] : undefined;
  return said ?? CLIMATE.actions[DOING[st.state] ?? ''] ?? CLIMATE.modes[st.state] ?? st.state;
}
