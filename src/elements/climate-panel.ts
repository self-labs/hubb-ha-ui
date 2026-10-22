import { mdiChevronDown, mdiMinus, mdiPlus, mdiPower } from '@mdi/js';
import { LitElement, css, html, nothing, type PropertyValues } from 'lit';
import { canPower, CLIMATE_FEATURE, degrees, FAN_FEATURE, has, namedValues, setClimatePower } from '../actions/climate';
import { haptic } from '../actions/haptic';
import { isInfrared } from '../ha/infrared';
import type { HassEntityState, HomeAssistant } from '../ha/types';
import type { ClimateExtra } from '../model/types';
import { CLIMATE, S } from '../strings';
import { define } from './define';
import './equipment-tile';
import { icon } from './icon';
import { unlisted } from './unlisted';

/** The target goes out once the taps on − and + stop for this long. */
const SEND_AFTER_MS = 800;
/** The target asked stays on screen at most this long, waiting for Home Assistant to show it. */
const HOLD_MS = 4000;
/** More speeds than this do not fit a row: four of them, spread out, are offered. */
const MAX_SPEEDS = 6;

/**
 * The speeds a fan offers, in percent: its own (`percentage_step`, 100 divided by how many it has), each
 * as Home Assistant reports it (speed 2 of 3 is 66), which every integration takes back as that speed.
 * A fan that does not say how many it has is continuous: 25, 50, 75 and 100. `near` is half a step:
 * the speed the fan is at, when its percentage is not one of these.
 */
function fanSpeeds(st: HassEntityState): { speeds: number[]; near: number } {
  const step = Number(st.attributes.percentage_step);
  const count = step > 0 && step <= 100 ? Math.round(100 / step) : 100;
  const picked =
    count <= MAX_SPEEDS
      ? Array.from({ length: count }, (_, i) => i + 1)
      : [...new Set([1, 2, 3, 4].map((k) => Math.max(1, Math.round((count * k) / 4))))];
  return { speeds: picked.map((n) => Math.floor((n * 100) / count)), near: 50 / count };
}

const TIME_UNITS: ReadonlySet<string> = new Set(['s', 'min', 'h']);

/** What a number function reads: "2 h", "Desligado" for a timer at zero or one the device does not report. */
function numberWords(st: HassEntityState, v: number): string {
  const unit = String(st.attributes.unit_of_measurement ?? '');
  if (TIME_UNITS.has(unit) && v === 0) return CLIMATE.timerOff;
  if (unit === 's') return v % 3600 === 0 ? `${v / 3600} h` : `${Math.round(v / 60)} min`;
  return unit ? `${degrees(v)} ${unit}` : degrees(v);
}

const listOf = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

/**
 * What the installer kept on the sheet (`entities.<id>.modes`, `.controls`); missing keeps everything.
 * `extras` are the functions of its device (Iluminação, Modo dormir), `hide` the ones left out.
 */
