import { describe, expect, it } from 'vitest';
import { brightnessPct, runScene, setLight } from '../../src/actions/light';
import { makeHass } from '../helpers/fake-hass';

describe('light actions', () => {
  it('turns lights off and on, with or without a brightness', async () => {
    const hass = makeHass();
    await setLight(hass, 'light.a', false);
    await setLight(hass, ['light.a', 'light.b'], true);
    await setLight(hass, 'light.a', true, 75);
    expect(hass.calls).toEqual([
      { domain: 'light', service: 'turn_off', data: undefined, target: { entity_id: 'light.a' } },
      { domain: 'light', service: 'turn_on', data: undefined, target: { entity_id: ['light.a', 'light.b'] } },
      { domain: 'light', service: 'turn_on', data: { brightness_pct: 75 }, target: { entity_id: 'light.a' } },
    ]);
  });

  it('reads the brightness percentage only from a light that is on', () => {
    expect(brightnessPct({ entity_id: 'light.a', state: 'on', attributes: { brightness: 191 } })).toBe(75);
    expect(brightnessPct({ entity_id: 'light.a', state: 'off', attributes: { brightness: 191 } })).toBeNull();
    expect(brightnessPct({ entity_id: 'light.a', state: 'on', attributes: {} })).toBeNull();
    expect(brightnessPct(undefined)).toBeNull();
  });

  it('runs a scene or a script through its own domain', async () => {
    const hass = makeHass();
    await runScene(hass, 'scene.cinema');
    await runScene(hass, 'script.chegar');
    expect(hass.calls.map((c) => `${c.domain}.${c.service}`)).toEqual(['scene.turn_on', 'script.turn_on']);
  });
});
