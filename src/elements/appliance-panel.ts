import { mdiChevronRight, mdiPause, mdiPlay, mdiPlayCircleOutline, mdiPower, mdiStop } from '@mdi/js';
import { LitElement, css, html, nothing } from 'lit';
import { wakeThenStart } from '../actions/appliance';
import { haptic } from '../actions/haptic';
import { PendingTracker } from '../actions/pending';
import type { HomeAssistant } from '../ha/types';
import { latestHass } from '../latest-hass';
import {
  applianceReach,
  buttonsFor,
  isPoweredOff,
  isShownOption,
  progressPct,
  remainingMinutes,
  situation,
  stateText,
  type ApplianceButton,
  type ApplianceItem,
  type Command,
} from '../model/appliances';
import { displayName } from '../model/names';
import { COMMAND_LABELS, minutesToFinish, REACH, S } from '../strings';
import './action-button';
import { define } from './define';
import './equipment-tile';
import { icon } from './icon';

const COMMAND_ICONS: Record<Command, string> = {
  on: mdiPower,
  off: mdiPower,
  start: mdiPlay,
  pause: mdiPause,
  resume: mdiPlay,
  stop: mdiStop,
  other: mdiPlayCircleOutline,
};

/** The maker's cloud refused the call: the integration lost its login (Electrolux answers 401). */
const LOST_ACCESS = /\b40[13]\b|unauthori[sz]ed|forbidden/i;

/** The appliance sheet: how long is left, the commands that make sense now, the choices and the options. */
export class HubbAppliancePanel extends LitElement {
  static properties = {
    hass: { attribute: false },
    item: { attribute: false },
    failed: { state: true },
  };

  declare hass: HomeAssistant | undefined;
  declare item: ApplianceItem | undefined;
  /** The last call from this sheet failed; `access` when the maker's cloud refused it. */
  declare failed: 'plain' | 'access' | null;

  /** The choice asked for, until Home Assistant confirms it; the same 3 s wait as the tiles. */
  #tracker = new PendingTracker();
  #refresh: ReturnType<typeof setTimeout> | null = null;
  #quiet: { from: HomeAssistant; to: HomeAssistant } | null = null;

  constructor() {
    super();
    this.hass = undefined;
    this.item = undefined;
    this.failed = null;
  }

  /**
   * The hass this sheet hands to its buttons and options: the same, except that a failed call shows
   * one line here instead of a toast of Home Assistant per tap, in English and with the cloud's URL.
   */
  #quietHass(hass: HomeAssistant): HomeAssistant {
    if (this.#quiet?.from === hass) return this.#quiet.to;
    const to: HomeAssistant = {
      ...hass,
      callService: (domain, service, data, target) =>
        hass.callService(domain, service, data, target, false).then(
          (answer) => {
            this.failed = null;
            return answer;
          },
          (err: unknown) => {
            const message = String((err as { message?: unknown } | null)?.message ?? err);
            this.failed = LOST_ACCESS.test(message) ? 'access' : 'plain';
            throw err;
          },
        ),
    };
    this.#quiet = { from: hass, to };
    return to;
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this.#refresh) clearTimeout(this.#refresh);
    this.#refresh = null;
  }

