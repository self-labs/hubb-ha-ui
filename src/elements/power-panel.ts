import { LitElement, css, html, nothing, type PropertyValues } from 'lit';
import { kwh, todayKwh, watts } from '../actions/energy';
import type { HomeAssistant } from '../ha/types';
import { POWER } from '../strings';
import { define } from './define';

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

  protected willUpdate(changed: PropertyValues<this>): void {
    const energy = this.item?.energy;
    if (!this.hass || !energy || energy === this.#asked) return;
    if (changed.has('item')) this.today = null;
    this.#asked = energy;
    void todayKwh(this.hass, energy).then((v) => {
      if (this.item?.energy === energy) this.today = v;
    });
  }

  render() {
    const { hass, item } = this;
    if (!hass || !item) return nothing;
    const now = item.power ? watts(hass, item.power) : null;
    return html`${item.power ? html`<p class="now"><span>${POWER.now}</span> <strong>${now ?? '-'}</strong></p>` : nothing}
    ${this.today !== null ? html`<p class="today"><span>${POWER.today}</span> <strong>${kwh(this.today)}</strong></p>` : nothing}`;
  }

  static styles = css`
    :host {
      display: grid;
      gap: 8px;
      font-family: var(--hubb-font);
      color: var(--hubb-text);
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
