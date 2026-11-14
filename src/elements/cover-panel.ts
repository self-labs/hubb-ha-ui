import { mdiCurtains, mdiCurtainsClosed, mdiStop, mdiTelevision, mdiTelevisionOff } from '@mdi/js';
import { LitElement, css, html, nothing } from 'lit';
import { has } from '../actions/climate';
import { haptic } from '../actions/haptic';
import { isInfrared } from '../ha/infrared';
import type { HassEntityState, HomeAssistant } from '../ha/types';
import { COVER, COVER_SHEET, FLAP, S } from '../strings';
import { COVER_FEATURE, coverWords } from './cover-tile';
import { define } from './define';
import { icon } from './icon';

/** How long the sheet keeps saying what it has just sent. */
const ANSWER_MS = 4000;
/** What was asked of the position stays on the track this long if the cover does not say it. */
const CONFIRM_MS = 3000;
/** Quiet time after the last key before the position is sent. */
const KEY_SEND_MS = 250;

type Command = 'open' | 'stop' | 'close' | 'position';
interface Answer {
  command: Command;
  phase: 'sending' | 'sent' | 'failed';
  line: string;
}

/** Where along the track a finger is, from 0 to 100. */
export function pctFromPointerX(clientX: number, left: number, width: number): number {
  if (width <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round(((clientX - left) / width) * 100)));
}

/** How open the cover is, from 0 to 1: its position when it reports one, else open or closed. */
function openFraction(st: HassEntityState): number {
  const p = st.attributes.current_position;
  if (typeof p === 'number') return Math.min(100, Math.max(0, p)) / 100;
  return st.state === 'open' || st.state === 'opening' ? 1 : 0;
}

/**
 * The sheet of a curtain or a flap: a drawing of how open it is, Abrir, Parar and Fechar as big buttons
 * that answer in colour, and a track for the position when the cover has one.
 */
export class HubbCoverPanel extends LitElement {
  static properties = {
    hass: { attribute: false },
    entityId: { attribute: false },
    kind: { attribute: false },
    answer: { state: true },
    dragPct: { state: true },
  };

  declare hass: HomeAssistant | undefined;
  declare entityId: string;
  /** A flap says its words in the masculine and comes down like a TV; anything else is a curtain. */
  declare kind: 'cover' | 'flap';
  /** The last command sent and how it went, shown for ANSWER_MS. */
  declare answer: Answer | null;
  /** Where the finger or the keys have the track, until the position is sent. */
  declare dragPct: number | null;

  #dragging = false;
  #answerTimer: ReturnType<typeof setTimeout> | null = null;
  /** Which command the answer belongs to, so a slow reply to an old one does not speak for the new one. */
  #token = 0;
  /** The position last asked, shown until the cover reports it or CONFIRM_MS pass. */
  #pending: { pct: number; at: number } | null = null;
  #pendingTimer: ReturnType<typeof setTimeout> | null = null;
  #keyTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    super();
    this.hass = undefined;
    this.entityId = '';
    this.kind = 'cover';
    this.answer = null;
    this.dragPct = null;
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    for (const t of [this.#answerTimer, this.#pendingTimer]) if (t) clearTimeout(t);
    this.#answerTimer = null;
    this.#pendingTimer = null;
    // The sheet closed right after a key: the position the resident chose still goes out.
    if (this.#keyTimer) {
      clearTimeout(this.#keyTimer);
      this.#keyTimer = null;
      const pct = this.dragPct;
      this.dragPct = null;
      if (pct !== null) this.#call('set_cover_position', { position: pct }).catch(() => haptic('failure'));
    }
  }

  #call(service: string, data?: Record<string, unknown>): Promise<unknown> {
    if (!this.hass) return Promise.resolve();
    return this.hass.callService('cover', service, data, { entity_id: this.entityId });
  }

  /** Sends a command and shows how it went: asked, then heard, or not. */
  #send(command: Command, service: string, line: string, data?: Record<string, unknown>): void {
    if (!this.hass) return;
    const token = ++this.#token;
    haptic('light');
    this.#say({ command, phase: 'sending', line });
    this.#call(service, data).then(
      () => {
        if (token === this.#token) this.#say({ command, phase: 'sent', line });
      },
      () => {
        haptic('failure');
        if (token === this.#token) this.#say({ command, phase: 'failed', line: COVER_SHEET.failed });
      },
    );
  }

  /** Shows an answer and forgets it after ANSWER_MS. */
  #say(answer: Answer): void {
    this.answer = answer;
    if (this.#answerTimer) clearTimeout(this.#answerTimer);
    this.#answerTimer = setTimeout(() => (this.answer = null), ANSWER_MS);
  }

  #applyPosition(pct: number): void {
    this.#pending = { pct, at: Date.now() };
    if (this.#pendingTimer) clearTimeout(this.#pendingTimer);
    this.#pendingTimer = setTimeout(() => this.requestUpdate(), CONFIRM_MS + 50);
    this.#send('position', 'set_cover_position', COVER_SHEET.positionSent(pct), { position: pct });
  }

  /** The position the track shows: the finger, else what was asked while it has not come, else the cover's own. */
  #current(actual: number): number {
    if (this.dragPct !== null) return this.dragPct;
    if (this.#pending === null) return actual;
    // The cover may round what it reports by a point.
    if (Math.abs(actual - this.#pending.pct) <= 1 || Date.now() - this.#pending.at >= CONFIRM_MS) {
      this.#pending = null;
      return actual;
    }
    return this.#pending.pct;
  }

  #down = (e: PointerEvent): void => {
    if (e.button > 0) return;
    this.#dragging = true;
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    this.#follow(e);
  };

  #move = (e: PointerEvent): void => {
    if (this.#dragging) this.#follow(e);
  };

  #follow(e: PointerEvent): void {
    const r = (e.currentTarget as Element).getBoundingClientRect();
    this.dragPct = pctFromPointerX(e.clientX, r.left, r.width);
  }

