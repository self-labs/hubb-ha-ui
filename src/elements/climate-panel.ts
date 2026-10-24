import { mdiChevronDown, mdiMinus, mdiPlus, mdiPower } from '@mdi/js';
import { LitElement, css, html, nothing, type PropertyValues } from 'lit';
import { live } from 'lit/directives/live.js';
import { canPower, CLIMATE_FEATURE, degrees, FAN_FEATURE, has, namedValues, setClimatePower } from '../actions/climate';
import { dropTarget, flushTarget, nudgeTarget, onTargetChange, onTargetNotTaken, pendingTarget, setTarget, syncTarget } from '../actions/climate-target';
import { haptic } from '../actions/haptic';
import { setSwitch } from '../actions/switch';
import { isInfrared } from '../ha/infrared';
import { LayoutWatcher } from '../layout';
import type { HassEntityState, HomeAssistant } from '../ha/types';
import { targetLimits } from '../model/arc';
import { modeColor, modeDoing, modeIcon, modeVars } from '../model/climate-mode';
import type { Layout } from '../model/layout';
import type { ClimateExtra } from '../model/types';
import { CLIMATE, S } from '../strings';
import './climate-arc';
import type { ArcChange } from './climate-arc';
import { define } from './define';
import { icon } from './icon';
import { reported, unlisted } from './unlisted';

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
 * The sheet of an air conditioner or of a fan (speed). The air conditioner after the card of Home
 * Assistant (Gustavo, 22/10): the arc to drag, − and + with the power in the middle, the modes with
 * their icons, all centred, and ventilation, swing, preset and the functions of the device closed under
 * "Mais ajustes". Each part shows only when the device has it, the installer kept it, and its values
 * have a name.
 */
export class HubbClimatePanel extends LitElement {
  static properties = {
    hass: { attribute: false },
    entityId: { attribute: false },
    allowed: { attribute: false },
    failed: { state: true },
    notTaken: { state: true },
    screenLayout: { reflect: true, attribute: 'screen-layout' },
  };

  declare hass: HomeAssistant | undefined;
  declare entityId: string;
  declare allowed: ClimateAllowed | null;
  /** What Home Assistant answered when the last command from this sheet failed; null while all is well. */
  declare failed: string | null;
  /** The layout of the panel, for the arc to grow in the window of the tablet lying down. */
  declare screenLayout: Layout;

  #unwatch: (() => void) | null = null;
  #unheard: (() => void) | null = null;
  /** A target the device did not take, said on this sheet until the next command or until it shows. */
  declare notTaken: number | null;

  constructor() {
    super();
    this.hass = undefined;
    this.entityId = '';
    this.allowed = null;
    this.failed = null;
    this.notTaken = null;
    this.screenLayout = 'phone';
    new LayoutWatcher(this);
  }

