import { LitElement, css, html, nothing } from 'lit';
import { wake } from '../actions/rest';
import type { HomeAssistant } from '../ha/types';
import { weatherEntity } from '../model/weather';
import './weather-now';
import { REST } from '../strings';
import { define } from './define';

/**
 * What a resting wall tablet shows: the time, large, and the date, on a dark screen above everything
 * else. A tap anywhere wakes it, and the tap ends here: the light under the finger is not switched.
 */
export class HubbRestScreen extends LitElement {
  static properties = { hass: { attribute: false }, line: { attribute: false }, weatherId: { attribute: false } };

  declare hass: HomeAssistant | undefined;
  /** The summary of the house ("4 acesas · 1 ar ligado · Tudo fechado"), from the home. */
  declare line: string;
  /** The weather the home shows; null: the first weather entity of the house. */
  declare weatherId: string | null;

  #tick: ReturnType<typeof setInterval> | null = null;

  constructor() {
    super();
    this.hass = undefined;
    this.line = '';
    this.weatherId = null;
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.#tick = setInterval(() => this.requestUpdate(), 15_000);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this.#tick) clearInterval(this.#tick);
    this.#tick = null;
  }

  #wake = (e: Event): void => {
    e.stopPropagation();
    e.preventDefault();
    wake();
  };

  render() {
    const now = new Date();
    const time = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const date = now.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
    const weather = this.weatherId ?? (this.hass ? weatherEntity(this.hass) : null);
    return html`<div class="rest" role="button" tabindex="0" aria-label=${REST.open} @click=${this.#wake} @keydown=${this.#wake}>
      <div class="when">
        <div class="time">${time}</div>
        <div class="date">${date}</div>
      </div>
      ${weather ? html`<hubb-weather-now class="wx" .hass=${this.hass} .entityId=${weather}></hubb-weather-now>` : nothing}
      ${this.line ? html`<div class="line">${this.line}</div>` : nothing}
      <div class="hint">${REST.open}</div>
    </div>`;
  }

  static styles = css`
    .rest {
      position: fixed;
      inset: 0;
      z-index: 40;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 8vh 7vw 6vh;
      background: radial-gradient(900px 500px at 80% 0%, #1a2730 0%, #0b1013 60%);
      color: #e3e0d9;
      font-family: var(--hubb-font);
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;
    }
    .rest:focus {
      outline: none;
    }
    .time {
      font-size: clamp(72px, 16vw, 168px);
      font-weight: 700;
      letter-spacing: -0.03em;
      line-height: 1;
    }
    .date {
      margin-top: 12px;
      font-size: clamp(16px, 2.4vw, 24px);
      color: #8e9aa2;
    }
    .hint {
      font-size: 14px;
      color: #5f6b72;
    }
    .line {
      font-size: clamp(14px, 1.8vw, 18px);
      color: #b7c0c6;
    }
    /* The weather on the dark of the rest screen: the colours of Ardósia, whatever the theme. */
    .wx {
      justify-items: start;
      --hubb-text: #e3e0d9;
      --hubb-text-2: #8e9aa2;
      --hubb-amber: #f2c98a;
    }
  `;
}

define('hubb-rest-screen', HubbRestScreen);
