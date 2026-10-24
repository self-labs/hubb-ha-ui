import { mdiAirConditioner, mdiMinus, mdiPlus, mdiPower } from '@mdi/js';
import { LitElement, css, html, nothing, type PropertyValues } from 'lit';
import { canPower, CLIMATE_FEATURE, climateLine, degrees, has, setClimatePower } from '../actions/climate';
import { dropTarget, nudgeTarget, onTargetChange, onTargetNotTaken, pendingTarget, syncTarget } from '../actions/climate-target';
import { haptic } from '../actions/haptic';
import type { HassEntityState, HomeAssistant } from '../ha/types';
import { modeDoing, modeIcon, modeVars } from '../model/climate-mode';
import type { ClimateItem } from '../model/types';
import { CLIMATE, S } from '../strings';
import { define } from './define';
import { icon } from './icon';

const WAIT_MS = 3000;
/** How long the card shakes when the device refuses a target. */
const SHAKE_MS = 600;
/**
 * How long the power button and − 23° + take no tap after one replaces the other under the finger: a
 * second tap on Ligar as it turns on is not a degree up, a tap on + as it goes off is not Ligar (the
 * washer's Iniciar and Desligar, 2026.10.19).
 */
const SWAP_MS = 1000;

/**
 * An air conditioner on its room page: what it is doing, the target and the temperature now. A tap
 * opens its sheet. On with a target (Gustavo, 22/10, proposal 2): − 23° + on the card, as the settings
 * of the card of Home Assistant, sharing the target asked with its sheet; to turn it off, the sheet.
 * Off, or on in a mode with no target: the round button turns it on and off. The colour of the mode
 * on the icon and the background, as on the sheet.
 */
export class HubbClimateCard extends LitElement {
  static properties = {
    hass: { attribute: false },
    item: { attribute: false },
    sent: { state: true },
    refused: { state: true },
  };

  declare hass: HomeAssistant | undefined;
  declare item: ClimateItem | undefined;
  /** The state object on screen when the power command left, and whether it asked for on. */
  declare sent: { from: HassEntityState; on: boolean; at: number } | null;
  /** The device refused the target from − or +: the card shakes for a moment. */
  declare refused: boolean;

  #timer: ReturnType<typeof setTimeout> | null = null;
  #shake: ReturnType<typeof setTimeout> | null = null;
  #unwatch: (() => void) | null = null;
  #unheard: (() => void) | null = null;
  /** What sits at the right of the card now, and when it last changed. */
  #control: 'stepper' | 'power' | 'none' | null = null;
  #swappedAt = 0;

  constructor() {
    super();
    this.hass = undefined;
    this.item = undefined;
    this.sent = null;
    this.refused = false;
  }

