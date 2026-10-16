import { mdiGate, mdiGateOpen, mdiLock, mdiLockOpenVariant } from '@mdi/js';
import { LitElement, css, html, nothing } from 'lit';
import { pressAction } from '../actions/action';
import { haptic } from '../actions/haptic';
import type { HassEntityState, HomeAssistant } from '../ha/types';
import { relayPulsedAt, sensorPosition, type GatePosition } from '../model/gate-sensor';
import type { AccessItem } from '../model/types';
import { ACCESS, S } from '../strings';
import { define } from './define';
import { icon } from './icon';
import './slide-confirm';

/** As long as the tiles of the lights: the wait for an answer, then "Sem resposta" for a while. */
const WAIT_MS = 3000;
const FAILED_MS = 4000;
const RESULT_MS = 2000;
/** How long a gate with a sensor may take to move after a pulse before the card shows the sensor again. */
const MOVE_MS = 90_000;
/** A pulse read on the relay this close to one this phone sent is that same pulse, coming back. */
const OWN_MS = 10_000;

type Ask = 'open' | 'close' | 'unlock' | 'lock';

/**
 * A pulse a gate with a sensor is waiting on: the way it should go (null for a bare pulse, which may
 * stop or turn the gate), and the sensor state it left from.
 */
interface Moving {
  ask: 'open' | 'close' | null;
  from: string;
  at: number;
}

/** What every card of one pulse relay with a sensor knows on this phone: the room and Segurança agree. */
interface Pulses {
  /** When the last pulse left, for the guard against a second one. */
  at: number;
  moving: Moving | null;
  /** The last pulse read on the relay itself, by its own clock, so it counts once. */
  seen: number | null;
  /** When this phone last sent one, so the relay showing it is not read as another phone's. */
  own: number;
}

/**
 * Keyed like the users of people.ts, by the callService of the house: the copy of `hass` the frontend
 * hands on every change keeps it, another Home Assistant starts clean.
 */
const pulses = new WeakMap<HomeAssistant['callService'], Map<string, Pulses>>();

function pulsesOf(hass: HomeAssistant, relayId: string): Pulses {
  let house = pulses.get(hass.callService);
  if (!house) pulses.set(hass.callService, (house = new Map()));
  let known = house.get(relayId);
  if (!known) house.set(relayId, (known = { at: 0, moving: null, seen: null, own: 0 }));
  return known;
}

interface Sent {
  ask: Ask;
  /** The state object on screen when the command left: any newer one is the answer. */
  from: HassEntityState | undefined;
  at: number;
}

