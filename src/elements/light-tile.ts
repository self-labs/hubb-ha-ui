import { mdiLightbulbOn, mdiLightbulbOutline } from '@mdi/js';
import { LitElement, css, html, nothing } from 'lit';
import { haptic } from '../actions/haptic';
import { brightnessPct, setLight } from '../actions/light';
import { PendingTracker, type PendingStatus } from '../actions/pending';
import type { HomeAssistant } from '../ha/types';
import type { LightItem } from '../model/types';
import { noResponseSince, S } from '../strings';
import { define } from './define';
import { icon } from './icon';

const LONG_PRESS_MS = 500;
const EXPLAIN_MS = 4000;
const UNAVAILABLE = new Set(['unavailable', 'unknown']);

interface TileView {
  on: boolean;
  text: string;
  cls: string;
  pct: number | null;
}

export class HubbLightTile extends LitElement {
  static properties = {
    hass: { attribute: false },
    item: { attribute: false },
  };

  declare hass: HomeAssistant | undefined;
  declare item: LightItem | undefined;

  #tracker = new PendingTracker();
  #pressTimer: ReturnType<typeof setTimeout> | null = null;
  #refreshTimers: Array<ReturnType<typeof setTimeout>> = [];
  #longPressed = false;
  #lastStatus: PendingStatus = 'idle';
  /** Until when a tap on an unavailable tile shows since when it stopped answering. */
  #explainUntil = 0;

  constructor() {
    super();
    this.hass = undefined;
    this.item = undefined;
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this.#pressTimer) clearTimeout(this.#pressTimer);
    this.#refreshTimers.forEach(clearTimeout);
    this.#refreshTimers = [];
  }

  #view(item: LightItem): TileView {
    const st = this.hass?.states[item.entityId];
    const status = this.#tracker.status(item.entityId, st?.state);
    if (this.#lastStatus === 'pending' && status === 'failed') haptic('failure');
    if (this.#lastStatus === 'pending' && status === 'idle') haptic('success');
    this.#lastStatus = status;
    if (!st || (UNAVAILABLE.has(st.state) && status !== 'pending')) {
      const explain = st?.last_changed && Date.now() < this.#explainUntil;
      const since = explain ? new Date(st.last_changed!).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';
      return { on: false, text: explain ? noResponseSince(since) : S.noResponse, cls: 'na', pct: null };
    }
    if (status === 'pending') {
      const on = this.#tracker.expected(item.entityId) === 'on';
      return { on, text: on ? S.turningOn : S.turningOff, cls: on ? 'on busy' : 'busy', pct: null };
    }
    const on = st.state === 'on';
    if (status === 'failed') return { on, text: S.noResponse, cls: on ? 'on na' : 'na', pct: null };
    const pct = item.dimmable ? brightnessPct(st) : null;
    return { on, text: on ? (pct !== null ? `${pct}%` : S.on) : S.off, cls: on ? 'on' : '', pct };
  }

  #toggle(): void {
    const { hass, item } = this;
    if (!hass || !item) return;
    const st = hass.states[item.entityId];
    if (!st || UNAVAILABLE.has(st.state)) {
      haptic('warning');
      this.#explainUntil = Date.now() + EXPLAIN_MS;
      this.#refreshTimers.push(setTimeout(() => this.requestUpdate(), EXPLAIN_MS + 50));
      this.requestUpdate();
      return;
    }
    const shownOn = (this.#tracker.expected(item.entityId) ?? st.state) === 'on';
    this.#tracker.start(item.entityId, shownOn ? 'off' : 'on');
    haptic('light');
    this.requestUpdate();
    this.#scheduleRefresh();
    setLight(hass, item.entityId, !shownOn).catch(() => haptic('failure'));
  }

  /** Time passing must redraw the tile even if no new state arrives. */
  #scheduleRefresh(): void {
    const { timeoutMs, failedForMs } = this.#tracker;
    for (const ms of [timeoutMs + 50, timeoutMs + failedForMs + 100]) {
      this.#refreshTimers.push(setTimeout(() => this.requestUpdate(), ms));
    }
  }

