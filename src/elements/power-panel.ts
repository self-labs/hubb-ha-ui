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
    return html`<button
        class="power ${on ? 'on' : ''} ${pending ? 'busy' : ''}"
        ?disabled=${!st || st.state === 'unavailable'}
        @click=${this.#togglePower}
      >
        ${icon(mdiPower)}${failed ? S.noResponse : pending ? (on ? S.switchingOn : S.switchingOff) : on ? POWER_BUTTON.switchOff : POWER_BUTTON.switchOn}
      </button>
      ${item.power ? html`<p class="now"><span>${POWER.now}</span> <strong>${now ?? '-'}</strong></p>` : nothing}
    ${this.today !== null ? html`<p class="today"><span>${POWER.today}</span> <strong>${kwh(this.today)}</strong></p>` : nothing}`;
  }

  static styles = css`
    :host {
      display: grid;
      gap: 8px;
      font-family: var(--hubb-font);
      color: var(--hubb-text);
    }
    .power {
      all: unset;
      box-sizing: border-box;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      min-height: 44px;
      padding: 0 20px;
      border-radius: 22px;
      background: var(--hubb-surface-2);
      color: var(--hubb-text);
      font-family: var(--hubb-font);
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
    }
    .power.on {
      background: var(--hubb-amber);
      color: var(--hubb-amber-ink);
    }
    .power.busy {
      opacity: 0.7;
    }
    .power:disabled {
      opacity: 0.5;
      cursor: default;
    }
    .power:focus-visible {
      outline: 2px solid var(--hubb-focus);
      outline-offset: 2px;
    }
    .power svg {
      width: 20px;
      height: 20px;
      fill: currentColor;
    }
    p {
      box-sizing: border-box;
      display: flex;
      align-items: center;
      justify-content: space-between;
      min-height: 52px;
      margin: 0;
      padding: 0 14px;
      border-radius: 14px;
      background: var(--hubb-surface);
      box-shadow: var(--hubb-card-shadow);
      font-size: 13px;
      font-weight: 700;
    }
    span {
      color: var(--hubb-text-2);
    }
    strong {
      font-size: 18px;
      font-weight: 800;
    }
  `;
}

define('hubb-power-panel', HubbPowerPanel);
