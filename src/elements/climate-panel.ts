import { mdiChevronDown, mdiMinus, mdiPlus, mdiPower } from '@mdi/js';
import { LitElement, css, html, nothing, type PropertyValues } from 'lit';
import { canPower, CLIMATE_FEATURE, degrees, FAN_FEATURE, has, namedValues, setClimatePower } from '../actions/climate';
import { haptic } from '../actions/haptic';
import { isInfrared } from '../ha/infrared';
import type { HassEntityState, HomeAssistant } from '../ha/types';
import { CLIMATE, S } from '../strings';
import { define } from './define';
import { icon } from './icon';

/** The target goes out once the taps on − and + stop for this long. */
const SEND_AFTER_MS = 800;
/** The target asked stays on screen at most this long, waiting for Home Assistant to show it. */
const HOLD_MS = 4000;
const SPEEDS = [25, 50, 75, 100];

const listOf = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

/** What the installer kept on the sheet (`entities.<id>.modes`, `.controls`); missing keeps everything. */
export interface ClimateAllowed {
  modes?: string[] | null;
  controls?: string[] | null;
}

/**
 * The sheet of an air conditioner or of a fan (speed). Compact (Gustavo, 14/10): the temperature and
 * the power on top, the modes in one row, ventilation, swing and preset closed under "Mais ajustes".
 * Each part shows only when the device has it, the installer kept it, and its values have a name.
 */
export class HubbClimatePanel extends LitElement {
  static properties = {
    hass: { attribute: false },
    entityId: { attribute: false },
    allowed: { attribute: false },
    pendingTarget: { state: true },
  };

  declare hass: HomeAssistant | undefined;
  declare entityId: string;
  declare allowed: ClimateAllowed | null;
  /** The target asked with − and +, until Home Assistant shows it. */
  declare pendingTarget: number | null;

  #send: ReturnType<typeof setTimeout> | null = null;
  #hold: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    super();
    this.hass = undefined;
    this.entityId = '';
    this.allowed = null;
    this.pendingTarget = null;
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this.#send) {
      clearTimeout(this.#send);
      this.#send = null;
      // The sheet closed before the target went out: the resident saw it, so it goes now.
      if (this.pendingTarget !== null) this.#call('set_temperature', { temperature: this.pendingTarget });
    }
    if (this.#hold) clearTimeout(this.#hold);
  }

