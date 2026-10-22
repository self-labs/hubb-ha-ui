import { LitElement, css, html, nothing, type PropertyValues } from 'lit';
import { subscribeForecast } from '../actions/forecast';
import type { HomeAssistant } from '../ha/types';
import { forecastTypes, nextHours, todayRange, weatherIcon, type ForecastItem } from '../model/weather';
import { WEATHER } from '../strings';
import { define } from './define';
import { icon } from './icon';

/**
 * The weather of the house, in one of two parts: `now`, the condition and the temperature with the
 * high and the low of today; `hours`, the next four hours (when the entity has an hourly forecast),
 * spread over the width it is given. The clock card of the wide home draws both, the hours on a row
 * of their own: side by side they were wider than the column of an iPad Mini.
 */
export class HubbWeatherNow extends LitElement {
  static properties = {
    hass: { attribute: false },
    entityId: { attribute: false },
    show: { reflect: true },
    daily: { state: true },
    hourly: { state: true },
  };

  declare hass: HomeAssistant | undefined;
  declare entityId: string | null;
  declare show: 'now' | 'hours';
  declare daily: ForecastItem[];
  declare hourly: ForecastItem[];

  #offs: (() => void)[] = [];
  #subscribedTo: string | null = null;

  constructor() {
    super();
    this.hass = undefined;
    this.entityId = null;
    this.show = 'now';
    this.daily = [];
    this.hourly = [];
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#unsubscribe();
  }

  #unsubscribe(): void {
    this.#offs.forEach((off) => off());
    this.#offs = [];
    this.#subscribedTo = null;
  }

  protected updated(changed: PropertyValues<this>): void {
    super.updated(changed);
    const hass = this.hass;
    if (!hass || !this.entityId || this.#subscribedTo === this.entityId) return;
    this.#unsubscribe();
    this.#subscribedTo = this.entityId;
    const wanted = forecastTypes(hass.states[this.entityId]).filter((t) => this.show === 'now' || t === 'hourly');
    for (const type of wanted) {
      this.#offs.push(subscribeForecast(hass, this.entityId, type, (items) => (type === 'daily' ? (this.daily = items) : (this.hourly = items))));
    }
  }

  render() {
    const st = this.entityId ? this.hass?.states[this.entityId] : undefined;
    if (!st) return nothing;
    const t = st.attributes.temperature;
    const now = Date.now();
    if (this.show === 'hours') {
      const hours = forecastTypes(st).includes('hourly') ? nextHours(this.hourly, now) : [];
      return hours.length
        ? html`<div class="hours">${hours.map((h) => html`<span class="h"><span>${h.hour}h</span> <b>${h.temp}°</b></span>`)}</div>`
        : nothing;
    }
    const range = todayRange(this.daily, this.hourly, now);
    return html`<div class="current">${icon(weatherIcon(st.state))}<span class="now">${typeof t === 'number' ? `${Math.round(t)}°` : ''}</span></div>
      ${range ? html`<div class="range">${WEATHER.range(range.max, range.min)}</div>` : nothing}`;
  }

  static styles = css`
    :host {
      display: grid;
      justify-items: end;
      gap: 4px;
      font-family: var(--hubb-font);
      color: var(--hubb-text);
    }
    .current {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .current svg {
      width: 32px;
      height: 32px;
      fill: var(--hubb-amber);
    }
    .now {
      font-size: 28px;
      font-weight: 700;
    }
    .range {
      white-space: nowrap;
      font-size: 12px;
      color: var(--hubb-text-2);
    }
    :host([show='hours']) {
      display: block;
    }
    .hours {
      display: flex;
      justify-content: space-between;
      gap: 6px;
    }
    .h {
      display: grid;
      justify-items: center;
      min-width: 38px;
      font-size: 11px;
      color: var(--hubb-text-2);
    }
    .h b {
      font-size: 12px;
      color: var(--hubb-text);
    }
  `;
}

define('hubb-weather-now', HubbWeatherNow);
