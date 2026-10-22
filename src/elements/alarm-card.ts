import { mdiShieldHome, mdiShieldOffOutline } from '@mdi/js';
import { LitElement, css, html, nothing } from 'lit';
import { haptic } from '../actions/haptic';
import type { HassEntityState, HomeAssistant } from '../ha/types';
import type { AlarmItem } from '../model/types';
import { ALARM, S } from '../strings';
import { define } from './define';
import { icon } from './icon';
import './slide-confirm';

/** The arming modes of an alarm panel (AlarmControlPanelEntityFeature), in the order they show. */
export const ALARM_FEATURE = { home: 1, away: 2, night: 4, vacation: 32 } as const;
type Mode = keyof typeof ALARM_FEATURE;
const MODES: readonly Mode[] = ['home', 'away', 'night', 'vacation'];

/** As long as the other cards: the wait for an answer, then "Sem resposta" for a while. */
const WAIT_MS = 3000;
const FAILED_MS = 4000;
const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

interface Sent {
  /** The state on screen when the command left: any newer one is the answer. */
  from: HassEntityState;
  at: number;
  word: string;
}

/**
 * An alarm panel. Arming is a tap on a mode the panel takes; disarming asks for the code when the
 * panel has one, and otherwise takes a slide, like opening a gate: a tap never disarms the house.
 */
export class HubbAlarmCard extends LitElement {
  static properties = {
    hass: { attribute: false },
    item: { attribute: false },
    code: { state: true },
    error: { state: true },
    sent: { state: true },
  };

  declare hass: HomeAssistant | undefined;
  declare item: AlarmItem | undefined;
  /** What was typed on the keypad or in the field, never shown in clear. */
  declare code: string;
  declare error: string | null;
  declare sent: Sent | null;

