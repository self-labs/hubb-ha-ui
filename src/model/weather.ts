import {
  mdiAlertCircleOutline,
  mdiWeatherCloudy,
  mdiWeatherFog,
  mdiWeatherHail,
  mdiWeatherLightning,
  mdiWeatherLightningRainy,
  mdiWeatherNight,
  mdiWeatherPartlyCloudy,
  mdiWeatherPouring,
  mdiWeatherRainy,
  mdiWeatherSnowy,
  mdiWeatherSnowyRainy,
  mdiWeatherSunny,
  mdiWeatherWindy,
  mdiWeatherWindyVariant,
} from '@mdi/js';
import type { HassEntityState, HomeAssistant } from '../ha/types';

/** One step of a forecast of Home Assistant (`weather/subscribe_forecast`). */
export interface ForecastItem {
  datetime: string;
  temperature?: number;
  templow?: number;
  condition?: string;
}

/** The forecasts a weather entity offers, by its `supported_features` (daily 1, hourly 2). */
export const FORECAST_FEATURE = { daily: 1, hourly: 2 } as const;

const ICONS: Readonly<Record<string, string>> = {
  'clear-night': mdiWeatherNight,
  cloudy: mdiWeatherCloudy,
  fog: mdiWeatherFog,
  hail: mdiWeatherHail,
  lightning: mdiWeatherLightning,
  'lightning-rainy': mdiWeatherLightningRainy,
  partlycloudy: mdiWeatherPartlyCloudy,
  pouring: mdiWeatherPouring,
  rainy: mdiWeatherRainy,
  snowy: mdiWeatherSnowy,
  'snowy-rainy': mdiWeatherSnowyRainy,
  sunny: mdiWeatherSunny,
  windy: mdiWeatherWindy,
  'windy-variant': mdiWeatherWindyVariant,
};

/** The drawing of a condition of Home Assistant; "exceptional" or none, a warning sign. */
export function weatherIcon(condition: string | undefined): string {
  return (condition && ICONS[condition]) || mdiAlertCircleOutline;
}

/** The weather of the house: the first weather entity (by id) that has a state. */
export function weatherEntity(hass: HomeAssistant): string | null {
  return Object.keys(hass.entities).sort().find((id) => id.startsWith('weather.') && hass.states[id]) ?? null;
}

/** The forecasts worth asking for: only the ones the entity says it has. */
export function forecastTypes(st: HassEntityState | undefined): ('daily' | 'hourly')[] {
  const f = Number(st?.attributes.supported_features ?? 0);
  return [...((f & FORECAST_FEATURE.daily) !== 0 ? (['daily'] as const) : []), ...((f & FORECAST_FEATURE.hourly) !== 0 ? (['hourly'] as const) : [])];
}

/** The next `n` hours after now, each with its hour of the day, temperature and condition. */
export function nextHours(hourly: readonly ForecastItem[], now: number, n = 4): { hour: number; temp: number; condition: string }[] {
  return hourly
    .filter((i) => typeof i.temperature === 'number' && Date.parse(i.datetime) > now)
    .slice(0, n)
    .map((i) => ({ hour: new Date(i.datetime).getHours(), temp: Math.round(i.temperature!), condition: i.condition ?? '' }));
}

const sameDay = (a: Date, b: Date): boolean => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/**
 * The high and the low of today: the daily forecast of today, or, when it already starts tomorrow (late
 * in the day, some integrations), the extremes of the next 24 hours.
 */
export function todayRange(daily: readonly ForecastItem[], hourly: readonly ForecastItem[], now: number): { max: number; min: number } | null {
  const today = daily.find((d) => sameDay(new Date(d.datetime), new Date(now)));
  if (today && typeof today.temperature === 'number' && typeof today.templow === 'number') {
    return { max: Math.round(today.temperature), min: Math.round(today.templow) };
  }
  const day = hourly.filter((i) => typeof i.temperature === 'number' && Date.parse(i.datetime) >= now && Date.parse(i.datetime) < now + 24 * 3_600_000);
  if (!day.length) return null;
  const temps = day.map((i) => i.temperature!);
  return { max: Math.round(Math.max(...temps)), min: Math.round(Math.min(...temps)) };
}
