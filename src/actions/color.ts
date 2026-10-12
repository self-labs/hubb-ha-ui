import type { HassEntityState, HomeAssistant } from '../ha/types';
import type { PRESET_WORDS } from '../strings';

/** Home Assistant's own range for a light that reports none. */
export const DEFAULT_MIN_KELVIN = 2000;
export const DEFAULT_MAX_KELVIN = 6535;
/** How far from a white preset a reported temperature still counts as that preset. */
const KELVIN_TOLERANCE = 150;
/** Hue and saturation, in any of the forms Home Assistant knows. */
const COLOR_MODES: ReadonlySet<string> = new Set(['hs', 'xy', 'rgb', 'rgbw', 'rgbww']);

/** What a light can do beyond brightness, from its `supported_color_modes`. */
export interface LightCaps {
  color: boolean;
  temp: boolean;
  /** A separate white channel (`white` mode). */
  white: boolean;
}

export type PresetId = keyof typeof PRESET_WORDS;

export interface ColorPreset {
  id: PresetId;
  /** CSS colour of the round swatch on the button. */
  swatch: string;
  /** For a white: the temperature asked of a light that has one. */
  kelvin?: number;
  /** Hue (0 to 360) and saturation (0 to 100); for a white, the stand-in on a light with no temperature. */
  hs?: readonly [number, number];
}

/** The colour of a lit tile icon, with the ink that stays readable on it. */
export interface TileColor {
  fill: string;
  ink: string;
}

// The hs of each white is Home Assistant's own conversion of 2700, 4000 and 6500 K, rounded.
const WHITES: readonly ColorPreset[] = [
  { id: 'warm', swatch: '#ffc98a', kelvin: 2700, hs: [29, 66] },
  { id: 'neutral', swatch: '#fff0dc', kelvin: 4000, hs: [27, 35] },
  { id: 'cool', swatch: '#e9f0ff', kelvin: 6500, hs: [48, 2] },
];
const WHITE_CHANNEL: ColorPreset = { id: 'white', swatch: '#f5f5f0' };
const COLORS: readonly ColorPreset[] = [
  { id: 'amber', swatch: '#ffb02e', hs: [36, 100] },
  { id: 'red', swatch: '#ff3b30', hs: [0, 100] },
  { id: 'pink', swatch: '#ff6fae', hs: [330, 60] },
  { id: 'purple', swatch: '#9d4dff', hs: [275, 85] },
  { id: 'blue', swatch: '#2f6bff', hs: [225, 100] },
  { id: 'green', swatch: '#34c759', hs: [120, 90] },
];

const INK_DARK = '#2a2620';
const INK_LIGHT = '#ffffff';

function modes(state: HassEntityState | undefined): string[] {
  const m = state?.attributes.supported_color_modes;
  return Array.isArray(m) ? m.filter((x): x is string => typeof x === 'string') : [];
}

export function lightCaps(state: HassEntityState | undefined): LightCaps {
  const list = modes(state);
  return { color: list.some((m) => COLOR_MODES.has(m)), temp: list.includes('color_temp'), white: list.includes('white') };
}

export function kelvinRange(state: HassEntityState | undefined): readonly [number, number] {
  const min = state?.attributes.min_color_temp_kelvin;
  const max = state?.attributes.max_color_temp_kelvin;
  const lo = typeof min === 'number' && Number.isFinite(min) && min > 0 ? Math.round(min) : DEFAULT_MIN_KELVIN;
  const hi = typeof max === 'number' && Number.isFinite(max) && max > lo ? Math.round(max) : Math.max(lo, DEFAULT_MAX_KELVIN);
  return [lo, hi];
}

export function clampKelvin(kelvin: number, [lo, hi]: readonly [number, number]): number {
  return Math.min(hi, Math.max(lo, Math.round(kelvin)));
}

/**
 * The buttons a light gets. The three whites need a colour temperature, or a colour light without a
 * white channel (there they become hue and saturation). A colour light with a white channel and no
 * temperature gets one "Branco", because the three whites would all send the same `white: true`.
 * For the same reason a narrow bulb (2200 to 4000 K) loses the whites its range folds onto another.
 */
export function presetsFor(
  caps: LightCaps,
  range: readonly [number, number] = [DEFAULT_MIN_KELVIN, DEFAULT_MAX_KELVIN],
): readonly ColorPreset[] {
  const whites = caps.temp ? distinctWhites(range) : caps.color && !caps.white ? WHITES : caps.color ? [WHITE_CHANNEL] : [];
  return [...whites, ...(caps.color ? COLORS : [])];
}

