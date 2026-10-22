import { describe, expect, it, vi } from 'vitest';
import { subscribeForecast } from '../../src/actions/forecast';
import type { ForecastItem } from '../../src/model/weather';
import { makeHass } from '../helpers/fake-hass';

function withConnection() {
  const h = makeHass();
  const unsub = vi.fn();
  let push: ((msg: { forecast: ForecastItem[] }) => void) | null = null;
  const subscribeMessage = vi.fn(async (cb: (msg: { forecast: ForecastItem[] }) => void, _msg: Record<string, unknown>) => {
    push = cb;
    return unsub;
  });
  h.connection = { subscribeMessage } as unknown as NonNullable<typeof h.connection>;
  return { h, unsub, subscribeMessage, push: (items: ForecastItem[]) => push?.({ forecast: items }) };
}

describe('one forecast subscription for every screen', () => {
  it('two screens share one subscription, which ends when the last one leaves', async () => {
    const { h, unsub, subscribeMessage, push } = withConnection();
    const a = vi.fn();
    const b = vi.fn();
    const offA = subscribeForecast(h, 'weather.casa', 'hourly', a);
    const offB = subscribeForecast(h, 'weather.casa', 'hourly', b);
    expect(subscribeMessage).toHaveBeenCalledTimes(1);
    expect(subscribeMessage.mock.calls[0]![1]).toEqual({ type: 'weather/subscribe_forecast', forecast_type: 'hourly', entity_id: 'weather.casa' });
    await Promise.resolve();
    push([{ datetime: '2026-10-21T15:00:00Z', temperature: 29 }]);
    expect(a).toHaveBeenCalledWith([{ datetime: '2026-10-21T15:00:00Z', temperature: 29 }]);
    expect(b).toHaveBeenCalledTimes(1);
    offA();
    await Promise.resolve();
    expect(unsub).not.toHaveBeenCalled();
    offB();
    await Promise.resolve();
    expect(unsub).toHaveBeenCalledTimes(1);
  });

  it('with no connection (a dashboard preview), nothing happens', () => {
    const h = makeHass();
    const off = subscribeForecast(h, 'weather.casa', 'daily', vi.fn());
    expect(() => off()).not.toThrow();
  });
});
