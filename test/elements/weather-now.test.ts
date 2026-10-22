import { afterEach, describe, expect, it, vi } from 'vitest';
import '../../src/elements/weather-now';
import type { ForecastItem } from '../../src/model/weather';
import { makeHass } from '../helpers/fake-hass';

function hass(features: number) {
  const h = makeHass({ entities: [{ entity_id: 'weather.casa', state: 'sunny', attributes: { temperature: 27.6, supported_features: features } }] });
  const pushes: Record<string, (msg: { forecast: ForecastItem[] }) => void> = {};
  h.connection = {
    subscribeMessage: vi.fn(async (cb: (msg: { forecast: ForecastItem[] }) => void, msg: Record<string, unknown>) => {
      pushes[String(msg.forecast_type)] = cb;
      return () => undefined;
    }),
  } as unknown as NonNullable<typeof h.connection>;
  return { h, pushes };
}

async function mount(features: number, show: 'now' | 'hours') {
  const { h, pushes } = hass(features);
  const el = document.createElement('hubb-weather-now') as HTMLElement & { hass: unknown; entityId: string; show: string; updateComplete: Promise<unknown> };
  el.hass = h;
  el.entityId = 'weather.casa';
  el.show = show;
  document.body.appendChild(el);
  await el.updateComplete;
  return { el, pushes };
}

describe('the weather now', () => {
  afterEach(() => {
    vi.useRealTimers();
    document.body.replaceChildren();
  });

  it('shows the temperature now and, from the daily forecast, the high and the low', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 21, 14, 32));
    const { el, pushes } = await mount(1, 'now');
    expect(el.shadowRoot!.querySelector('.now')!.textContent!.trim()).toBe('28°');
    pushes.daily!({ forecast: [{ datetime: new Date(2026, 9, 21, 9).toISOString(), temperature: 31, templow: 19 }] });
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.range')!.textContent!.trim()).toBe('Máx 31° · Mín 19°');
    // The hours are a part of their own.
    expect(el.shadowRoot!.querySelector('.hours')).toBeNull();
  });

  it('with an hourly forecast, the next four hours', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 21, 14, 32));
    const { el, pushes } = await mount(3, 'hours');
    pushes.hourly!({ forecast: [15, 16, 17, 18, 19].map((h) => ({ datetime: new Date(2026, 9, 21, h).toISOString(), temperature: 29, condition: 'sunny' })) });
    await el.updateComplete;
    expect([...el.shadowRoot!.querySelectorAll('.hours .h')].map((n) => n.textContent!.replace(/\s+/g, ' ').trim())).toEqual([
      '15h 29°',
      '16h 29°',
      '17h 29°',
      '18h 29°',
    ]);
    // Only the hours: the temperature now is the other part, beside the clock.
    expect(el.shadowRoot!.querySelector('.now')).toBeNull();
  });

  it('asked for the hours of an entity with no hourly forecast, draws nothing', async () => {
    const { el } = await mount(1, 'hours');
    expect(el.shadowRoot!.querySelector('.hours, .now')).toBeNull();
  });
});