  connectedCallback(): void {
    super.connectedCallback();
    // The target asked lives in src/actions/climate-target.ts, shared with the card of the room.
    this.#unwatch = onTargetChange(() => this.requestUpdate());
    this.#unheard = onTargetNotTaken((hass, entityId, value) => {
      if (entityId !== this.entityId || hass.callService !== this.hass?.callService) return;
      haptic('failure');
      this.notTaken = value;
    });
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#unwatch?.();
    this.#unwatch = null;
    this.#unheard?.();
    this.#unheard = null;
    // The sheet closed before the target went out: the resident saw it, so it goes now.
    if (this.hass) flushTarget(this.hass, this.entityId);
  }

  protected willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('hass') && this.hass) {
      syncTarget(this.hass);
      // It took the target after all, late.
      if (this.notTaken !== null && this.hass.states[this.entityId]?.attributes.temperature === this.notTaken) this.notTaken = null;
    }
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
    this.notTaken = null;
    const domain = this.entityId.slice(0, this.entityId.indexOf('.'));
    haptic('light');
    this.#follow(this.hass?.callService(domain, service, data, { entity_id: this.entityId }, false), onFail);
  }

  #mode(mode: string): void {
    // A target not sent yet belonged to the mode being left (LG refuses one in Ventilar).
    if (this.hass) dropTarget(this.hass, this.entityId);
    this.#call('set_hvac_mode', { hvac_mode: mode });
  }

  #step(st: HassEntityState, direction: 1 | -1): void {
    this.notTaken = null;
    if (this.hass) nudgeTarget(this.hass, st, direction, (sent) => this.#follow(sent));
  }

  #power(hass: HomeAssistant, st: HassEntityState, on: boolean): void {
    this.notTaken = null;
    haptic('light');
    // A target not sent yet would reach a device the resident just turned off.
    if (!on) dropTarget(hass, this.entityId);
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
    const values = listOf(st.attributes.options).map((o): [string, string] => [o, word(o)]);
    return this.#picker(x.name, 'extra-select', st.state, values, word, (option) => this.#extra(hass, 'select', 'select_option', { option }, x.entityId));
  }

  /** A function that switches (Luz do display): its name and a switch, the whole row to tap. */
  #extraSwitch(hass: HomeAssistant, x: ClimateExtra) {
    const on = hass.states[x.entityId]?.state === 'on';
    return html`<div class="function">
      <button
        class="toggle"
        role="switch"
        aria-checked=${on ? 'true' : 'false'}
        @click=${() => {
          haptic('light');
          void setSwitch(this.#quietHass(hass), x.entityId, !on).catch(() => undefined);
        }}
      >
        <span class="name">${x.name}</span>
        <span class="track"><span class="thumb"></span></span>
      </button>
    </div>`;
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

  /**
   * A setting as the card of Home Assistant shows it (Gustavo, 22/10): a button with its name over the
   * value now, and the list of the phone itself to pick another (the native select, invisible, laid
   * over the button). A value with no name is still where the device is: `other` says it, never the
   * first choice.
   */
  #picker(name: string, cls: string, current: unknown, values: [string, string][], other: (v: string) => string, pick: (v: string) => void) {
    const named = values.find(([v]) => v === current)?.[1];
    return html`<label class="setting">
      <span class="text">
        <span class="name">${name}</span>
        <span class="value" aria-hidden="true">${named ?? (reported(current) ? other(current) : '')}</span>
      </span>
      ${icon(mdiChevronDown)}
      <select
        class=${cls}
        aria-label=${name}
        .value=${live(named !== undefined ? String(current) : '')}
        @change=${(e: Event) => pick((e.target as HTMLSelectElement).value)}
      >
        ${unlisted(
          current,
          values.map(([v]) => v),
          other,
        )}
        ${values.map(([v, word]) => html`<option value=${v} ?selected=${v === current}>${word}</option>`)}
      </select>
    </label>`;
  }

  /** Ventilação, Oscilação or Predefinição, when the device has it and the installer kept it. */
  #climateSetting(st: HassEntityState, name: string, cls: string, attribute: string, values: [string, string][], service: string) {
    if (!values.length) return nothing;
    return this.#picker(name, cls, st.attributes[attribute], values, () => CLIMATE.otherValue, (v) => this.#call(service, { [attribute]: v }));
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
    const waiting = pendingTarget(hass, this.entityId);
    const target = waiting ?? (typeof a.temperature === 'number' ? a.temperature : null);
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
    const choices = extras.filter((x) => x.kind === 'select');
    // Off, or in a mode with no target (Ventilar, Auto with a range): the arc has nothing to set, as in
    // Home Assistant (Gustavo, 23/10).
    const settable = on && target !== null && has(st, CLIMATE_FEATURE.target);
    const hasTarget = settable;
    const limits = targetLimits(a);
    return html`<hubb-climate-arc
        .value=${settable ? target : null}
        .min=${limits.min}
        .max=${limits.max}
        .step=${limits.step}
        .current=${now}
        .color=${modeColor(st.state)}
        .label=${modeDoing(st)}
        @hubb-arc-change=${(e: CustomEvent<ArcChange>) => {
          this.notTaken = null;
          if (settable) setTarget(hass, st, e.detail.value, { now: e.detail.source === 'pointer', follow: (sent) => this.#follow(sent) });
        }}
      ></hubb-climate-arc>
      ${settable ? html`<span class="target sr" aria-live="polite">${degrees(target)}°</span>` : nothing}
      <div class="controls" style=${modeVars(st.state)}>
        ${hasTarget ? html`<button class="step colder" aria-label=${CLIMATE.colder} @click=${() => this.#step(st, -1)}>${icon(mdiMinus)}</button>` : nothing}
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
        ${hasTarget ? html`<button class="step warmer" aria-label=${CLIMATE.warmer} @click=${() => this.#step(st, 1)}>${icon(mdiPlus)}</button>` : nothing}
      </div>
      ${this.failed
        ? html`<p class="failed" role="alert">
            ${CLIMATE.refused} ${hass.user?.is_admin ? html`<span class="why">(${this.failed})</span>` : nothing}
          </p>`
        : nothing}
      ${this.notTaken !== null ? html`<p class="failed not-taken" role="alert">${CLIMATE.notTaken(degrees(this.notTaken))}</p>` : nothing}
      ${isInfrared(hass, this.entityId) ? html`<p class="infrared">${S.infrared}</p>` : nothing}
      ${modes.length
        ? html`<div class="modes">
            ${modes.map(
              (m) =>
                html`<button
                  class="mode ${m === st.state ? 'current' : ''}"
                  style=${modeVars(m)}
                  aria-pressed=${m === st.state ? 'true' : 'false'}
                  @click=${() => this.#mode(m)}
                >
                  <span class="mode-icon">${icon(modeIcon(m))}</span>${CLIMATE.modes[m] ?? m}
                </button>`,
            )}
          </div>`
        : nothing}
      ${fan.length || swing.length || preset.length || extras.length
        ? html`<details class="more">
            <summary>${CLIMATE.more}${icon(mdiChevronDown)}</summary>
            ${fan.length || swing.length || preset.length || choices.length
              ? html`<div class="settings">
                  ${this.#climateSetting(st, CLIMATE.fan, 'fan', 'fan_mode', fan, 'set_fan_mode')}
                  ${this.#climateSetting(st, CLIMATE.swing, 'swing', 'swing_mode', swing, 'set_swing_mode')}
                  ${this.#climateSetting(st, CLIMATE.preset, 'preset', 'preset_mode', preset, 'set_preset_mode')}
                  ${choices.map((x) => this.#extraSelect(hass, x))}
                </div>`
              : nothing}
            ${extras.filter((x) => x.kind === 'switch').map((x) => this.#extraSwitch(hass, x))}
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
    /* The target for screen readers, said when − and + move it; the arc shows it. */
    .sr {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
    }
    hubb-climate-arc {
      margin-top: 4px;
    }
    :host([screen-layout='wide']) hubb-climate-arc {
      --hubb-arc-size: 320px;
    }
    .controls {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 22px;
      margin-top: -4px;
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
      -webkit-tap-highlight-color: transparent;
    }
    .power {
      width: 62px;
      height: 62px;
      color: var(--hubb-text-2);
    }
    /* On, in the tint of the mode, as the card (proposal A, Gustavo 23/10). */
    .power.on {
      background: color-mix(in srgb, var(--mode) 24%, transparent);
      color: var(--mode-ink);
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
    .label {
      margin: 12px 2px 8px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--hubb-text-2);
    }
    /* Each setting a button with its value, in a row that wraps on a narrow screen. */
    .settings {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .setting {
      position: relative;
      flex: 1 1 140px;
      min-width: 0;
      box-sizing: border-box;
      min-height: 56px;
      padding: 8px 10px 8px 12px;
      display: flex;
      align-items: center;
      gap: 6px;
      border-radius: 14px;
      background: var(--hubb-surface-2);
      cursor: pointer;
    }
    .setting .text {
      flex: 1;
      min-width: 0;
      display: grid;
      gap: 2px;
    }
    .setting .name {
      font-size: 11px;
      font-weight: 700;
      color: var(--hubb-text-2);
    }
    .setting .value {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: 14px;
      font-weight: 700;
    }
    .setting svg {
      flex: none;
      width: 20px;
      height: 20px;
      fill: var(--hubb-text-2);
    }
    /* The list of the phone: invisible over the whole button, so a tap anywhere on it opens the list. */
    .setting select {
      position: absolute;
      inset: 0;
      height: 100%;
      opacity: 0;
      cursor: pointer;
    }
    .setting:has(select:focus-visible) {
      outline: 2px solid var(--hubb-focus);
      outline-offset: 2px;
    }
    /* A function that switches and one with a number: a row each, the width of the sheet. */
    .extra-number {
      box-sizing: border-box;
      min-height: 52px;
      margin-top: 8px;
      padding: 4px 4px 4px 12px;
      display: flex;
      align-items: center;
      gap: 8px;
      border-radius: 14px;
      background: var(--hubb-surface-2);
    }
    .toggle {
      all: unset;
      box-sizing: border-box;
      width: 100%;
      min-height: 52px;
      margin-top: 8px;
      padding: 0 12px;
      display: flex;
      align-items: center;
      gap: 12px;
      border-radius: 14px;
      background: var(--hubb-surface-2);
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;
    }
    .toggle .name {
      flex: 1;
      min-width: 0;
      font-size: 14px;
      font-weight: 700;
    }
    .track {
      position: relative;
      flex: none;
      width: 44px;
      height: 26px;
      border-radius: 13px;
      background: var(--hubb-mode-off);
      transition: background var(--hubb-motion, 200ms);
    }
    .thumb {
      position: absolute;
      top: 3px;
      left: 3px;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: #fff;
      transition: transform var(--hubb-motion, 200ms);
    }
    .toggle[aria-checked='true'] .track {
      background: var(--hubb-amber);
    }
    .toggle[aria-checked='true'] .thumb {
      transform: translateX(18px);
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
      background: var(--hubb-surface);
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
    /* The modes in the middle, an icon over each name; the one on in the colour of the mode. */
    .modes {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 8px;
      margin-top: 16px;
    }
    .mode {
      all: unset;
      box-sizing: border-box;
      width: 60px;
      display: grid;
      justify-items: center;
      gap: 5px;
      font-size: 11px;
      font-weight: 600;
      color: var(--hubb-text-2);
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;
    }
    .mode-icon {
      width: 48px;
      height: 48px;
      display: grid;
      place-items: center;
      border-radius: 15px;
      background: var(--hubb-surface-2);
      color: var(--hubb-text);
    }
    .mode-icon svg {
      width: 22px;
      height: 22px;
      fill: currentColor;
    }
    .mode.current {
      color: var(--hubb-text);
      font-weight: 800;
    }
    .mode.current .mode-icon {
      background: color-mix(in srgb, var(--mode) 24%, transparent);
      color: var(--mode-ink);
      box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--mode) 45%, transparent);
    }
    .mode:focus-visible .mode-icon {
      outline: 2px solid var(--hubb-focus);
      outline-offset: 2px;
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
    .toggle:focus-visible,
    .row button:focus-visible,
    .more summary:focus-visible,
    select:focus-visible {
      outline: 2px solid var(--hubb-focus);
      outline-offset: 2px;
    }
  `;
}

define('hubb-climate-panel', HubbClimatePanel);
