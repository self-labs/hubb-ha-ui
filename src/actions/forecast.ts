import type { HomeAssistant } from '../ha/types';
import type { ForecastItem } from '../model/weather';

type Listener = (items: ForecastItem[]) => void;

interface Subscription {
  listeners: Set<Listener>;
  items: ForecastItem[] | null;
  /** The way to end it, once Home Assistant answered; null when there is no connection. */
  unsub: Promise<(() => void) | null> | null;
  /** The next try after a refusal. */
  retry: ReturnType<typeof setTimeout> | null;
}

/** How long to wait before asking again for a forecast Home Assistant refused. */
const RETRY_MS = 30_000;

function connect(hass: HomeAssistant, entityId: string, type: 'daily' | 'hourly', key: string, sub: Subscription): void {
  sub.unsub =
    hass.connection
      ?.subscribeMessage<{ forecast?: ForecastItem[] | null }>(
        (msg) => {
          sub.items = msg.forecast ?? [];
          sub.listeners.forEach((fn) => fn(sub.items!));
        },
        { type: 'weather/subscribe_forecast', forecast_type: type, entity_id: entityId },
      )
      .catch(() => {
        // Refused (the weather is not ready yet after a restart): asked again while someone listens.
        sub.retry = setTimeout(() => {
          sub.retry = null;
          if (subs.get(key) === sub && sub.listeners.size) connect(hass, entityId, type, key, sub);
        }, RETRY_MS);
        return null;
      }) ?? null;
}

/** One subscription to Home Assistant per entity and kind of forecast, whatever number of screens listen. */
const subs = new Map<string, Subscription>();

/**
 * Listens to the forecast of a weather entity (`weather/subscribe_forecast`, open to every user). The
 * newest forecast reaches a listener that joins late at once. Returns the way to stop listening; the
 * subscription ends with its last listener.
 */
export function subscribeForecast(hass: HomeAssistant, entityId: string, type: 'daily' | 'hourly', cb: Listener): () => void {
  const key = `${entityId}|${type}`;
  let sub = subs.get(key);
  if (!sub) {
    const fresh: Subscription = { listeners: new Set(), items: null, unsub: null, retry: null };
    sub = fresh;
    subs.set(key, fresh);
    connect(hass, entityId, type, key, fresh);
  } else if (sub.items) cb(sub.items);
  sub.listeners.add(cb);
  const mine = sub;
  return () => {
    mine.listeners.delete(cb);
    if (mine.listeners.size || subs.get(key) !== mine) return;
    subs.delete(key);
    if (mine.retry) clearTimeout(mine.retry);
    void mine.unsub?.then((u) => u?.());
  };
}
