import { mdiGate, mdiGateOpen, mdiLock, mdiLockOpenVariant } from '@mdi/js';
import { LitElement, css, html, nothing } from 'lit';
import { pressAction } from '../actions/action';
import { haptic } from '../actions/haptic';
import type { HassEntityState, HomeAssistant } from '../ha/types';
import type { AccessItem } from '../model/types';
import { ACCESS, S } from '../strings';
import { define } from './define';
import { icon } from './icon';
import './slide-confirm';

/** As long as the tiles of the lights: the wait for an answer, then "Sem resposta" for a while. */
const WAIT_MS = 3000;
const FAILED_MS = 4000;
const RESULT_MS = 2000;

type Ask = 'open' | 'close' | 'unlock' | 'lock';

interface Sent {
  ask: Ask;
  /** The state object on screen when the command left: any newer one is the answer. */
  from: HassEntityState | undefined;
  at: number;
}

/**
 * A gate, a door or a lock. Opening takes a slide, never a tap; closing and locking are a tap. A
 * pulse relay (a switch, button or script with the gate role) fires with the slide and says "Feito".
 */
export class HubbAccessTile extends LitElement {
  static properties = {
    hass: { attribute: false },
    item: { attribute: false },
    sent: { state: true },
    result: { state: true },
  };

  declare hass: HomeAssistant | undefined;
  declare item: AccessItem | undefined;
  declare sent: Sent | null;
  /** A pulse: on its way, then its answer for a moment. */
  declare result: 'sending' | 'done' | 'failed' | null;

