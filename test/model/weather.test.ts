import { mdiAlertCircleOutline, mdiWeatherPartlyCloudy, mdiWeatherSunny } from '@mdi/js';
import { describe, expect, it } from 'vitest';
import { forecastTypes, nextHours, todayRange, weatherEntity, weatherIcon } from '../../src/model/weather';
import { makeHass } from '../helpers/fake-hass';

// Local times, so the hours read the same in any time zone (CI runs in UTC).
const at = (h: number, day = 21) => new Date(2026, 9, day, h, 0).toISOString();
const NOW = new Date(2026, 9, 21, 14, 32).getTime();

describe('the weather of the wide home and of the rest screen', () => {
  it('draws the conditions of Home Assistant', () => {
    expect(weatherIcon('partlycloudy')).toBe(mdiWeatherPartlyCloudy);
    expect(weatherIcon('sunny')).toBe(mdiWeatherSunny);
    expect(weatherIcon('exceptional')).toBe(mdiAlertCircleOutline);
    expect(weatherIcon(undefined)).toBe(mdiAlertCircleOutline);
  });

  it('the next four hours, from the one after now', () => {
    const hourly = [13, 14, 15, 16, 17, 18, 19].map((h) => ({ datetime: at(h), temperature: 20 + h - 13, condition: 'sunny' }));
    expect(nextHours(hourly, NOW)).toEqual([
      { hour: 15, temp: 22, condition: 'sunny' },
      { hour: 16, temp: 23, condition: 'sunny' },
      { hour: 17, temp: 24, condition: 'sunny' },
      { hour: 18, temp: 25, condition: 'sunny' },
    ]);
  });

  it('the high and the low of today, from the daily forecast or else from the next 24 hours', () => {
    expect(todayRange([{ datetime: at(9), temperature: 31, templow: 19 }], [], NOW)).toEqual({ max: 31, min: 19 });
    // The daily forecast already starts tomorrow (late in the day): the hours give the range.
    const hourly = [15, 18, 21].map((h, i) => ({ datetime: at(h), temperature: [29, 25, 22][i] }));
    expect(todayRange([{ datetime: at(9, 22), temperature: 30, templow: 18 }], hourly, NOW)).toEqual({ max: 29, min: 22 });
    expect(todayRange([], [], NOW)).toBeNull();
  });

  it('asks only for the forecasts the entity has', () => {
    const daily = makeHass({ entities: [{ entity_id: 'weather.casa', state: 'sunny', attributes: { supported_features: 1 } }] });
    expect(forecastTypes(daily.states['weather.casa'])).toEqual(['daily']);
    const both = makeHass({ entities: [{ entity_id: 'weather.casa', state: 'sunny', attributes: { supported_features: 3 } }] });
    expect(forecastTypes(both.states['weather.casa'])).toEqual(['daily', 'hourly']);
  });

  it('the weather of the house: the first weather entity with a state', () => {
    const h = makeHass({ entities: [{ entity_id: 'weather.b', state: 'sunny' }, { entity_id: 'weather.a' }, { entity_id: 'light.x', state: 'on' }] });
    expect(weatherEntity(h)).toBe('weather.b');
  });
});