/** The whites that stay apart once clamped to the range of the light. */
function distinctWhites(range: readonly [number, number]): readonly ColorPreset[] {
  const kelvin = (p: ColorPreset): number => clampKelvin(p.kelvin ?? 0, range);
  /** How far the light moves a white from its own temperature: 0 when it can show it as is. */
  const off = (p: ColorPreset): number => Math.abs((p.kelvin ?? 0) - kelvin(p));
  // Of the whites that land on the same temperature, keep the one whose name tells the truth
  // ("Neutro" at 4000 K on a 4000-6500 K strip, not "Quente"); on a tie, the first.
  return WHITES.filter((p, i) =>
    WHITES.every((q, j) => q === p || Math.abs(kelvin(q) - kelvin(p)) > KELVIN_TOLERANCE || off(p) < off(q) || (off(p) === off(q) && i < j)),
  );
}

/** The `light.turn_on` data for a preset. Turning on with a colour also turns an off light on. */
export function presetRequest(
  preset: ColorPreset,
  caps: LightCaps,
  range: readonly [number, number],
): Record<string, unknown> {
  if (preset.id === 'white') return { white: true };
  if (preset.kelvin !== undefined && caps.temp) return { color_temp_kelvin: clampKelvin(preset.kelvin, range) };
  return { hs_color: [...(preset.hs ?? [0, 0])] };
}

export function setLightColor(hass: HomeAssistant, entityId: string, data: Record<string, unknown>): Promise<unknown> {
  return hass.callService('light', 'turn_on', data, { entity_id: entityId });
}

function isPair(v: unknown): v is [number, number] {
  return Array.isArray(v) && v.length >= 2 && typeof v[0] === 'number' && typeof v[1] === 'number';
}

function close(a: readonly [number, number], b: readonly [number, number]): boolean {
  const dh = Math.abs(a[0] - b[0]) % 360;
  const hue = Math.min(dh, 360 - dh);
  // Near white the hue means nothing, so only the saturation is compared.
  return Math.abs(a[1] - b[1]) <= 12 && (Math.min(a[1], b[1]) < 15 || hue <= 10);
}

/** The preset the light shows right now, if any. */
export function currentPreset(
  state: HassEntityState | undefined,
  presets: readonly ColorPreset[],
  range: readonly [number, number],
): PresetId | null {
  if (state?.state !== 'on') return null;
  const mode = state.attributes.color_mode;
  if (mode === 'white') return presets.find((p) => p.id === 'white')?.id ?? null;
  if (mode === 'color_temp') {
    const k = state.attributes.color_temp_kelvin;
    if (typeof k !== 'number') return null;
    return presets.find((p) => p.kelvin !== undefined && Math.abs(clampKelvin(p.kelvin, range) - k) <= KELVIN_TOLERANCE)?.id ?? null;
  }
  const hs = state.attributes.hs_color;
  if (typeof mode === 'string' && COLOR_MODES.has(mode) && isPair(hs)) {
    return presets.find((p) => p.hs !== undefined && close(p.hs, hs))?.id ?? null;
  }
  return null;
}

function luminance(r: number, g: number, b: number): number {
  const lin = (v: number): number => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

const INK_DARK_LUMINANCE = luminance(0x2a, 0x26, 0x20);

/** The colour of a light that is on in a colour mode, for its tile icon; null for whites and when off. */
export function tileColor(state: HassEntityState | undefined): TileColor | null {
  if (state?.state !== 'on') return null;
  const mode = state.attributes.color_mode;
  // In color_temp mode Home Assistant fills rgb_color too; a white light keeps the amber look.
  if (typeof mode !== 'string' || !COLOR_MODES.has(mode)) return null;
  // So does a white asked as hue and saturation of a colour-only light, and any near-white tint.
  const hs = state.attributes.hs_color;
  if (isPair(hs) && (hs[1] < 15 || WHITES.some((w) => w.hs !== undefined && close(w.hs, hs)))) return null;
  const rgb = state.attributes.rgb_color;
  if (!Array.isArray(rgb) || rgb.length < 3) return null;
  const channels = rgb.slice(0, 3);
  if (!channels.every((v): v is number => typeof v === 'number' && Number.isFinite(v))) return null;
  const [r, g, b] = channels.map((v) => Math.min(255, Math.max(0, Math.round(v)))) as [number, number, number];
  const l = luminance(r, g, b);
  const onWhite = 1.05 / (l + 0.05);
  const onDark = (l + 0.05) / (INK_DARK_LUMINANCE + 0.05);
  return { fill: `rgb(${r}, ${g}, ${b})`, ink: onDark >= onWhite ? INK_DARK : INK_LIGHT };
}
