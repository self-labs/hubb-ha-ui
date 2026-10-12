import { describe, expect, it } from 'vitest';
import {
  clampKelvin,
  currentPreset,
  DEFAULT_MAX_KELVIN,
  DEFAULT_MIN_KELVIN,
  kelvinRange,
  lightCaps,
  presetRequest,
  presetsFor,
  tileColor,
  type LightCaps,
} from '../../src/actions/color';
import type { HassEntityState } from '../../src/ha/types';

const st = (attributes: Record<string, unknown>, state = 'on'): HassEntityState => ({ entity_id: 'light.x', state, attributes });
const ids = (caps: LightCaps) => presetsFor(caps).map((p) => p.id);
const FULL: LightCaps = { color: true, temp: true, white: false };
const TEMP: LightCaps = { color: false, temp: true, white: false };
const RGB: LightCaps = { color: true, temp: false, white: false };
const RGB_WHITE: LightCaps = { color: true, temp: false, white: true };

describe('lightCaps', () => {
  it('reads colour, temperature and white channel from the supported modes', () => {
    expect(lightCaps(st({ supported_color_modes: ['color_temp', 'hs'] }))).toEqual(FULL);
    expect(lightCaps(st({ supported_color_modes: ['hs', 'white'] }))).toEqual(RGB_WHITE);
    expect(lightCaps(st({ supported_color_modes: ['xy'] }))).toEqual(RGB);
    expect(lightCaps(st({ supported_color_modes: ['brightness'] }))).toEqual({ color: false, temp: false, white: false });
  });

  it('treats a light with no usable modes as on and off only', () => {
    expect(lightCaps(undefined)).toEqual({ color: false, temp: false, white: false });
    expect(lightCaps(st({}))).toEqual({ color: false, temp: false, white: false });
    expect(lightCaps(st({ supported_color_modes: 'hs' }))).toEqual({ color: false, temp: false, white: false });
  });
});

describe('presetsFor', () => {
  it('gives a colour light with temperature the 9 buttons', () => {
    expect(ids(FULL)).toEqual(['warm', 'neutral', 'cool', 'amber', 'red', 'pink', 'purple', 'blue', 'green']);
  });

  it('gives a temperature-only light the three whites', () => {
    expect(ids(TEMP)).toEqual(['warm', 'neutral', 'cool']);
  });

  it('gives a colour light with a white channel and no temperature one Branco instead of three', () => {
    expect(ids(RGB_WHITE)).toEqual(['white', 'amber', 'red', 'pink', 'purple', 'blue', 'green']);
  });

  it('keeps the three whites on a colour light with neither, as hue and saturation', () => {
    expect(ids(RGB)).toHaveLength(9);
  });

  it('keeps the white whose own temperature the light can really show', () => {
    expect(presetsFor(TEMP, [4000, 6500]).map((p) => p.id)).toEqual(['neutral', 'cool']);
  });

  it('drops a white that the range of the light makes the same as another', () => {
    expect(presetsFor(TEMP, [2202, 4000]).map((p) => p.id)).toEqual(['warm', 'neutral']);
    expect(presetsFor(FULL, [2700, 2700]).map((p) => p.id)).toEqual(['warm', 'amber', 'red', 'pink', 'purple', 'blue', 'green']);
  });

  it('gives a light that only dims nothing', () => {
    expect(ids({ color: false, temp: false, white: false })).toEqual([]);
  });
});

describe('kelvinRange and presetRequest', () => {
  it('uses the range the light reports, else Home Assistant defaults', () => {
    expect(kelvinRange(st({ min_color_temp_kelvin: 2702, max_color_temp_kelvin: 6000 }))).toEqual([2702, 6000]);
    expect(kelvinRange(st({}))).toEqual([DEFAULT_MIN_KELVIN, DEFAULT_MAX_KELVIN]);
    expect(kelvinRange(st({ min_color_temp_kelvin: 'x', max_color_temp_kelvin: 1000 }))).toEqual([2000, 6535]);
  });

  it('asks a temperature light for kelvin, kept inside its range', () => {
    const [warm, , cool] = presetsFor(TEMP);
    expect(presetRequest(warm!, TEMP, [2702, 6000])).toEqual({ color_temp_kelvin: 2702 });
    expect(presetRequest(cool!, TEMP, [2702, 6000])).toEqual({ color_temp_kelvin: 6000 });
    expect(clampKelvin(4321.6, [2000, 6535])).toBe(4322);
  });

  it('asks a colour light for hue and saturation, and a white channel for white mode', () => {
    const p = presetsFor(RGB);
    expect(presetRequest(p.find((x) => x.id === 'warm')!, RGB, [2000, 6535])).toEqual({ hs_color: [29, 66] });
    expect(presetRequest(p.find((x) => x.id === 'red')!, RGB, [2000, 6535])).toEqual({ hs_color: [0, 100] });
    expect(presetRequest(presetsFor(RGB_WHITE)[0]!, RGB_WHITE, [2000, 6535])).toEqual({ white: true });
  });
});