  #onPointerDown = (): void => {
    this.#longPressed = false;
    // Only a dimmable light has something to open; a slow press on a relay must still toggle it.
    if (!this.item?.dimmable) return;
    this.#pressTimer = setTimeout(() => {
      this.#pressTimer = null;
      this.#longPressed = true;
      this.#onLongPress();
    }, LONG_PRESS_MS);
  };

  #onPointerEnd = (): void => {
    if (this.#pressTimer) {
      clearTimeout(this.#pressTimer);
      this.#pressTimer = null;
    }
  };

  #onClick = (ev: Event): void => {
    if (this.#longPressed) {
      this.#longPressed = false;
      ev.preventDefault();
      return;
    }
    this.#toggle();
  };

  #onLongPress(): void {
    const item = this.item;
    if (!item?.dimmable) return;
    haptic('medium');
    this.dispatchEvent(
      new CustomEvent('hubb-open-dimmer', {
        detail: { entityId: item.entityId, name: item.name },
        bubbles: true,
        composed: true,
      }),
    );
  }

  render() {
    const item = this.item;
    if (!item) return nothing;
    const v = this.#view(item);
    return html`<button
      class="tile ${v.cls}"
      aria-pressed=${v.on ? 'true' : 'false'}
      @pointerdown=${this.#onPointerDown}
      @pointerup=${this.#onPointerEnd}
      @pointerleave=${this.#onPointerEnd}
      @pointercancel=${this.#onPointerEnd}
      @contextmenu=${(e: Event) => e.preventDefault()}
      @click=${this.#onClick}
    >
      <span class="icon">${icon(v.on ? mdiLightbulbOn : mdiLightbulbOutline)}</span>
      <span class="text"><span class="name">${item.name}</span><span class="state">${v.text}</span></span>
      ${v.pct !== null ? html`<span class="level" style="width:${v.pct}%"></span>` : nothing}
    </button>`;
  }

  static styles = css`
    :host {
      display: block;
    }
    .tile {
      all: unset;
      box-sizing: border-box;
      position: relative;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      gap: 10px;
      width: 100%;
      min-height: 96px;
      padding: 12px;
      border-radius: var(--hubb-radius, 16px);
      background: var(--hubb-surface);
      color: var(--hubb-text);
      font-family: var(--hubb-font);
      cursor: pointer;
      user-select: none;
      -webkit-user-select: none;
      -webkit-tap-highlight-color: transparent;
      transition: background var(--hubb-motion, 200ms) ease;
    }
    .tile:focus-visible {
      outline: 2px solid var(--hubb-amber);
      outline-offset: 2px;
    }
    .icon {
      width: 30px;
      height: 30px;
      border-radius: 10px;
      display: grid;
      place-items: center;
      background: var(--hubb-surface-2);
      color: var(--hubb-text-2);
    }
    .icon svg {
      width: 18px;
      height: 18px;
      fill: currentColor;
    }
    .name {
      display: block;
      font-weight: 700;
      font-size: 13px;
      line-height: 1.25;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .state {
      display: block;
      margin-top: 2px;
      font-weight: 600;
      font-size: 11px;
      color: var(--hubb-text-2);
    }
    .tile.on {
      background: radial-gradient(110% 80% at 15% 0%, var(--hubb-amber-tint), transparent 65%), var(--hubb-on-bg);
    }
    .tile.on .icon {
      background: var(--hubb-amber);
      color: var(--hubb-amber-ink);
      box-shadow: 0 0 18px var(--hubb-amber-tint);
    }
    .tile.on .state {
      color: var(--hubb-amber-text);
    }
    .tile.na {
      background: transparent;
      border: 1.5px dashed color-mix(in srgb, var(--hubb-text-2) 55%, transparent);
    }
    .tile.na .icon {
      opacity: 0.5;
    }
    .tile.busy .icon {
      animation: pulse 1.1s ease-in-out infinite;
    }
    .level {
      position: absolute;
      left: 0;
      bottom: 0;
      height: 4px;
      background: var(--hubb-amber);
      border-radius: 0 2px 2px 0;
    }
    @keyframes pulse {
      50% {
        opacity: 0.35;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .tile.busy .icon {
        animation: none;
      }
    }
  `;
}

define('hubb-light-tile', HubbLightTile);