/**
 * A gate, a door or a lock. Opening takes a slide, never a tap; closing and locking are a tap. A
 * pulse relay (a switch, button or script with the gate role) fires with the slide and says "Feito";
 * with a sensor it says Aberto or Fechado, and waits for the sensor after each pulse.
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
  /** The next moment the card changes by itself, re-armed after every render. */
  #deadline: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    super();
    this.hass = undefined;
    this.item = undefined;
    this.sent = null;
    this.result = null;
  }

  connectedCallback(): void {
    super.connectedCallback();
    // A view switch disconnects the card and drops its timers: what ended meanwhile ends now.
    if (this.result === 'done' || this.result === 'failed') this.result = null;
    this.requestUpdate();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this.#timer) clearTimeout(this.#timer);
    this.#timer = null;
    if (this.#deadline) clearTimeout(this.#deadline);
    this.#deadline = null;
  }

  protected willUpdate(): void {
    const { hass, item } = this;
    const known = this.#pulses();
    if (!hass || !item?.sensor || !known) return;
    const sensor = hass.states[item.sensor];
    // Once the sensor moves, the wait is over for good: a gate closed again by the remote is not "Abrindo…".
    if (known.moving && sensor?.state !== known.moving.from) known.moving = null;
    // A pulse read on the relay after the sensor last moved: another phone, an automation, or this one.
    const seen = relayPulsedAt(hass, item.entityId);
    if (seen === null || seen === known.seen) return;
    known.seen = seen;
    // This phone's own pulse coming back: it already has its wait, or knowingly none (a bare pulse).
    if (known.own && Math.abs(seen - known.own) < OWN_MS) return;
    const now = Date.now();
    const age = Math.max(0, now - seen);
    const sensorAt = Date.parse(sensor?.last_changed ?? '');
    const position = sensorPosition(hass, item.sensor);
    if (this.#waiting() || seen <= sensorAt || age >= MOVE_MS || !sensor || (position !== 'open' && position !== 'closed')) return;
    known.moving = { ask: position === 'closed' ? 'open' : 'close', from: sensor.state, at: now - age };
    known.at = Math.max(known.at, now - age);
  }

  protected updated(): void {
    this.#arm();
  }

  /** One timer for the next change the card makes by itself: the guard ends, the wait runs out, "Sem resposta" goes. */
  #arm(): void {
    if (this.#deadline) clearTimeout(this.#deadline);
    this.#deadline = null;
    if (!this.isConnected) return;
    const now = Date.now();
    const known = this.#pulses();
    const waiting = this.#waiting();
    const sent = this.sent;
    const ends = [
      known ? known.at + WAIT_MS : 0,
      waiting ? waiting.at + MOVE_MS : 0,
      sent ? sent.at + WAIT_MS : 0,
      sent ? sent.at + WAIT_MS + FAILED_MS : 0,
    ].filter((t) => t > now);
    if (!ends.length) return;
    this.#deadline = setTimeout(
      () => {
        this.#deadline = null;
        this.requestUpdate();
      },
      Math.min(...ends) - now,
    );
  }

  /** What this phone knows of the pulses of a relay with a sensor; null for anything else. */
  #pulses(): Pulses | null {
    const { hass, item } = this;
    return hass && item?.kind === 'pulse' && item.sensor ? pulsesOf(hass, item.entityId) : null;
  }

  /** Where the gate of a pulse relay is by its sensor; null with no sensor, or one that does not answer. */
  #position(): GatePosition | null {
    const { hass, item } = this;
    return hass && item?.kind === 'pulse' && item.sensor ? sensorPosition(hass, item.sensor) : null;
  }

  /** The move still awaited: until the sensor leaves the state the pulse found, for MOVE_MS at most. */
  #waiting(): Moving | null {
    const moving = this.#pulses()?.moving;
    const sensor = this.item?.sensor;
    if (!moving || !sensor) return null;
    return this.hass?.states[sensor]?.state === moving.from && Date.now() - moving.at < MOVE_MS ? moving : null;
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

  /**
   * One pulse. With a sensor and a known way to go, every card of the gate then waits for the sensor;
   * with none, or a pulse that cannot say which way the gate goes (it may stop it), it says "Feito".
   */
  #pulse(ask: 'open' | 'close' | null = null): void {
    const { hass, item } = this;
    if (!hass || !item) return;
    const domain = item.entityId.slice(0, item.entityId.indexOf('.'));
    const call = domain === 'switch' ? hass.callService('switch', 'turn_on', undefined, { entity_id: item.entityId }) : pressAction(hass, item.entityId);
    const known = this.#pulses();
    const from = item.sensor ? hass.states[item.sensor]?.state : undefined;
    const at = Date.now();
    // A bare pulse waits too, with no way to go: until the sensor moves, the card promises nothing.
    const moving: Moving | null = known && from !== undefined ? { ask, from, at } : null;
    if (known) {
      known.at = at;
      known.own = at;
      known.moving = moving;
    }
    this.result = 'sending';
    // The answer stays its full time however long it took to come.
    const show = (result: 'done' | 'failed'): void => {
      this.result = result;
      this.#later(RESULT_MS, () => (this.result = null));
    };
    call.then(
      () => {
        if (moving?.ask) this.result = null;
        else show('done');
      },
      () => {
        haptic('failure');
        // No wait and no guard against the next try; the relay is read again, in case it fired anyway.
        if (known && known.at === at) {
          known.at = 0;
          known.own = 0;
          known.seen = null;
          if (known.moving === moving) known.moving = null;
        }
        show('failed');
      },
    );
  }

  /** Whether a command is still on its way: a second slide would pulse the gate again, or stop it. */
  #busy(st: HassEntityState | undefined): boolean {
    if (this.result !== null) return true;
    const known = this.#pulses();
    if (known && Date.now() - known.at < WAIT_MS) return true;
    const sent = this.sent;
    return !!sent && st === sent.from && Date.now() - sent.at < WAIT_MS;
  }

  #onConfirm = (): void => {
    const item = this.item;
    if (!item || this.#busy(this.hass?.states[item.entityId])) return;
    if (item.kind !== 'pulse') return this.#send(item.kind === 'lock' ? 'unlock' : 'open');
    // Only a gate its sensor says is closed opens; one on its way, or with a silent sensor, gets a bare pulse.
    this.#pulse(!this.#waiting() && this.#position() === 'closed' ? 'open' : null);
  };

  #onClose = (): void => {
    const item = this.item;
    if (!item) return;
    if (item.kind !== 'pulse') return this.#send(item.kind === 'lock' ? 'lock' : 'close');
    // The one tap that pulses a gate: checked again here, on the state of this very moment.
    if (this.#busy(this.hass?.states[item.entityId]) || this.#waiting() || this.#position() !== 'open') return;
    this.#pulse('close');
  };

  /** The words under the name: waiting, failed, or the state; null when the device does not say. */
  #stateText(st: HassEntityState | undefined, item: AccessItem): string | null {
    if (!st || st.state === 'unavailable') return S.noResponse;
    if (item.kind === 'pulse') {
      if (this.result === 'failed') return S.noResponse;
      if (!item.sensor) return this.result === 'done' ? S.done : null;
      const ask = this.#waiting()?.ask;
      if (ask) return ACCESS.pending[ask];
      if (this.result === 'done') return S.done;
      const position = this.#position();
      return position ? (ACCESS.cover[position] ?? S.noResponse) : S.noResponse;
    }
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
    const position = down ? null : this.#position();
    if (item.kind === 'pulse') {
      // With a sensor: closed opens by sliding, open closes with a tap. Moving, on its way after a
      // pulse, or with a silent sensor, the next pulse may stop it: a bare pulse, and only by sliding.
      const still = !this.#waiting();
      if (still && position === 'open') tapLabel = ACCESS.close;
      else if (still && position === 'closed') slideLabel = ACCESS.slideOpen;
      else slideLabel = ACCESS.slideTrigger;
    } else if (item.kind === 'lock') {
      if (state === 'locked' || state === 'jammed' || down) slideLabel = ACCESS.slideUnlock;
      if (state !== 'locked' && !down) tapLabel = ACCESS.lock;
    } else {
      if (state !== 'open' && state !== 'opening') slideLabel = ACCESS.slideOpen;
      // Only a gate known to be open closes with a tap: many gates are a template cover over one
      // pulse relay, and on a gate of unknown state "Fechar" could open it.
      if (state === 'open' || state === 'opening') tapLabel = ACCESS.close;
    }
    const opened =
      item.kind === 'lock'
        ? state === 'unlocked' || state === 'open'
        : item.kind === 'pulse'
          ? position === 'open' || position === 'opening'
          : state === 'open' || state === 'opening';
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
              ? html`<button class="close" ?disabled=${item.kind === 'pulse' && this.#busy(st)} @click=${this.#onClose}>${tapLabel}</button>`
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
    .close[disabled] {
      cursor: default;
      opacity: 0.45;
    }
    .close:focus-visible {
      outline: 2px solid var(--hubb-focus);
      outline-offset: 2px;
    }
  `;
}

define('hubb-access-tile', HubbAccessTile);