  connectedCallback(): void {
    super.connectedCallback();
    // The target asked lives in src/actions/climate-target.ts, shared with the sheet.
    this.#unwatch = onTargetChange(() => this.requestUpdate());
    // A target the device did not take shakes the card, as a refusal does.
    this.#unheard = onTargetNotTaken((hass, entityId) => {
      if (entityId === this.item?.entityId && hass.callService === this.hass?.callService) this.#refuse();
    });
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#unwatch?.();
    this.#unwatch = null;
    this.#unheard?.();
    this.#unheard = null;
    if (this.#timer) clearTimeout(this.#timer);
    if (this.#shake) clearTimeout(this.#shake);
    this.#timer = null;
    this.#shake = null;
  }

  protected willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('hass') && this.hass) syncTarget(this.hass);
  }

  #settling(): boolean {
    return Date.now() - this.#swappedAt < SWAP_MS;
  }

  #step(direction: 1 | -1): void {
    const { hass, item } = this;
    const st = item ? hass?.states[item.entityId] : undefined;
    if (!hass || !st || this.#settling()) return;
    nudgeTarget(hass, st, direction, (sent) => sent.catch(() => this.#refuse()));
  }

  /** The device refused or ignored the target: the card shakes for a moment. */
  #refuse(): void {
    haptic('failure');
    this.refused = true;
    if (this.#shake) clearTimeout(this.#shake);
    this.#shake = setTimeout(() => (this.refused = false), SHAKE_MS);
  }

  #open = (): void => {
    if (!this.item) return;
    haptic('selection');
    this.dispatchEvent(new CustomEvent('hubb-open-climate', { detail: { entityId: this.item.entityId }, bubbles: true, composed: true }));
  };

  #power = (): void => {
    const { hass, item } = this;
    const st = item ? hass?.states[item.entityId] : undefined;
    if (!hass || !st || st.state === 'unavailable' || this.#settling()) return;
    const on = st.state === 'off' || st.state === 'unknown';
    haptic('light');
    if (!on) dropTarget(hass, st.entity_id);
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
    const now = st?.attributes.current_temperature;
    const nowWords = typeof now === 'number' ? CLIMATE.now(Math.round(now)) : null;
    // On with a target and no power command on its way: − and + take the place of the power button.
    const live = !!st && !down && st.state !== 'off' && st.state !== 'unknown';
    const asked = st ? pendingTarget(hass, item.entityId) : null;
    const set = asked ?? (typeof st?.attributes.temperature === 'number' ? st.attributes.temperature : null);
    const target = !waiting && on && set !== null && has(st!, CLIMATE_FEATURE.target) ? set : null;
    const line =
      down ? S.noResponse
      : waiting ? (waiting.on ? S.switchingOn : S.switchingOff)
      : target !== null ? [modeDoing(st!), nowWords].filter(Boolean).join(' · ')
      : climateLine(st!);
    const control = target !== null ? 'stepper' : st && !down && !canPower(st) ? 'none' : 'power';
    if (this.#control !== null && control !== this.#control) this.#swappedAt = Date.now();
    this.#control = control;
    return html`<div class="card ${on ? 'on' : ''} ${down ? 'na' : ''} ${this.refused ? 'refused' : ''}" style=${modeVars(live ? st!.state : 'off')}>
      <button class="body" @click=${this.#open}>
        <span class="icon">${icon(live ? modeIcon(st!.state) : mdiAirConditioner)}</span>
        <span class="text"><span class="name">${item.name}</span><span class="state">${line}</span></span>
        ${target === null && nowWords ? html`<span class="now">${nowWords}</span>` : nothing}
      </button>
      ${control === 'stepper' && target !== null
        ? html`<div class="stepper">
            <button class="step colder" aria-label=${CLIMATE.colder} @click=${() => this.#step(-1)}>${icon(mdiMinus)}</button>
            <span class="target" aria-live="polite">${degrees(target)}°</span>
            <button class="step warmer" aria-label=${CLIMATE.warmer} @click=${() => this.#step(1)}>${icon(mdiPlus)}</button>
          </div>`
        : control === 'none'
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
    /* On: the surface with a tint of the mode from the corner of its icon and a thin edge in it, like the
       tiles of Home Assistant (proposal A, Gustavo 23/10): the colour shows without shouting. */
    .card.on {
      position: relative;
      background: radial-gradient(130% 110% at 0% 0%, color-mix(in srgb, var(--mode) 20%, transparent), transparent 62%), var(--hubb-surface);
    }
    .card.on::after {
      content: '';
      position: absolute;
      inset: 0;
      border-radius: inherit;
      box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--mode) 30%, transparent);
      pointer-events: none;
    }
    /* Refused: a short shake, like a wrong code; without it for whoever turned motion off. */
    .card.refused {
      animation: hubb-refused 0.45s ease-in-out;
    }
    @keyframes hubb-refused {
      20%,
      60% {
        transform: translateX(-5px);
      }
      40%,
      80% {
        transform: translateX(5px);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .card.refused {
        animation: none;
      }
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
      background: color-mix(in srgb, var(--mode) 22%, transparent);
      color: var(--mode-ink);
    }
    .card.on .state {
      color: var(--mode-ink);
    }
    .icon svg,
    .step svg,
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
      background: color-mix(in srgb, var(--mode) 22%, transparent);
      color: var(--mode-ink);
    }
    .stepper {
      flex: none;
      display: flex;
      align-items: center;
      gap: 2px;
    }
    .step {
      all: unset;
      width: 44px;
      height: 44px;
      display: grid;
      place-items: center;
      border-radius: 50%;
      background: var(--hubb-surface-2);
      color: var(--hubb-text);
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;
    }
    .target {
      min-width: 3ch;
      text-align: center;
      font-size: 18px;
      font-weight: 800;
      font-variant-numeric: tabular-nums;
    }
    .body:focus-visible,
    .step:focus-visible,
    .power:focus-visible {
      outline: 2px solid var(--hubb-focus);
      outline-offset: 2px;
    }
  `;
}

define('hubb-climate-card', HubbClimateCard);
