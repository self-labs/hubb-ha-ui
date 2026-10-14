import { mdiCurtains, mdiCurtainsClosed } from '@mdi/js';
import { LitElement, css, html, nothing } from 'lit';
import { has } from '../actions/climate';
import { haptic } from '../actions/haptic';
import type { HassEntityState, HomeAssistant } from '../ha/types';
import type { CoverItem } from '../model/types';
import { COVER, S } from '../strings';
import { define } from './define';
import { icon } from './icon';

/** Features of a `cover` entity (CoverEntityFeature). */
export const COVER_FEATURE = { open: 1, close: 2, position: 4, stop: 8 } as const;

const LONG_PRESS_MS = 500;
const WAIT_MS = 3000;

/** How open a curtain is, in words. */
export function coverWords(st: HassEntityState | undefined): string {
  if (!st || st.state === 'unavailable') return S.noResponse;
  // A template or RF curtain that has not moved since Home Assistant started.
  if (st.state === 'unknown') return '';
  if (st.state === 'opening') return COVER.opening;
  if (st.state === 'closing') return COVER.closing;
  if (st.state === 'closed') return COVER.closed;
  const p = st.attributes.current_position;
  if (st.state === 'open' && typeof p === 'number' && p > 0 && p < 100) return COVER.openPct(p);
  return st.state === 'open' ? COVER.open : st.state;
}

/** A curtain, a blind or an awning: a tap opens, closes, or stops it on the way; a long press opens its sheet. */
export class HubbCoverTile extends LitElement {
  static properties = {
    hass: { attribute: false },
    item: { attribute: false },
    sent: { state: true },
  };

  declare hass: HomeAssistant | undefined;
  declare item: CoverItem | undefined;
  /** The state on screen when a command left, and the word to show until the answer. */
  declare sent: { from: HassEntityState; word: string } | null;

  #press: ReturnType<typeof setTimeout> | null = null;
  #wait: ReturnType<typeof setTimeout> | null = null;
  #long = false;

  constructor() {
    super();
    this.hass = undefined;
    this.item = undefined;
    this.sent = null;
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this.#press) clearTimeout(this.#press);
    if (this.#wait) clearTimeout(this.#wait);
  }

  #sheet(): void {
    if (!this.item) return;
    haptic('medium');
    this.dispatchEvent(new CustomEvent('hubb-open-cover', { detail: { entityId: this.item.entityId }, bubbles: true, composed: true }));
  }

  #tap = (): void => {
    if (this.#long) {
      this.#long = false;
      return;
    }
    const { hass, item } = this;
    const st = item ? hass?.states[item.entityId] : undefined;
    if (!hass || !item || !st || st.state === 'unavailable') return;
    const moving = st.state === 'opening' || st.state === 'closing';
    const open = st.state === 'open' || (typeof st.attributes.current_position === 'number' && st.attributes.current_position > 0);
    const service = moving && has(st, COVER_FEATURE.stop) ? 'stop_cover' : open ? 'close_cover' : 'open_cover';
    haptic('light');
    if (service !== 'stop_cover') {
      this.sent = { from: st, word: service === 'open_cover' ? COVER.opening : COVER.closing };
      if (this.#wait) clearTimeout(this.#wait);
      this.#wait = setTimeout(() => (this.sent = null), WAIT_MS);
    }
    hass.callService('cover', service, undefined, { entity_id: item.entityId }).catch(() => haptic('failure'));
  };

  #down = (e: PointerEvent): void => {
    this.#long = false;
    if (e.button > 0) return;
    this.#press = setTimeout(() => {
      this.#press = null;
      this.#long = true;
      this.#sheet();
    }, LONG_PRESS_MS);
  };

  #end = (): void => {
    if (this.#press) clearTimeout(this.#press);
    this.#press = null;
  };

  #menu = (e: Event): void => {
    e.preventDefault();
    this.#end();
    this.#sheet();
  };

  render() {
    const { hass, item } = this;
    if (!hass || !item) return nothing;
    const st = hass.states[item.entityId];
    const waiting = this.sent && st === this.sent.from ? this.sent : null;
    const open = !!st && !['closed', 'unavailable', 'unknown'].includes(st.state);
    const down = !st || st.state === 'unavailable';
    return html`<button
      class="tile ${open ? 'on' : ''} ${down ? 'na' : ''}"
      @pointerdown=${this.#down}
      @pointerup=${this.#end}
      @pointerleave=${this.#end}
      @pointercancel=${this.#end}
      @contextmenu=${this.#menu}
      @click=${this.#tap}
    >
      <span class="icon">${icon(open ? mdiCurtains : mdiCurtainsClosed)}</span>
      <span class="text"><span class="name">${item.name}</span><span class="state">${waiting ? waiting.word : coverWords(st)}</span></span>
    </button>`;
  }

  static styles = css`
    :host {
      display: block;
    }
    .tile {
      all: unset;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      gap: 10px;
      width: 100%;
      min-height: 96px;
      padding: 12px;
      border-radius: var(--hubb-radius, 16px);
      background: var(--hubb-surface);
      box-shadow: var(--hubb-card-shadow);
      color: var(--hubb-text);
      font-family: var(--hubb-font);
      cursor: pointer;
      user-select: none;
      -webkit-user-select: none;
      -webkit-tap-highlight-color: transparent;
    }
    .tile:focus-visible {
      outline: 2px solid var(--hubb-focus);
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
    }
    .tile.on .state {
      color: var(--hubb-amber-text);
    }
    .tile.na {
      background: transparent;
      border: 1.5px dashed color-mix(in srgb, var(--hubb-text-2) 55%, transparent);
    }
  `;
}

define('hubb-cover-tile', HubbCoverTile);