  #timer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    super();
    this.hass = undefined;
    this.item = undefined;
    this.sent = null;
    this.result = null;
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this.#timer) clearTimeout(this.#timer);
    this.#timer = null;
  }

  /** Redraws when the wait ends and when "Sem resposta" ends. */
  #later(ms: number, then?: () => void): void {
    if (this.#timer) clearTimeout(this.#timer);
    this.#timer = setTimeout(() => {
      this.#timer = null;
      then?.();
      this.requestUpdate();
    }, ms);
  }

  #send(ask: Ask): void {
    const { hass, item } = this;
    if (!hass || !item) return;
    const domain = item.entityId.slice(0, item.entityId.indexOf('.'));
    const service = { open: 'open_cover', close: 'close_cover', unlock: 'unlock', lock: 'lock' }[ask];
    this.sent = { ask, from: hass.states[item.entityId], at: Date.now() };
    this.#later(WAIT_MS, () => this.#later(FAILED_MS, () => (this.sent = null)));
    hass.callService(domain, service, undefined, { entity_id: item.entityId }).catch(() => haptic('failure'));
  }

  #pulse(): void {
    const { hass, item } = this;
    if (!hass || !item) return;
    const domain = item.entityId.slice(0, item.entityId.indexOf('.'));
    const call = domain === 'switch' ? hass.callService('switch', 'turn_on', undefined, { entity_id: item.entityId }) : pressAction(hass, item.entityId);
    this.result = 'sending';
    // The answer stays its full time however long it took to come.
    const show = (result: 'done' | 'failed'): void => {
      this.result = result;
      this.#later(RESULT_MS, () => (this.result = null));
    };
    call.then(
      () => show('done'),
      () => {
        haptic('failure');
        show('failed');
      },
    );
  }

  /** Whether a command is still on its way: a second slide would pulse the gate again, or stop it. */
  #busy(st: HassEntityState | undefined): boolean {
    if (this.result !== null) return true;
    const sent = this.sent;
    return !!sent && st === sent.from && Date.now() - sent.at < WAIT_MS;
  }

  #onConfirm = (): void => {
    const item = this.item;
    if (!item || this.#busy(this.hass?.states[item.entityId])) return;
    if (item.kind === 'pulse') this.#pulse();
    else this.#send(item.kind === 'lock' ? 'unlock' : 'open');
  };

  /** The words under the name: waiting, failed, or the state; null when the device does not say. */
  #stateText(st: HassEntityState | undefined, item: AccessItem): string | null {
    if (!st || st.state === 'unavailable') return S.noResponse;
    if (item.kind === 'pulse') return this.result === 'done' ? S.done : this.result === 'failed' ? S.noResponse : null;
    const sent = this.sent;
    if (sent && st === sent.from) {
      const since = Date.now() - sent.at;
      if (since < WAIT_MS) return ACCESS.pending[sent.ask];
      if (since < WAIT_MS + FAILED_MS) return S.noResponse;
    }
    const words = item.kind === 'lock' ? ACCESS.lockState : ACCESS.cover;
    return words[st.state] ?? null;
  }

  render() {
    const { hass, item } = this;
    if (!hass || !item) return nothing;
    const st = hass.states[item.entityId];
    const down = !st || st.state === 'unavailable';
    const state = st?.state ?? '';
    const text = this.#stateText(st, item);
    let slideLabel: string | null = null;
    let tapLabel: string | null = null;
    if (item.kind === 'pulse') slideLabel = ACCESS.slideTrigger;
    else if (item.kind === 'lock') {
      if (state === 'locked' || state === 'jammed' || down) slideLabel = ACCESS.slideUnlock;
      if (state !== 'locked' && !down) tapLabel = ACCESS.lock;
    } else {
      if (state !== 'open' && state !== 'opening') slideLabel = ACCESS.slideOpen;
      // Only a gate known to be open closes with a tap: many gates are a template cover over one
      // pulse relay, and on a gate of unknown state "Fechar" could open it.
      if (state === 'open' || state === 'opening') tapLabel = ACCESS.close;
    }
    const opened = item.kind === 'lock' ? state === 'unlocked' || state === 'open' : state === 'open' || state === 'opening';
    const glyph = item.kind === 'lock' ? (opened ? mdiLockOpenVariant : mdiLock) : opened ? mdiGateOpen : mdiGate;
    return html`<div class="card ${opened ? 'on' : ''} ${down ? 'na' : ''}">
      <div class="head">
        <span class="icon">${icon(glyph)}</span>
        <span class="text"
          ><span class="name">${item.name}</span>${text !== null ? html`<span class="state" role="status">${text}</span>` : nothing}</span
        >
      </div>
      ${slideLabel !== null || tapLabel !== null
        ? html`<div class="controls">
            ${slideLabel !== null
              ? html`<hubb-slide-confirm .label=${slideLabel} ?disabled=${down || this.#busy(st)} @hubb-confirm=${this.#onConfirm}></hubb-slide-confirm>`
              : nothing}
            ${tapLabel !== null
              ? html`<button class="close" @click=${() => this.#send(item.kind === 'lock' ? 'lock' : 'close')}>${tapLabel}</button>`
              : nothing}
          </div>`
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
    .card.on {
      background: radial-gradient(110% 80% at 15% 0%, var(--hubb-amber-tint), transparent 65%), var(--hubb-on-bg);
    }
    .card.na {
      background: transparent;
      border: 1.5px dashed color-mix(in srgb, var(--hubb-text-2) 55%, transparent);
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
    .card.on .icon {
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
    .card.on .state {
      color: var(--hubb-amber-text);
    }
    .controls {
      display: flex;
      gap: 8px;
      align-items: center;
    }
    hubb-slide-confirm {
      flex: 1;
    }
    .close {
      all: unset;
      box-sizing: border-box;
      min-height: 52px;
      padding: 0 18px;
      display: grid;
      place-items: center;
      border-radius: 26px;
      background: var(--hubb-surface-2);
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
    }
    .controls .close:only-child {
      flex: 1;
    }
    .close:focus-visible {
      outline: 2px solid var(--hubb-focus);
      outline-offset: 2px;
    }
  `;
}

define('hubb-access-tile', HubbAccessTile);