  protected updated(): void {
    if (this.#refresh) clearTimeout(this.#refresh);
    this.#refresh = null;
    const waits = (this.item?.parts.selects ?? [])
      .map((id) => this.#tracker.msUntilChange(id))
      .filter((ms): ms is number => ms !== null);
    if (waits.length && this.isConnected) this.#refresh = setTimeout(() => this.requestUpdate(), Math.min(...waits) + 20);
  }

  #choose(entityId: string, option: string): void {
    const hass = this.hass;
    const st = hass?.states[entityId];
    if (!hass || !st || option === (this.#tracker.expected(entityId) ?? st.state)) return;
    // Taking back a choice still waiting: the current option is already confirmed, show it at once.
    this.#tracker.start(entityId, option, option === st.state ? undefined : st);
    haptic('light');
    this.requestUpdate();
    this.#quietHass(hass)
      .callService('select', 'select_option', { option }, { entity_id: entityId })
      .catch(() => haptic('failure'));
  }

  #command(hass: HomeAssistant, button: ApplianceButton, disabled: boolean, wake: string | null) {
    const name = button.command === 'other' ? displayName(hass, button.entityId, null) : COMMAND_LABELS[button.command];
    const parts = this.item!.parts;
    const run =
      button.command === 'start' && wake
        ? (h: HomeAssistant) => wakeThenStart(h, () => latestHass() ?? this.hass, parts, wake, button.entityId)
        : null;
    return html`<hubb-action-button
      .hass=${this.#quietHass(hass)}
      .item=${{ entityId: button.entityId, name, icon: null }}
      .path=${COMMAND_ICONS[button.command]}
      .disabled=${disabled}
      .run=${run}
    ></hubb-action-button>`;
  }

  #choice(hass: HomeAssistant, entityId: string) {
    const st = hass.states[entityId]!;
    const options = Array.isArray(st.attributes.options)
      ? st.attributes.options.filter((o): o is string => typeof o === 'string')
      : [];
    const status = this.#tracker.status(entityId, st.state, st);
    const shown = (status === 'pending' ? this.#tracker.expected(entityId) : null) ?? st.state;
    const label = (option: string): string => (hass.formatEntityState ? hass.formatEntityState(st, option) : option);
    const name = displayName(hass, entityId, null);
    return html`<label class="choice">
      <span class="name">${name}</span>
      <span class="value ${status}">${status === 'failed' ? S.noResponse : label(shown)}</span>
      ${icon(mdiChevronRight)}
      <select aria-label=${name} .value=${shown} @change=${(e: Event) => this.#choose(entityId, (e.target as HTMLSelectElement).value)}>
        ${options.map((o) => html`<option value=${o} ?selected=${o === shown}>${label(o)}</option>`)}
      </select>
    </label>`;
  }

  render() {
    const { hass, item } = this;
    if (!hass || !item) return nothing;
    const { parts } = item;
    const now = situation(hass, parts);
    const minutes = remainingMinutes(hass, parts);
    const text = stateText(hass, parts, item.name);
    const timed = now !== 'stopped' && minutes !== null && minutes > 0 ? minutesToFinish(minutes) : null;
    const pct = now === 'working' ? progressPct(hass, parts) : null;
    const off = isPoweredOff(hass, parts);
    const { main, more } = buttonsFor(parts, now, off);
    // Switched off, Iniciar switches it on first: Iniciar alone is ignored (Electrolux, 22/10).
    const wake = off ? (parts.buttons.find((b) => b.command === 'on')?.entityId ?? null) : null;
    // One row: the commands that make sense now first, then the stop and the others (Gustavo, 13/10).
    const commands = [...main, ...more];
    const selects = parts.selects.filter((id) => isShownOption(hass, id));
    // An option the current program does not take comes as unavailable: it leaves the sheet.
    const switches = parts.switches.filter((id) => isShownOption(hass, id));
    const reach = applianceReach(hass, parts);
    const notice = reach === 'offline' ? REACH.offlineHint : reach === 'remote-off' ? REACH.remoteOffHint : null;
    return html`<div class="now">
        <strong>${timed ?? text ?? S.noState}</strong>
        ${timed && text ? html`<span>${text}</span>` : nothing}
        ${pct !== null ? html`<span class="bar"><span style="width:${pct}%"></span></span>` : nothing}
      </div>
      ${notice ? html`<p class="notice" role="status">${notice}</p>` : nothing}
      ${this.failed
        ? html`<p class="failed" role="alert">
            ${REACH.failed(item.name)} ${this.failed === 'access' && hass.user?.is_admin ? REACH.lostAccess : nothing}
          </p>`
        : nothing}
      ${commands.length
        ? html`<div class="commands" style="grid-template-columns: repeat(${Math.min(commands.length, 3)}, minmax(0, 1fr))">
            ${commands.map((b) => this.#command(hass, b, reach !== 'ok', wake))}
          </div>`
        : nothing}
      ${selects.length ? html`<div class="choices">${selects.map((id) => this.#choice(hass, id))}</div>` : nothing}
      ${switches.length
        ? html`<div class="options">
            ${switches.map(
              (id) =>
                html`<hubb-equipment-tile
                  .hass=${this.#quietHass(hass)}
                  .item=${{ entityId: id, name: displayName(hass, id, null), icon: null }}
                ></hubb-equipment-tile>`,
            )}
          </div>`
        : nothing}`;
  }

  static styles = css`
    :host {
      display: block;
      font-family: var(--hubb-font);
      color: var(--hubb-text);
    }
    .now {
      display: grid;
      gap: 4px;
      margin: 4px 2px 14px;
    }
    .now strong {
      font-size: 24px;
      font-weight: 800;
      letter-spacing: -0.02em;
    }
    .now span {
      font-size: 13px;
      font-weight: 600;
      color: var(--hubb-text-2);
    }
    .bar {
      display: block;
      height: 6px;
      margin-top: 6px;
      border-radius: 3px;
      background: var(--hubb-surface-2);
      overflow: hidden;
    }
    .bar span {
      display: block;
      height: 100%;
      background: var(--hubb-amber);
    }
    .commands {
      display: grid;
      gap: 8px;
    }
    .notice,
    .failed {
      margin: 0 0 12px;
      padding: 10px 12px;
      border-radius: 12px;
      background: var(--hubb-surface);
      font-size: 12px;
      font-weight: 600;
      line-height: 1.4;
      color: var(--hubb-text-2);
    }
    .failed {
      color: var(--hubb-amber-text);
    }
    .choices {
      display: grid;
      gap: 8px;
      margin-top: 16px;
    }
    .choice {
      position: relative;
      box-sizing: border-box;
      display: flex;
      align-items: center;
      gap: 8px;
      min-height: 52px;
      padding: 0 12px;
      border-radius: 14px;
      background: var(--hubb-surface);
      box-shadow: var(--hubb-card-shadow);
      cursor: pointer;
    }
    .choice:focus-within {
      outline: 2px solid var(--hubb-focus);
      outline-offset: 2px;
    }
    .choice .name {
      flex: 1;
      font-weight: 700;
      font-size: 13px;
    }
    .choice .value {
      font-weight: 600;
      font-size: 13px;
      color: var(--hubb-text-2);
    }
    .choice .value.pending {
      color: var(--hubb-amber-text);
    }
    .choice svg {
      width: 18px;
      height: 18px;
      fill: var(--hubb-text-2);
    }
    /* The native list of the phone opens over the whole row. */
    .choice select {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      opacity: 0;
      cursor: pointer;
    }
    /* Two columns: the option names ("Turbo centrifugação") fit without being cut. */
    .options {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
      margin-top: 16px;
    }
  `;
}

define('hubb-appliance-panel', HubbAppliancePanel);