describe('currentPreset', () => {
  const all = presetsFor(FULL);
  const range = [2000, 6535] as const;

  it('recognises a white by its temperature, even when clamped by the light', () => {
    expect(currentPreset(st({ color_mode: 'color_temp', color_temp_kelvin: 2710 }), all, range)).toBe('warm');
    expect(currentPreset(st({ color_mode: 'color_temp', color_temp_kelvin: 6000 }), all, [2000, 6000])).toBe('cool');
    expect(currentPreset(st({ color_mode: 'color_temp', color_temp_kelvin: 3300 }), all, range)).toBeNull();
  });

  it('recognises a colour by hue and saturation, across 0 degrees', () => {
    expect(currentPreset(st({ color_mode: 'hs', hs_color: [358, 97] }), all, range)).toBe('red');
    expect(currentPreset(st({ color_mode: 'xy', hs_color: [224, 99] }), all, range)).toBe('blue');
    expect(currentPreset(st({ color_mode: 'hs', hs_color: [180, 100] }), all, range)).toBeNull();
  });

  it('recognises white mode, and nothing while the light is off', () => {
    expect(currentPreset(st({ color_mode: 'white' }), presetsFor(RGB_WHITE), range)).toBe('white');
    expect(currentPreset(st({ color_mode: 'hs', hs_color: [0, 100] }, 'off'), all, range)).toBeNull();
  });
});

describe('tileColor', () => {
  it('paints the tile with the colour of a light in a colour mode, with readable ink', () => {
    expect(tileColor(st({ color_mode: 'hs', rgb_color: [255, 0, 0] }))).toEqual({ fill: 'rgb(255, 0, 0)', ink: '#ffffff' });
    expect(tileColor(st({ color_mode: 'rgb', rgb_color: [0, 255, 0] }))).toEqual({ fill: 'rgb(0, 255, 0)', ink: '#2a2620' });
    expect(tileColor(st({ color_mode: 'xy', rgb_color: [0, 0, 255] }))!.ink).toBe('#ffffff');
  });

  it('keeps the amber look for whites, even though Home Assistant also fills rgb_color for them', () => {
    expect(tileColor(st({ color_mode: 'color_temp', color_temp_kelvin: 2700, rgb_color: [255, 167, 87] }))).toBeNull();
    expect(tileColor(st({ color_mode: 'white', rgb_color: [255, 255, 255] }))).toBeNull();
    expect(tileColor(st({ color_mode: 'brightness' }))).toBeNull();
  });

  it('keeps the amber look for a white asked as hue and saturation of a colour-only light', () => {
    expect(tileColor(st({ color_mode: 'hs', hs_color: [29.4, 65.8], rgb_color: [255, 167, 87] }))).toBeNull();
    expect(tileColor(st({ color_mode: 'hs', hs_color: [48, 2], rgb_color: [255, 254, 250] }))).toBeNull();
    expect(tileColor(st({ color_mode: 'hs', hs_color: [36, 100], rgb_color: [255, 153, 0] }))!.fill).toBe('rgb(255, 153, 0)');
  });

  it('shows nothing for a light that is off or reports a broken colour', () => {
    expect(tileColor(st({ color_mode: 'hs', rgb_color: [255, 0, 0] }, 'off'))).toBeNull();
    expect(tileColor(st({ color_mode: 'hs', rgb_color: [255, 'x', 0] }))).toBeNull();
    expect(tileColor(st({ color_mode: 'hs' }))).toBeNull();
  });
});
