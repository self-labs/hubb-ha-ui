import type { HomeAssistant } from '../ha/types';

const fmt = (n: number, digits: number): string => n.toLocaleString('pt-BR', { maximumFractionDigits: digits });

/** "120 W", "1,5 kW" from a power sensor in W or kW; null when it reads nothing. */
export function watts(hass: HomeAssistant, entityId: string | null | undefined): string | null {
  const st = entityId ? hass.states[entityId] : undefined;
  const v = Number(st?.state);
  if (!st || st.state === '' || !Number.isFinite(v)) return null;
  const w = st.attributes.unit_of_measurement === 'kW' ? v * 1000 : v;
  return w >= 1000 ? `${fmt(w / 1000, 1)} kW` : `${fmt(w, 0)} W`;
}

/** "1,2 kWh". */
export const kwh = (n: number): string => `${fmt(n, 1)} kWh`;

/**
 * kWh used today, from the long-term statistics of an energy sensor; null when there are none or the
 * call is refused. `recorder/statistic_during_period` takes no administrator (HA 2026.10).
 */
export async function todayKwh(hass: HomeAssistant, energyId: string): Promise<number | null> {
  if (!hass.callWS) return null;
  try {
    const r = await hass.callWS<{ change?: number | null }>({
      type: 'recorder/statistic_during_period',
      statistic_id: energyId,
      calendar: { period: 'day' },
      types: ['change'],
      units: { energy: 'kWh' },
    });
    return typeof r?.change === 'number' && Number.isFinite(r.change) ? r.change : null;
  } catch {
    return null;
  }
}