export interface ClimateAllowed {
  modes?: string[] | null;
  controls?: string[] | null;
  extras?: ClimateExtra[] | null;
  hide?: string[] | null;
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
    failed: { state: true },
  };

  declare hass: HomeAssistant | undefined;
  declare entityId: string;
  declare allowed: ClimateAllowed | null;
  /** The target asked with − and +, until Home Assistant shows it. */
  declare pendingTarget: number | null;
  /** What Home Assistant answered when the last command from this sheet failed; null while all is well. */
  declare failed: string | null;

  #send: ReturnType<typeof setTimeout> | null = null;
  #hold: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    super();
    this.hass = undefined;
    this.entityId = '';
    this.allowed = null;
    this.pendingTarget = null;
    this.failed = null;
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this.#send) {
      clearTimeout(this.#send);
      this.#send = null;
      // The sheet closed before the target went out: the resident saw it, so it goes now.
      if (this.pendingTarget !== null && !this.#leftTarget()) this.#call('set_temperature', { temperature: this.pendingTarget });
    }
    if (this.#hold) clearTimeout(this.#hold);
  }

  protected willUpdate(changed: PropertyValues<this>): void {
    if (!changed.has('hass') || this.pendingTarget === null) return;
    // The mode changed elsewhere to one with no target (Ventilar): a target sent now would be refused.
    if (this.#leftTarget()) this.#dropTarget();
    else if (!this.#send && this.hass?.states[this.entityId]?.attributes.temperature === this.pendingTarget) this.pendingTarget = null;
  }

  /** The mode the device was in when − or + was first tapped. */
  #targetMode: string | null = null;

  /**
   * Whether the device moved to a mode with no target (Ventilar, off) since the taps. A blink (a moment
   * unavailable, the target missing for one update) is not that: the taps stay and go out.
   */
  #leftTarget(): boolean {
    const st = this.hass?.states[this.entityId];
    if (!st || st.state === 'unavailable' || st.state === 'unknown') return false;
    return st.state !== this.#targetMode && typeof st.attributes.temperature !== 'number';
  }

  /** Forgets a target that has not gone out yet. */
  #dropTarget(): void {
    if (this.#send) clearTimeout(this.#send);
    this.#send = null;
    this.pendingTarget = null;
  }

  /**
   * Follows a command: a refusal shows as one line on this sheet, in Portuguese, instead of the toast
   * of Home Assistant in English ("Validation error: Fail device control").
   */
  #follow(sent: Promise<unknown> | undefined, onFail?: () => void): void {
    sent?.then(
      () => (this.failed = null),
      (err: unknown) => {
        haptic('failure');
        this.failed = String((err as { message?: unknown } | null)?.message ?? err);
        onFail?.();
      },
    );
  }

  #call(service: string, data: Record<string, unknown>, onFail?: () => void): void {
    const domain = this.entityId.slice(0, this.entityId.indexOf('.'));
    haptic('light');
    this.#follow(this.hass?.callService(domain, service, data, { entity_id: this.entityId }, false), onFail);
  }

  #mode(mode: string): void {
    // A target not sent yet belonged to the mode being left (LG refuses one in Ventilar).
    this.#dropTarget();
    this.#call('set_hvac_mode', { hvac_mode: mode });
  }

  #step(st: HassEntityState, direction: 1 | -1): void {
    const a = st.attributes;
    // Whole degrees in every mode, like a remote control (Gustavo, 15/10); LG in Auto even keeps 18
    // when asked for 18,5 (test on the owner's unit).
    const step = Math.max(Number(a.target_temp_step) || 1, 1);
    const now = this.pendingTarget ?? Number(a.temperature);
    if (!Number.isFinite(now)) return;
    const min = Number(a.min_temp) || 7;
    const max = Number(a.max_temp) || 35;
    // A half degree set elsewhere goes to the next whole one: 23,5 becomes 24 up and 23 down.
    const moved = direction > 0 ? Math.floor(now / step) * step + step : Math.ceil(now / step) * step - step;
    const next = Math.min(max, Math.max(min, moved));
    // At a limit nothing moves; below the lowest target Home Assistant allows (an LG in Auto sits at
    // 17 with 18 as the lowest), − must not jump up to 18.
    if ((next - now) * direction <= 0) return;
    if (this.pendingTarget === null) this.#targetMode = st.state;
    this.pendingTarget = next;
    haptic('selection');
    if (this.#send) clearTimeout(this.#send);
    this.#send = setTimeout(() => {
      this.#send = null;
      // Refused: the target on screen goes back to the one the device keeps.
      this.#call('set_temperature', { temperature: next }, () => (this.pendingTarget = null));
      if (this.#hold) clearTimeout(this.#hold);
      this.#hold = setTimeout(() => (this.pendingTarget = null), HOLD_MS);
    }, SEND_AFTER_MS);
  }

  #power(hass: HomeAssistant, st: HassEntityState, on: boolean): void {
    haptic('light');
    void setClimatePower(this.#quietHass(hass), st, on, this.allowed?.modes).catch(() => undefined);
  }

  #quiet: { from: HomeAssistant; to: HomeAssistant } | null = null;

  /** The hass handed to the tiles of this sheet: a refused call shows here, not as a toast of Home Assistant. */
  #quietHass(hass: HomeAssistant): HomeAssistant {
    if (this.#quiet?.from === hass) return this.#quiet.to;
    const to: HomeAssistant = {
      ...hass,
      callService: (domain, service, data, target) => {
        const sent = hass.callService(domain, service, data, target, false);
        this.#follow(sent);
        return sent;
      },
    };
    this.#quiet = { from: hass, to };
    return to;
  }

  #extra(hass: HomeAssistant, domain: string, service: string, data: Record<string, unknown>, entityId: string): void {
    haptic('light');
    void this.#quietHass(hass).callService(domain, service, data, { entity_id: entityId }).catch(() => undefined);
  }

  #extraSelect(hass: HomeAssistant, x: ClimateExtra) {
    const st = hass.states[x.entityId]!;
    const word = (o: string): string => hass.formatEntityState?.(st, o) ?? o;
    const options = listOf(st.attributes.options);
    return html`<label class="field">
      <span>${x.name}</span>
      <select class="extra-select" @change=${(e: Event) => this.#extra(hass, 'select', 'select_option', { option: (e.target as HTMLSelectElement).value }, x.entityId)}>
        ${unlisted(st.state, options, word)}
        ${options.map((o) => html`<option value=${o} ?selected=${o === st.state}>${word(o)}</option>`)}
      </select>
    </label>`;
  }

  #extraNumber(hass: HomeAssistant, x: ClimateExtra) {
    const st = hass.states[x.entityId]!;
    const a = st.attributes;
    const step = Number(a.step) || 1;
    const min = Number.isFinite(Number(a.min)) ? Number(a.min) : 0;
    const max = Number.isFinite(Number(a.max)) ? Number(a.max) : 100;
    const read = Number(st.state);
    // A timer the device does not report (unknown) is not running.
    const now = st.state !== '' && Number.isFinite(read) ? read : min;
    const set = (value: number): void => this.#extra(hass, 'number', 'set_value', { value: Math.round(value / step) * step }, x.entityId);
    return html`<div class="extra-number">
      <span class="name">${x.name}</span>
      <button class="step down" aria-label=${CLIMATE.decrease(x.name)} ?disabled=${now <= min} @click=${() => set(Math.max(min, now - step))}>
        ${icon(mdiMinus)}
      </button>
      <span class="value">${numberWords(st, now)}</span>
      <button class="step up" aria-label=${CLIMATE.increase(x.name)} ?disabled=${now >= max} @click=${() => set(Math.min(max, now + step))}>
        ${icon(mdiPlus)}
      </button>
    </div>`;
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
    // A value with no name is still where the device is: "Outra opção", never the first choice.
    return html`<label class="field">
      <span>${label}</span>
      <select class=${cls} @change=${(e: Event) => this.#call(service, { [attribute]: (e.target as HTMLSelectElement).value })}>
        ${unlisted(
          current,
          values.map(([v]) => v),
          () => CLIMATE.otherValue,
        )}
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
    const { speeds, near } = fanSpeeds(st);
    if (speeds.length < 2) return nothing;
    const now = Number(st.attributes.percentage);
    const current = (p: number): boolean => Number.isFinite(now) && Math.abs(p - now) < near;
    return html`<p class="label">${CLIMATE.speed}</p>
      <div class="row">
        ${speeds.map(
          (p) =>
            html`<button class="speed ${current(p) ? 'current' : ''}" aria-pressed=${current(p) ? 'true' : 'false'} @click=${() => this.#call('set_percentage', { percentage: p })}>
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
    // The functions of its device the installer kept and the device answers for now; a timer the
    // device does not report (unknown) is still one to set.
    const hide = this.allowed?.hide ?? [];
    const extras = (this.allowed?.extras ?? []).filter((x) => {
      const now = hass.states[x.entityId]?.state;
      return !hide.includes(x.entityId) && now !== undefined && now !== 'unavailable' && (x.kind === 'number' || now !== 'unknown');
    });
    const switches = extras.filter((x) => x.kind === 'switch');
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
      ${this.failed
        ? html`<p class="failed" role="alert">
            ${CLIMATE.refused} ${hass.user?.is_admin ? html`<span class="why">(${this.failed})</span>` : nothing}
          </p>`
        : nothing}
      ${now !== null ? html`<p class="now">${CLIMATE.now(Math.round(now))}</p>` : nothing}
      ${isInfrared(hass, this.entityId) ? html`<p class="infrared">${S.infrared}</p>` : nothing}
      ${modes.length
        ? html`<div class="row modes">
            ${modes.map(
              (m) =>
                html`<button class="mode ${m === st.state ? 'current' : ''}" aria-pressed=${m === st.state ? 'true' : 'false'} @click=${() => this.#mode(m)}>
                  ${CLIMATE.modes[m] ?? m}
                </button>`,
            )}
          </div>`
        : nothing}
      ${fan.length || swing.length || preset.length || extras.length
        ? html`<details class="more">
            <summary>${CLIMATE.more}${icon(mdiChevronDown)}</summary>
            ${fan.length ? html`<p class="label">${CLIMATE.fan}</p>${this.#choices(st, 'fan_mode', fan, 'set_fan_mode', 'fan')}` : nothing}
            ${swing.length ? this.#select(st, 'swing_mode', swing, 'set_swing_mode', 'swing', CLIMATE.swing) : nothing}
            ${preset.length ? this.#select(st, 'preset_mode', preset, 'set_preset_mode', 'preset', CLIMATE.preset) : nothing}
            ${switches.length
              ? html`<div class="extras">
                  ${switches.map(
                    (x) => html`<hubb-equipment-tile .hass=${this.#quietHass(hass)} .item=${{ entityId: x.entityId, name: x.name, icon: null }}></hubb-equipment-tile>`,
                  )}
                </div>`
              : nothing}
            ${extras.filter((x) => x.kind === 'select').map((x) => this.#extraSelect(hass, x))}
            ${extras.filter((x) => x.kind === 'number').map((x) => this.#extraNumber(hass, x))}
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
    .failed {
      margin: 8px 0 4px;
      padding: 10px 12px;
      border-radius: 12px;
      background: var(--hubb-surface);
      font-size: 12px;
      font-weight: 600;
      line-height: 1.4;
      color: var(--hubb-amber-text);
    }
    .failed .why {
      color: var(--hubb-text-2);
      font-weight: 500;
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
    .extras {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
      margin-top: 16px;
    }
    .extra-number {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 12px;
    }
    .extra-number .name {
      flex: 1;
      min-width: 0;
      font-size: 14px;
      font-weight: 700;
    }
    .extra-number .value {
      min-width: 72px;
      text-align: center;
      font-size: 14px;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
    }
    .extra-number .step {
      width: 44px;
      height: 44px;
    }
    .extra-number .step[disabled] {
      opacity: 0.4;
      cursor: default;
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