  #timer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    super();
    this.hass = undefined;
    this.item = undefined;
    this.code = '';
    this.error = null;
    this.sent = null;
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this.#timer) clearTimeout(this.#timer);
    this.#timer = null;
  }

  #later(ms: number, then?: () => void): void {
    if (this.#timer) clearTimeout(this.#timer);
    this.#timer = setTimeout(() => {
      this.#timer = null;
      then?.();
      this.requestUpdate();
    }, ms);
  }

  #send(service: string, word: string, code: string | null): void {
    const { hass, item } = this;
    const st = item ? hass?.states[item.entityId] : undefined;
    if (!hass || !item || !st) return;
    haptic('light');
    this.error = null;
    this.sent = { from: st, at: Date.now(), word };
    this.#later(WAIT_MS, () => this.#later(FAILED_MS, () => (this.sent = null)));
    // No toast of Home Assistant on top: the card says what went wrong, in Portuguese.
    hass.callService('alarm_control_panel', service, code ? { code } : undefined, { entity_id: item.entityId }, false).catch((err: unknown) => {
      haptic('failure');
      if (this.#timer) clearTimeout(this.#timer);
      this.sent = null;
      // Home Assistant refuses a wrong code with "Invalid alarm code"; anything else is the panel not answering.
      const message = String((err as { message?: unknown } | null)?.message ?? err);
      this.error = code && /code|c[oó]digo/i.test(message) ? ALARM.wrongCode : S.noResponse;
      this.code = '';
    });
  }

  /** A command on its way: a second tap or slide would send it again. */
  #busy(st: HassEntityState | undefined): boolean {
    return !!this.sent && st === this.sent.from && Date.now() - this.sent.at < WAIT_MS;
  }

  #arm(mode: Mode, st: HassEntityState, format: 'number' | 'text' | null): void {
    const needsCode = !!format && st.attributes.code_arm_required !== false && st.attributes.code_arm_required !== undefined;
    if (needsCode && !this.code) {
      this.error = ALARM.enterCode;
      return;
    }
    this.#send(`alarm_arm_${mode}`, ALARM.state.arming!, needsCode ? this.code : null);
    this.code = '';
  }

  #disarm(format: 'number' | 'text' | null): void {
    if (format && !this.code) {
      this.error = ALARM.enterCode;
      return;
    }
    this.#send('alarm_disarm', ALARM.state.disarming!, format ? this.code : null);
    this.code = '';
  }

  #keypad(format: 'number' | 'text') {
    if (format === 'text') {
      return html`<input
        class="code-input"
        type="password"
        autocomplete="off"
        aria-label=${ALARM.code}
        .value=${this.code}
        @input=${(e: Event) => (this.code = (e.target as HTMLInputElement).value)}
      />`;
    }
    const press = (key: string): void => {
      haptic('selection');
      this.error = null;
      this.code = `${this.code}${key}`;
    };
    // A screen reader ignores a label on a paragraph and reads the dots as bullets: it hears the count.
    return html`<p class="code" aria-hidden="true">${'•'.repeat(this.code.length)}</p>
      <p class="code-said" role="status">${ALARM.codeLength(this.code.length)}</p>
      <div class="keys">
        ${DIGITS.map((d) => html`<button class="key" data-key=${d} @click=${() => press(d)}>${d}</button>`)}
        <button class="erase" @click=${() => (this.code = this.code.slice(0, -1))}>${ALARM.erase}</button>
        <button class="key" data-key="0" @click=${() => press('0')}>0</button>
        <span></span>
      </div>`;
  }

  render() {
    const { hass, item } = this;
    if (!hass || !item) return nothing;
    const st = hass.states[item.entityId];
    const down = !st || st.state === 'unavailable' || st.state === 'unknown';
    const sent = this.sent && st === this.sent.from ? this.sent : null;
    const since = sent ? Date.now() - sent.at : 0;
    const word = down
      ? S.noResponse
      : sent && since < WAIT_MS
        ? sent.word
        : sent && since < WAIT_MS + FAILED_MS
          ? S.noResponse
          : (ALARM.state[st!.state] ?? st!.state);
    const format = !down && (st!.attributes.code_format === 'number' || st!.attributes.code_format === 'text') ? (st!.attributes.code_format as 'number' | 'text') : null;
    const features = Number(st?.attributes.supported_features ?? 0);
    const disarmed = st?.state === 'disarmed';
    const armed = !down && !disarmed && st!.state !== 'disarming';
    const modes = !down && disarmed ? MODES.filter((m) => (features & ALARM_FEATURE[m]) !== 0) : [];
    const armCode = disarmed && !!format && st!.attributes.code_arm_required !== false && st!.attributes.code_arm_required !== undefined;
    const busy = this.#busy(st);
    return html`<div class="card ${st?.state === 'triggered' ? 'triggered' : ''} ${armed ? 'armed' : ''}">
      <div class="head">
        <span class="icon">${icon(disarmed || down ? mdiShieldOffOutline : mdiShieldHome)}</span>
        <span class="text"><span class="name">${item.name}</span><span class="state" role="status">${word}</span></span>
      </div>
      ${this.error ? html`<p class="error" role="alert">${this.error}</p>` : nothing}
      ${modes.length
        ? html`${armCode ? this.#keypad(format!) : nothing}
            <div class="modes">
              ${modes.map((m) => html`<button class="arm" ?disabled=${busy} @click=${() => this.#arm(m, st!, format)}>${ALARM.mode[m]}</button>`)}
            </div>`
        : nothing}
      ${armed
        ? format
          ? html`${this.#keypad(format)}<button class="disarm" ?disabled=${busy} @click=${() => this.#disarm(format)}>${ALARM.disarm}</button>`
          : html`<hubb-slide-confirm .label=${ALARM.slideDisarm} ?disabled=${busy} @hubb-confirm=${() => this.#disarm(null)}></hubb-slide-confirm>`
        : nothing}
    </div>`;
  }

  static styles = css`
    :host {
      display: block;
    }
    .card {
      box-sizing: border-box;
      display: grid;
      gap: 12px;
      padding: 12px;
      border-radius: var(--hubb-radius, 16px);
      background: var(--hubb-surface);
      box-shadow: var(--hubb-card-shadow);
      color: var(--hubb-text);
      font-family: var(--hubb-font);
    }
    .card.armed {
      background: radial-gradient(110% 80% at 15% 0%, var(--hubb-amber-tint), transparent 65%), var(--hubb-on-bg);
    }
    .card.triggered {
      background: var(--hubb-alert-bg);
      color: var(--hubb-alert-ink);
    }
    .head {
      display: flex;
      align-items: center;
      gap: 10px;
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
    .card.armed .icon {
      background: var(--hubb-amber);
      color: var(--hubb-amber-ink);
    }
    .icon svg {
      width: 22px;
      height: 22px;
      fill: currentColor;
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
    .card.armed .state {
      color: var(--hubb-amber-text);
    }
    .card.triggered .state {
      color: inherit;
    }
    .error {
      margin: 0;
      font-size: 12px;
      font-weight: 700;
      color: var(--hubb-amber-text);
    }
    /* On the red of a triggered alarm the amber and the focus colour vanish: the words of the red. */
    .card.triggered .error {
      color: inherit;
    }
    .card.triggered button:focus-visible,
    .card.triggered input:focus-visible {
      outline-color: var(--hubb-alert-ink);
    }
    button[disabled] {
      opacity: 0.45;
      cursor: default;
    }
    .modes {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    button {
      all: unset;
      box-sizing: border-box;
      min-height: 44px;
      padding: 0 16px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 12px;
      background: var(--hubb-surface-2);
      color: var(--hubb-text);
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
    }
    button:focus-visible,
    input:focus-visible {
      outline: 2px solid var(--hubb-focus);
      outline-offset: 2px;
    }
    .disarm {
      width: 100%;
      background: var(--hubb-primary-bg);
      color: var(--hubb-primary-ink);
    }
    .code {
      min-height: 28px;
      margin: 0;
      text-align: center;
      font-size: 24px;
      letter-spacing: 0.3em;
    }
    /* Said, not shown: the dots above are what the eye reads. */
    .code-said {
      position: absolute;
      width: 1px;
      height: 1px;
      margin: -1px;
      overflow: hidden;
      clip: rect(0 0 0 0);
      white-space: nowrap;
    }
    .keys {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 6px;
    }
    .keys button {
      min-height: 52px;
      font-size: 18px;
    }
    .keys .erase {
      font-size: 13px;
    }
    .code-input {
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
  `;
}

define('hubb-alarm-card', HubbAlarmCard);