  protected willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('hass') && this.pendingTarget !== null && !this.#send) {
      if (this.hass?.states[this.entityId]?.attributes.temperature === this.pendingTarget) this.pendingTarget = null;
    }
  }

  #call(service: string, data: Record<string, unknown>): void {
    const domain = this.entityId.slice(0, this.entityId.indexOf('.'));
    haptic('light');
    this.hass?.callService(domain, service, data, { entity_id: this.entityId }).catch(() => haptic('failure'));
  }

  #step(st: HassEntityState, direction: 1 | -1): void {
    const a = st.attributes;
    const step = Number(a.target_temp_step) || 1;
    const now = this.pendingTarget ?? Number(a.temperature);
    if (!Number.isFinite(now)) return;
    const min = Number(a.min_temp) || 7;
    const max = Number(a.max_temp) || 35;
    const next = Math.min(max, Math.max(min, Math.round((now + direction * step) / step) * step));
    this.pendingTarget = next;
    haptic('selection');
    if (this.#send) clearTimeout(this.#send);
    this.#send = setTimeout(() => {
      this.#send = null;
      this.#call('set_temperature', { temperature: next });
      if (this.#hold) clearTimeout(this.#hold);
      this.#hold = setTimeout(() => (this.pendingTarget = null), HOLD_MS);
    }, SEND_AFTER_MS);
  }

  #power(hass: HomeAssistant, st: HassEntityState, on: boolean): void {
    haptic('light');
    setClimatePower(hass, st, on, this.allowed?.modes).catch(() => haptic('failure'));
  }

  #choices(st: HassEntityState, attribute: string, values: [string, string][], service: string, cls: string) {
    const current = st.attributes[attribute];
    return html`<div class="row">
      ${values.map(
        ([v, word]) =>
          html`<button class="${cls} ${v === current ? 'current' : ''}" aria-pressed=${v === current ? 'true' : 'false'} @click=${() => this.#call(service, { [attribute]: v })}>
            ${word}
          </button>`,
      )}
    </div>`;
  }

  #select(st: HassEntityState, attribute: string, values: [string, string][], service: string, cls: string, label: string) {
    const current = st.attributes[attribute];
    // A value with no name is still where the device is: showing the first choice instead would lie,
    // and that choice could then not be picked (no change event).
    const named = values.some(([v]) => v === current);
    return html`<label class="field">
      <span>${label}</span>
      <select class=${cls} @change=${(e: Event) => this.#call(service, { [attribute]: (e.target as HTMLSelectElement).value })}>
        ${named ? nothing : html`<option value="" disabled selected>${CLIMATE.otherValue}</option>`}
        ${values.map(([v, word]) => html`<option value=${v} ?selected=${v === current}>${word}</option>`)}
      </select>
    </label>`;
  }

  /** The named values of a setting the device has and the installer kept; empty when it says nothing. */
  #setting(hass: HomeAssistant, st: HassEntityState, control: string, feature: number, attribute: string, values: string): [string, string][] {
    const kept = this.allowed?.controls;
    if (!has(st, feature) || (kept && !kept.includes(control))) return [];
    const named = namedValues(hass, st, attribute, listOf(st.attributes[values]));
    // A choice of one is no choice: the setting stays off the sheet.
    return named.length > 1 ? named : [];
  }

  #fan(st: HassEntityState) {
    if (!has(st, FAN_FEATURE.speed)) return nothing;
    const now = Number(st.attributes.percentage);
    return html`<p class="label">${CLIMATE.speed}</p>
      <div class="row">
        ${SPEEDS.map(
          (p) =>
            html`<button class="speed ${p === now ? 'current' : ''}" aria-pressed=${p === now ? 'true' : 'false'} @click=${() => this.#call('set_percentage', { percentage: p })}>
              ${p}%
            </button>`,
        )}
      </div>`;
  }

  render() {
    const hass = this.hass;
    const st = hass?.states[this.entityId];
    if (!hass || !st) return nothing;
    // Home Assistant keeps the features and the lists of a device that is down: nothing here would work.
    if (st.state === 'unavailable') return html`<p class="now">${S.noResponse}</p>`;
    if (this.entityId.startsWith('fan.')) return this.#fan(st);
    const a = st.attributes;
    const target = this.pendingTarget ?? (typeof a.temperature === 'number' ? a.temperature : null);
    const now = typeof a.current_temperature === 'number' ? a.current_temperature : null;
    const keptModes = this.allowed?.modes;
    // Off belongs to the power button: the modes are what it does while on.
    const modes = listOf(a.hvac_modes).filter((m) => m !== 'off' && (!keptModes || keptModes.includes(m)));
    const fan = this.#setting(hass, st, 'fan', CLIMATE_FEATURE.fan, 'fan_mode', 'fan_modes');
    const swing = this.#setting(hass, st, 'swing', CLIMATE_FEATURE.swing, 'swing_mode', 'swing_modes');
    const preset = this.#setting(hass, st, 'preset', CLIMATE_FEATURE.preset, 'preset_mode', 'preset_modes');
    // An infrared unit before its first command is unknown: shown off, so the button turns it on.
    const on = st.state !== 'off' && st.state !== 'unknown';
    return html`<div class="top">
        ${target !== null && has(st, CLIMATE_FEATURE.target)
          ? html`<button class="step colder" aria-label=${CLIMATE.colder} @click=${() => this.#step(st, -1)}>${icon(mdiMinus)}</button>
              <span class="target ${this.pendingTarget !== null ? 'pending' : ''}" aria-live="polite">${degrees(target)}°</span>
              <button class="step warmer" aria-label=${CLIMATE.warmer} @click=${() => this.#step(st, 1)}>${icon(mdiPlus)}</button>`
          : nothing}
        ${canPower(st)
          ? html`<button
              class="power ${on ? 'on' : ''}"
              aria-label=${on ? CLIMATE.turnOff : CLIMATE.turnOn}
              aria-pressed=${on ? 'true' : 'false'}
              @click=${() => this.#power(hass, st, !on)}
            >
              ${icon(mdiPower)}
            </button>`
          : nothing}
      </div>
      ${now !== null ? html`<p class="now">${CLIMATE.now(Math.round(now))}</p>` : nothing}
      ${isInfrared(hass, this.entityId) ? html`<p class="infrared">${S.infrared}</p>` : nothing}
      ${modes.length
        ? html`<div class="row modes">
            ${modes.map(
              (m) =>
                html`<button class="mode ${m === st.state ? 'current' : ''}" aria-pressed=${m === st.state ? 'true' : 'false'} @click=${() => this.#call('set_hvac_mode', { hvac_mode: m })}>
                  ${CLIMATE.modes[m] ?? m}
                </button>`,
            )}
          </div>`
        : nothing}
      ${fan.length || swing.length || preset.length
        ? html`<details class="more">
            <summary>${CLIMATE.more}${icon(mdiChevronDown)}</summary>
            ${fan.length ? html`<p class="label">${CLIMATE.fan}</p>${this.#choices(st, 'fan_mode', fan, 'set_fan_mode', 'fan')}` : nothing}
            ${swing.length ? this.#select(st, 'swing_mode', swing, 'set_swing_mode', 'swing', CLIMATE.swing) : nothing}
            ${preset.length ? this.#select(st, 'preset_mode', preset, 'set_preset_mode', 'preset', CLIMATE.preset) : nothing}
          </details>`
        : nothing}`;
  }

  static styles = css`
    :host {
      display: block;
      font-family: var(--hubb-font);
      color: var(--hubb-text);
    }
    .top {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 18px;
    }
    .target {
      min-width: 3.2ch;
      text-align: center;
      font-size: 40px;
      font-weight: 800;
      letter-spacing: -0.03em;
    }
    .target.pending {
      color: var(--hubb-amber-text);
    }
    .step,
    .power {
      all: unset;
      width: 52px;
      height: 52px;
      display: grid;
      place-items: center;
      border-radius: 50%;
      background: var(--hubb-surface-2);
      cursor: pointer;
    }
    .power {
      margin-left: 8px;
      color: var(--hubb-text-2);
    }
    .power.on {
      background: var(--hubb-amber);
      color: var(--hubb-amber-ink);
    }
    .step svg,
    .power svg {
      width: 24px;
      height: 24px;
      fill: currentColor;
    }
    .now {
      margin: 2px 0 8px;
      text-align: center;
      font-size: 13px;
      font-weight: 600;
      color: var(--hubb-text-2);
    }
    .infrared {
      margin: 8px 0;
      padding: 10px 12px;
      border-radius: 12px;
      background: var(--hubb-surface);
      font-size: 12px;
      font-weight: 600;
      color: var(--hubb-text-2);
    }
    .label,
    .field span {
      margin: 12px 2px 8px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--hubb-text-2);
    }
    .field {
      display: grid;
    }
    .row {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .modes {
      margin-top: 4px;
    }
    .row button {
      all: unset;
      box-sizing: border-box;
      min-height: 44px;
      padding: 0 14px;
      display: inline-flex;
      align-items: center;
      border-radius: 12px;
      background: var(--hubb-surface-2);
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
    }
    .row button.current {
      background: var(--hubb-primary-bg);
      color: var(--hubb-primary-ink);
    }
    /* Closed until asked: what the resident changes every day stays on top. */
    .more {
      margin-top: 12px;
      padding: 0 12px;
      border-radius: 14px;
      background: var(--hubb-surface);
    }
    .more[open] {
      padding-bottom: 12px;
    }
    .more summary {
      min-height: 44px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      list-style: none;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
    }
    .more summary::-webkit-details-marker {
      display: none;
    }
    .more summary svg {
      width: 20px;
      height: 20px;
      fill: var(--hubb-text-2);
      transition: transform var(--hubb-motion, 200ms);
    }
    .more[open] summary svg {
      transform: rotate(180deg);
    }
    select {
      box-sizing: border-box;
      width: 100%;
      min-height: 48px;
      padding: 0 12px;
      border: 1.5px solid color-mix(in srgb, var(--hubb-text-2) 35%, transparent);
      border-radius: 12px;
      background: var(--hubb-surface);
      color: var(--hubb-text);
      font-family: var(--hubb-font);
      font-size: 16px;
    }
    .step:focus-visible,
    .power:focus-visible,
    .row button:focus-visible,
    .more summary:focus-visible,
    select:focus-visible {
      outline: 2px solid var(--hubb-focus);
      outline-offset: 2px;
    }
  `;
}

define('hubb-climate-panel', HubbClimatePanel);