  /** One action per drag: the position goes out when the finger lifts. */
  #up = (): void => {
    if (!this.#dragging) return;
    this.#dragging = false;
    const pct = this.dragPct;
    this.dragPct = null;
    if (pct !== null) this.#applyPosition(pct);
  };

  /** The system took the finger (a scroll, a call): nothing was chosen. */
  #cancel = (): void => {
    this.#dragging = false;
    this.dragPct = null;
  };

  /** The slider keys: arrows step 5, Page keys step 25, Home closes, End opens. */
  #key = (e: KeyboardEvent, actual: number): void => {
    const steps: Record<string, number> = { ArrowUp: 5, ArrowRight: 5, ArrowDown: -5, ArrowLeft: -5, PageUp: 25, PageDown: -25 };
    let next: number | null = null;
    if (e.key in steps) next = this.#current(actual) + steps[e.key]!;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = 100;
    if (next === null) return;
    e.preventDefault();
    this.dragPct = Math.min(100, Math.max(0, next));
    if (this.#keyTimer) clearTimeout(this.#keyTimer);
    this.#keyTimer = setTimeout(() => {
      this.#keyTimer = null;
      const pct = this.dragPct;
      this.dragPct = null;
      if (pct !== null) this.#applyPosition(pct);
    }, KEY_SEND_MS);
  };

  #button(command: Exclude<Command, 'position'>, st: HassEntityState, label: string, path: string, onClick: () => void) {
    const { answer } = this;
    const mine = answer?.command === command;
    const moving = (command === 'open' && st.state === 'opening') || (command === 'close' && st.state === 'closing');
    const classes = ['cmd', command, mine && answer.phase !== 'failed' ? 'on' : '', mine && answer.phase === 'failed' ? 'failed' : '', moving ? 'moving' : ''];
    return html`<button class=${classes.filter(Boolean).join(' ')} @click=${onClick}>${icon(path)}<span>${label}</span></button>`;
  }

  render() {
    const st = this.hass?.states[this.entityId];
    if (!st) return nothing;
    if (st.state === 'unavailable') return html`<p class="now">${S.noResponse}</p>`;
    const flap = this.kind === 'flap';
    const words = flap ? FLAP : COVER;
    const track = has(st, COVER_FEATURE.position);
    const actual = Math.round(openFraction(st) * 100);
    const shown = track ? this.#current(actual) : actual;
    const open = flap ? [mdiTelevision, mdiTelevisionOff] : [mdiCurtains, mdiCurtainsClosed];
    return html`<div class="hero ${flap ? 'flap' : 'curtain'}" style="--open:${shown / 100}" aria-hidden="true">
        ${flap
          ? html`<span class="light"></span><span class="slot"></span><span class="tv"><span class="screen"></span><span class="led"></span></span>`
          : html`<span class="light"></span><span class="rod"></span><span class="panel left"></span><span class="panel right"></span>`}
      </div>
      <p class="now">${coverWords(st, words)}</p>
      <p class="status ${this.answer?.phase === 'failed' ? 'bad' : ''}" aria-live="polite">${this.answer?.line ?? ''}</p>
      <div class="row">
        ${has(st, COVER_FEATURE.open) ? this.#button('open', st, words.doOpen, open[0]!, () => this.#send('open', 'open_cover', COVER_SHEET.sent(words.doOpen))) : nothing}
        ${has(st, COVER_FEATURE.stop) ? this.#button('stop', st, words.doStop, mdiStop, () => this.#send('stop', 'stop_cover', COVER_SHEET.sent(words.doStop))) : nothing}
        ${has(st, COVER_FEATURE.close) ? this.#button('close', st, words.doClose, open[1]!, () => this.#send('close', 'close_cover', COVER_SHEET.sent(words.doClose))) : nothing}
      </div>
      ${track
        ? html`<p class="label">${words.position}</p>
            <div
              class="track"
              role="slider"
              aria-label=${words.position}
              aria-valuemin="0"
              aria-valuemax="100"
              aria-valuenow=${shown}
              tabindex="0"
              @keydown=${(e: KeyboardEvent) => this.#key(e, actual)}
              @pointerdown=${this.#down}
              @pointermove=${this.#move}
              @pointerup=${this.#up}
              @pointercancel=${this.#cancel}
            >
              <span class="fill" style="width:${shown}%"></span><span class="pct">${shown}%</span>
            </div>
            <div class="ends"><span>${words.closed}</span><span>${words.open}</span></div>`
        : nothing}
      ${isInfrared(this.hass!, this.entityId) ? html`<p class="infrared">${S.infrared}</p>` : nothing}`;
  }

  static styles = css`
    :host {
      display: block;
      font-family: var(--hubb-font);
      color: var(--hubb-text);
    }
    svg {
      width: 26px;
      height: 26px;
      fill: currentColor;
    }

    /* The picture of how open it is: --open runs from 0 (shut) to 1 (wide open). */
    .hero {
      position: relative;
      overflow: hidden;
      height: 132px;
      margin: 2px 0 14px;
      border-radius: var(--hubb-radius);
      background: var(--hubb-surface-2);
    }
    .hero .light {
      position: absolute;
      inset: 0;
      background: radial-gradient(120% 100% at 50% 110%, var(--hubb-amber-tint), transparent 72%);
      opacity: var(--open);
      transition: opacity calc(var(--hubb-motion, 200ms) * 3) ease;
    }
    .hero .rod {
      position: absolute;
      z-index: 2;
      top: 7px;
      left: 8px;
      right: 8px;
      height: 4px;
      border-radius: 2px;
      background: var(--hubb-text-2);
    }
    .hero .panel {
      position: absolute;
      z-index: 1;
      top: 9px;
      bottom: 0;
      /* Shut, each half covers half the window; open, it gathers at the edge. */
      width: calc(14% + (1 - var(--open)) * 36%);
      background: repeating-linear-gradient(
        90deg,
        color-mix(in srgb, var(--hubb-text) 22%, var(--hubb-surface)) 0 9px,
        color-mix(in srgb, var(--hubb-text) 12%, var(--hubb-surface)) 9px 18px
      );
      box-shadow: 0 0 14px color-mix(in srgb, var(--hubb-bg) 70%, transparent);
      transition: width calc(var(--hubb-motion, 200ms) * 3.5) cubic-bezier(0.3, 0.7, 0.3, 1);
    }
    .hero .panel.left {
      left: 0;
      border-radius: 0 0 10px 0;
    }
    .hero .panel.right {
      right: 0;
      border-radius: 0 0 0 10px;
    }

    /* The flap: a TV that comes down out of a slot in the ceiling. */
    .hero.flap {
      /* The ceiling is a step off the wall in both themes (the text colour is light on dark, dark on light),
         never the black of the page background nor its white. */
      background: linear-gradient(180deg, color-mix(in srgb, var(--hubb-text) 11%, var(--hubb-surface-2)) 0 22%, var(--hubb-surface-2) 78%);
    }
    .hero.flap .light {
      background: radial-gradient(75% 100% at 50% 45%, var(--hubb-amber-tint), transparent 72%);
    }
    /* The opening of the flap: a recess a shade darker than the ceiling, not a black bar. */
    .hero .slot {
      position: absolute;
      top: 0;
      left: 14%;
      right: 14%;
      height: 7px;
      border-radius: 0 0 8px 8px;
      background: color-mix(in srgb, var(--hubb-amber-ink) 38%, var(--hubb-surface-2));
      box-shadow: 0 1px 0 color-mix(in srgb, var(--hubb-text) 12%, transparent);
    }
    .hero .tv {
      position: absolute;
      z-index: 1;
      top: 0;
      left: 50%;
      height: 100px;
      aspect-ratio: 16 / 9;
      box-sizing: border-box;
      /* A TV is dark in both themes: the ink of the amber is the one token that is. */
      border: 3px solid color-mix(in srgb, var(--hubb-amber-ink) 80%, #fff);
      border-radius: 8px;
      background: var(--hubb-amber-ink);
      /* Shut, it is all above the slot; open, it hangs 16 px below it. */
      transform: translate(-50%, calc(-100% + var(--open) * (100% + 16px)));
      transition: transform calc(var(--hubb-motion, 200ms) * 3.5) cubic-bezier(0.3, 0.7, 0.3, 1);
    }
    .hero .screen {
      position: absolute;
      inset: 0;
      border-radius: 4px;
      background: linear-gradient(135deg, color-mix(in srgb, var(--hubb-amber) 45%, transparent), transparent 55%, color-mix(in srgb, var(--hubb-amber) 25%, transparent));
      opacity: var(--open);
    }
    .hero .led {
      position: absolute;
      right: 8px;
      bottom: 4px;
      width: 4px;
      height: 4px;
      border-radius: 50%;
      background: var(--hubb-amber);
      opacity: var(--open);
    }

    .now {
      margin: 0 2px;
      font-size: 22px;
      font-weight: 800;
    }
    /* Always there, so the buttons do not jump when an answer comes. */
    .status {
      min-height: 18px;
      margin: 4px 2px 12px;
      font-size: 13px;
      font-weight: 700;
      color: var(--hubb-amber-text);
    }
    .status.bad {
      color: var(--hubb-mode-heat-ink);
    }
    .label {
      margin: 16px 2px 8px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--hubb-text-2);
    }

    .row {
      display: grid;
      grid-auto-flow: column;
      grid-auto-columns: 1fr;
      gap: 8px;
    }
    .cmd {
      all: unset;
      box-sizing: border-box;
      min-height: 76px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 6px;
      border-radius: 18px;
      background: var(--hubb-surface-2);
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      transition: background var(--hubb-motion, 200ms) ease;
    }
    .cmd.on,
    .cmd.moving {
      background: var(--hubb-amber);
      color: var(--hubb-amber-ink);
    }
    .cmd.moving {
      animation: hubb-ring 1.4s ease-out infinite;
    }
    .cmd.failed {
      box-shadow: inset 0 0 0 2px var(--hubb-mode-heat-ink);
      animation: hubb-shake 360ms ease;
    }
    .cmd:focus-visible,
    .track:focus-visible {
      outline: 2px solid var(--hubb-focus);
      outline-offset: 2px;
    }
    @keyframes hubb-ring {
      from {
        box-shadow: 0 0 0 0 var(--hubb-amber-tint);
      }
      to {
        box-shadow: 0 0 0 12px transparent;
      }
    }
    @keyframes hubb-shake {
      25% {
        transform: translateX(-4px);
      }
      75% {
        transform: translateX(4px);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .cmd.moving,
      .cmd.failed {
        animation: none;
      }
    }

    .track {
      position: relative;
      overflow: hidden;
      height: 48px;
      border-radius: 24px;
      background: var(--hubb-surface-2);
      touch-action: none;
      cursor: ew-resize;
    }
    .track .fill {
      position: absolute;
      top: 0;
      bottom: 0;
      left: 0;
      background: linear-gradient(90deg, var(--hubb-amber), color-mix(in srgb, var(--hubb-amber) 70%, #fff));
      transition: width var(--hubb-motion, 200ms) ease;
    }
    .track .pct {
      position: absolute;
      z-index: 1;
      top: 0;
      bottom: 0;
      left: 18px;
      display: flex;
      align-items: center;
      font-weight: 800;
      font-size: 14px;
      color: var(--hubb-text);
      mix-blend-mode: difference;
    }
    .ends {
      display: flex;
      justify-content: space-between;
      margin: 6px 6px 0;
      font-size: 11px;
      font-weight: 600;
      color: var(--hubb-text-2);
    }
    .infrared {
      margin: 14px 0 0;
      padding: 10px 12px;
      border-radius: 12px;
      background: var(--hubb-surface);
      font-size: 12px;
      font-weight: 600;
      color: var(--hubb-text-2);
    }
  `;
}

define('hubb-cover-panel', HubbCoverPanel);
