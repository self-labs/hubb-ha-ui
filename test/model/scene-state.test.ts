import { describe, expect, it } from 'vitest';
import { sceneIsOn } from '../../src/model/scene-state';
import { makeHass } from '../helpers/fake-hass';

// A scene's button lights up while the light or switch it follows is on (spec Cenas no cômodo, 07/11).
describe('sceneIsOn', () => {
  const hass = makeHass({
    entities: [
      { entity_id: 'light.on', state: 'on' },
      { entity_id: 'light.off', state: 'off' },
      { entity_id: 'switch.gone', state: 'unavailable' },
      { entity_id: 'switch.unknown', state: 'unknown' },
    ],
  });

  it('is on only while the followed entity is on', () => {
    expect(sceneIsOn(hass, { follows: 'light.on' })).toBe(true);
    expect(sceneIsOn(hass, { follows: 'light.off' })).toBe(false);
  });

  it('is off when the followed entity is unavailable, unknown or missing', () => {
    expect(sceneIsOn(hass, { follows: 'switch.gone' })).toBe(false);
    expect(sceneIsOn(hass, { follows: 'switch.unknown' })).toBe(false);
    expect(sceneIsOn(hass, { follows: 'light.deleted' })).toBe(false);
  });

  it('is off with nothing to follow, a frozen dashboard included', () => {
    expect(sceneIsOn(hass, { follows: null })).toBe(false);
    expect(sceneIsOn(hass, {})).toBe(false);
  });
});
