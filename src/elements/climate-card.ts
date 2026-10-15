import { mdiAirConditioner, mdiPower } from '@mdi/js';
import { LitElement, css, html, nothing } from 'lit';
import { canPower, climateLine, setClimatePower } from '../actions/climate';
import { haptic } from '../actions/haptic';
import type { HassEntityState, HomeAssistant } from '../ha/types';
import type { ClimateItem } from '../model/types';
import { CLIMATE, S } from '../strings';
import { define } from './define';
import { icon } from './icon';

const WAIT_MS = 3000;

/**
 * An air conditioner on its room page: what it is doing, the target and the temperature now. A tap
 * opens its sheet; the round button turns it on and off.
 */
export class HubbClimateCard extends LitElement {
  static properties = {
    hass: { attribute: false },
    item: { attribute: false },
    sent: { state: true },
  };

  declare hass: HomeAssistant | undefined;
  declare item: ClimateItem | undefined;
  /** The state object on screen when the power command left, and whether it asked for on. */
  declare sent: { from: HassEntityState; on: boolean; at: number } | null;

  #timer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    super();
    this.hass = undefined;
    this.item = undefined;
    this.sent = null;
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this.#timer) clearTimeout(this.#timer);
    this.#timer = null;
  }

  #open = (): void => {
    if (!this.item) return;
    haptic('selection');
    this.dispatchEvent(new CustomEvent('hubb-open-climate', { detail: { entityId: this.item.entityId }, bubbles: true, composed: true }));
  };

  #power = (): void => {
    const { hass, item } = this;
    const st = item ? hass?.states[item.entityId] : undefined;
    if (!hass || !st || st.state === 'unavailable') return;
    const on = st.state === 'off' || st.state === 'unknown';
    haptic('light');
    this.sent = { from: st, on, at: Date.now() };
    if (this.#timer) clearTimeout(this.#timer);
    this.#timer = setTimeout(() => (this.sent = null), WAIT_MS);
    setClimatePower(hass, st, on, item?.modes).catch(() => haptic('failure'));
  };

  render() {
    const { hass, item } = this;
    if (!hass || !item) return nothing;
    const st = hass.states[item.entityId];
    const down = !st || st.state === 'unavailable';
    const waiting = this.sent && st === this.sent.from ? this.sent : null;
    const on = waiting ? waiting.on : !!st && st.state !== 'off' && st.state !== 'unknown' && !down;
    const line = down ? S.noResponse : waiting ? (waiting.on ? S.switchingOn : S.switchingOff) : climateLine(st!);
    const now = st?.attributes.current_temperature;
    return html`<div class="card ${on ? 'on' : ''} ${down ? 'na' : ''}">
      <button class="body" @click=${this.#open}>
        <span class="icon">${icon(mdiAirConditioner)}</span>
        <span class="text"><span class="name">${item.name}</span><span class="state">${line}</span></span>
        ${typeof now === 'number' ? html`<span class="now">${CLIMATE.now(Math.round(now))}</span>` : nothing}
      </button>
      ${st && !down && !canPower(st)
        ? nothing
        : html`<button class="power" aria-label=${on ? CLIMATE.turnOff : CLIMATE.turnOn} aria-pressed=${on ? 'true' : 'false'} @click=${this.#power}>
            ${icon(mdiPower)}
          </button>`}
    </div>`;
  }

  static styles = css`
    :host {
      display: block;
    }
    .card {
      box-sizing: border-box;
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 8px 6px 4px;
      border-radius: var(--hubb-radius, 16px);
      background: var(--hubb-surface);
      box-shadow: var(--hubb-card-shadow);
      color: var(--hubb-text);
      font-family: var(--hubb-font);
    }
    .card.on {
      background: radial-gradient(110% 80% at 15% 0%, var(--hubb-amber-tint), transparent 65%), var(--hubb-on-bg);
    }
    .card.na {
      background: transparent;
      border: 1.5px dashed color-mix(in srgb, var(--hubb-text-2) 55%, transparent);
    }
    .body {
      all: unset;
      box-sizing: border-box;
      flex: 1;
      min-width: 0;
      min-height: 60px;
      padding: 6px 8px;
      display: flex;
      align-items: center;
      gap: 10px;
      border-radius: 12px;
      cursor: pointer;
    }
    .icon {
      flex: none;
      width: 36px;
      height: 36px;
      border-radius: 12px;
      display: grid;
      place-items: center;
      background: var(--hubb-surface-2);
      color: var(--hubb-text-2);
    }
    .card.on .icon {
      background: var(--hubb-amber);
      color: var(--hubb-amber-ink);
    }
    .icon svg,
    .power svg {
      width: 22px;
      height: 22px;
      fill: currentColor;
    }
    .text {
      flex: 1;
      min-width: 0;
    }
    .name {
      display: block;
      font-weight: 700;
      font-size: 14px;
    }
    .state {
      display: block;
      margin-top: 2px;
      font-weight: 600;
      font-size: 12px;
      color: var(--hubb-text-2);
    }
    .card.on .state {
      color: var(--hubb-amber-text);
    }
    .now {
      flex: none;
      font-size: 12px;
      font-weight: 700;
      color: var(--hubb-text-2);
    }
    .power {
      all: unset;
      flex: none;
      width: 44px;
      height: 44px;
      display: grid;
      place-items: center;
      border-radius: 50%;
      background: var(--hubb-surface-2);
      color: var(--hubb-text-2);
      cursor: pointer;
    }
    .card.on .power {
      background: var(--hubb-amber);
      color: var(--hubb-amber-ink);
    }
    .body:focus-visible,
    .power:focus-visible {
      outline: 2px solid var(--hubb-focus);
      outline-offset: 2px;
    }
  `;
}

define('hubb-climate-card', HubbClimateCard);
