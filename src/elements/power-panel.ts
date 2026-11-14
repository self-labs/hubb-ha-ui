import { mdiPower } from '@mdi/js';
import { LitElement, css, html, nothing, type PropertyValues } from 'lit';
import { kwh, todayKwh, watts } from '../actions/energy';
import { PowerToggle } from '../actions/power-toggle';
import { setSwitch } from '../actions/switch';
import type { HomeAssistant } from '../ha/types';
import { POWER, POWER_BUTTON, S } from '../strings';
import { define } from './define';
import { icon } from './icon';

/** The item whose consumption the sheet shows: an outlet or an equipment with its sensors. */
export interface PowerItem {
  entityId: string;
  name: string;
  power?: string | null;
  energy?: string | null;
}

/** The consumption sheet: the power now, and the energy used today when the statistics have it. */
export class HubbPowerPanel extends LitElement {
  static properties = {
    hass: { attribute: false },
    item: { attribute: false },
    today: { state: true },
  };

  declare hass: HomeAssistant | undefined;
  declare item: PowerItem | undefined;
  /** kWh today, null until read or when there are no statistics. */
  declare today: number | null;

  /** The energy sensor whose day was asked, so a new hass does not ask again. */
  #asked: string | null = null;
  /** The Ligar / Desligar button: what it asked for, until Home Assistant answers. */
  #power = new PowerToggle(this);

  constructor() {
    super();
    this.hass = undefined;
    this.item = undefined;
    this.today = null;
  }

  connectedCallback(): void {
    super.connectedCallback();
    // A sheet opened again reads the day again.
    this.#asked = null;
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#power.dispose();
  }

  protected willUpdate(changed: PropertyValues<this>): void {
    const energy = this.item?.energy;
    if (!this.hass || !energy || energy === this.#asked) return;
    if (changed.has('item')) this.today = null;
    this.#asked = energy;
    void todayKwh(this.hass, energy).then((v) => {
      if (this.item?.energy === energy) this.today = v;
    });
  }

  #togglePower = (): void => {
    const { hass, item } = this;
    const st = item ? hass?.states[item.entityId] : undefined;
    if (!hass || !item || !st || st.state === 'unavailable') return;
    this.#power.press(item.entityId, st, (on) => setSwitch(hass, item.entityId, on));
  };

  render() {
    const { hass, item } = this;
    if (!hass || !item) return nothing;
    const now = item.power ? watts(hass, item.power) : null;
    const st = hass.states[item.entityId];
    const { on, pending, failed } = this.#power.view(item.entityId, st);
    const reading = item.power ? now : null;
    const figures = [item.power ? 'now' : null, this.today !== null ? 'today' : null].filter(Boolean).length;
    return html`<div class="hero ${on ? 'on' : ''}">
        <button
          class="power ${on ? 'on' : ''} ${pending ? 'busy' : ''}"
          ?disabled=${!st || st.state === 'unavailable'}
          @click=${this.#togglePower}
        >
          <span class="disc">${icon(mdiPower)}</span
          ><span class="label">${failed ? S.noResponse : pending ? (on ? S.switchingOn : S.switchingOff) : on ? POWER_BUTTON.switchOff : POWER_BUTTON.switchOn}</span>
        </button>
      </div>
      ${figures
        ? html`<div class="figures ${figures === 1 ? 'one' : 'two'}">
            ${item.power ? html`<p class="now ${on && reading !== null ? 'live' : ''}"><span>${POWER.now}</span> <strong>${reading ?? '-'}</strong></p>` : nothing}
            ${this.today !== null ? html`<p class="today"><span>${POWER.today}</span> <strong>${kwh(this.today)}</strong></p>` : nothing}
          </div>`
        : nothing}`;
  }

  static styles = css`
    :host {
      display: block;
      font-family: var(--hubb-font);
      color: var(--hubb-text);
    }
    /* The button of the sheet: a round disc with the word under it, and a halo of amber while it is on. */
    .hero {
      display: grid;
      place-items: center;
      padding: 4px 0 14px;
    }
    .power {
      all: unset;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 14px;
      color: var(--hubb-text);
      font-family: var(--hubb-font);
      font-size: 13px;
      font-weight: 700;
      text-align: center;
      cursor: pointer;
    }
    .disc {
      display: grid;
      place-items: center;
      width: 72px;
      height: 72px;
      border-radius: 50%;
      background: var(--hubb-surface-2);
      transition:
        background var(--hubb-motion, 200ms) ease,
        box-shadow var(--hubb-motion, 200ms) ease;
    }
    .power.on .disc {
      background: var(--hubb-amber);
      color: var(--hubb-amber-ink);
      box-shadow: 0 0 0 6px var(--hubb-amber-tint);
    }
    .power.busy .disc {
      animation: hubb-wait 1.2s ease-in-out infinite;
    }
    .power:disabled {
      opacity: 0.5;
      cursor: default;
    }
    .power:focus-visible .disc {
      outline: 2px solid var(--hubb-focus);
      outline-offset: 4px;
    }
    .disc svg {
      width: 30px;
      height: 30px;
      fill: currentColor;
    }
    @keyframes hubb-wait {
      50% {
        opacity: 0.6;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .power.busy .disc {
        animation: none;
        opacity: 0.7;
      }
    }
    /* The two numbers, large: what it draws now and what it has used today. */
    .figures {
      display: grid;
      gap: 8px;
    }
    .figures.two {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .figures p {
      box-sizing: border-box;
      display: grid;
      gap: 4px;
      align-content: center;
      min-height: 84px;
      margin: 0;
      padding: 12px 16px;
      border-radius: 16px;
      background: var(--hubb-surface);
      box-shadow: var(--hubb-card-shadow);
    }
    /* Drawing power right now: the card lights like a tile that is on. */
    .figures p.live {
      background: radial-gradient(110% 90% at 15% 0%, var(--hubb-amber-tint), transparent 65%), var(--hubb-on-bg);
    }
    .figures span {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--hubb-text-2);
    }
    .figures p.live span {
      color: var(--hubb-amber-text);
    }
    .figures strong {
      font-size: 28px;
      font-weight: 800;
      letter-spacing: -0.02em;
    }
  `;
}

define('hubb-power-panel', HubbPowerPanel);
