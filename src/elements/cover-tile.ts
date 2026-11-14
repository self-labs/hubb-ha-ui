import { mdiCurtains, mdiCurtainsClosed, mdiTelevision, mdiTelevisionOff } from '@mdi/js';
import { LitElement, css, html, nothing } from 'lit';
import { has } from '../actions/climate';
import { haptic } from '../actions/haptic';
import type { HassEntityState, HomeAssistant } from '../ha/types';
import type { CoverItem } from '../model/types';
import { COVER, FLAP, S, type CoverWords } from '../strings';
import { tileName } from '../theme/layout';
import { define } from './define';
import { HOLD_MS, HOLD_SHOW_MS, holdFill } from './hold';
import { icon } from './icon';

/** Features of a `cover` entity (CoverEntityFeature). */
export const COVER_FEATURE = { open: 1, close: 2, position: 4, stop: 8 } as const;

const WAIT_MS = 3000;

/** How open a curtain or a flap is, in words (the curtain's by default). */
export function coverWords(st: HassEntityState | undefined, words: CoverWords = COVER): string {
  if (!st || st.state === 'unavailable') return S.noResponse;
  // A template or RF curtain that has not moved since Home Assistant started.
  if (st.state === 'unknown') return '';
  if (st.state === 'opening') return words.opening;
  if (st.state === 'closing') return words.closing;
  if (st.state === 'closed') return words.closed;
  const p = st.attributes.current_position;
  if (st.state === 'open' && typeof p === 'number' && p > 0 && p < 100) return words.openPct(p);
  return st.state === 'open' ? words.open : st.state;
}

/** A curtain, a blind, an awning or a flap: a tap opens its sheet; a hold opens, closes, or stops it on the way. */
export class HubbCoverTile extends LitElement {
  static properties = {
    hass: { attribute: false },
    item: { attribute: false },
    kind: { attribute: false },
    sent: { state: true },
    holding: { state: true },
  };

  declare hass: HomeAssistant | undefined;
  declare item: CoverItem | undefined;
  /** A flap says its words in the masculine and draws a TV; anything else is a curtain. */
  declare kind: 'cover' | 'flap';
  /** The state on screen when a command left, and the word to show until the answer. */
  declare sent: { from: HassEntityState; word: string } | null;
  /** A press that will run the command is filling the tile. */
  declare holding: boolean;

  #press: ReturnType<typeof setTimeout> | null = null;
  /** Starts the fill, a moment into the press (HOLD_SHOW_MS). */
  #show: ReturnType<typeof setTimeout> | null = null;
  #wait: ReturnType<typeof setTimeout> | null = null;
  #long = false;
  /** Whether the press in progress is a finger or a pen: its context menu is the hold, not a right click. */
  #touch = false;

  constructor() {
    super();
    this.hass = undefined;
    this.item = undefined;
    this.kind = 'cover';
    this.sent = null;
    this.holding = false;
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this.#press) clearTimeout(this.#press);
    this.#press = null;
    this.#hideFill();
    if (this.#wait) clearTimeout(this.#wait);
  }

  #sheet(): void {
    if (!this.item) return;
    haptic('selection');
    this.dispatchEvent(new CustomEvent('hubb-open-cover', { detail: { entityId: this.item.entityId }, bubbles: true, composed: true }));
  }

  /** The hold: opens, closes, or stops it on the way. */
  #execute(): void {
    const { hass, item } = this;
    const st = item ? hass?.states[item.entityId] : undefined;
    if (!hass || !item || !st || st.state === 'unavailable') return;
    const moving = st.state === 'opening' || st.state === 'closing';
    const open = st.state === 'open' || (typeof st.attributes.current_position === 'number' && st.attributes.current_position > 0);
    // On its way, it stops; one that cannot stop turns back, whatever its position says: asking a
    // closing curtain to close did nothing.
    const service = moving
      ? has(st, COVER_FEATURE.stop)
        ? 'stop_cover'
        : st.state === 'closing'
          ? 'open_cover'
          : 'close_cover'
      : open
        ? 'close_cover'
        : 'open_cover';
    haptic('light');
    if (service !== 'stop_cover') {
      const words = this.kind === 'flap' ? FLAP : COVER;
      this.sent = { from: st, word: service === 'open_cover' ? words.opening : words.closing };
      if (this.#wait) clearTimeout(this.#wait);
      this.#wait = setTimeout(() => (this.sent = null), WAIT_MS);
    }
    hass.callService('cover', service, undefined, { entity_id: item.entityId }).catch(() => haptic('failure'));
  }

  /** A tap opens the sheet; the click that ends a hold already ran its command and opens nothing. */
  #click = (): void => {
    if (this.#long) {
      this.#long = false;
      return;
    }
    this.#sheet();
  };

  #down = (e: PointerEvent): void => {
    this.#long = false;
    this.#touch = e.pointerType === 'touch' || e.pointerType === 'pen';
    if (e.button > 0) return;
    const st = this.item ? this.hass?.states[this.item.entityId] : undefined;
    // A cover that does not answer has nothing to run: its tap opens the sheet, which says so.
    if (!st || st.state === 'unavailable') return;
    this.#show = setTimeout(() => {
      this.#show = null;
      this.holding = true;
    }, HOLD_SHOW_MS);
    this.#press = setTimeout(() => {
      this.#press = null;
      this.#long = true;
      this.#hideFill();
      haptic('medium');
      this.#execute();
    }, HOLD_MS);
  };

  /** The fill goes away, and one that was about to start never does. */
  #hideFill(): void {
    if (this.#show) clearTimeout(this.#show);
    this.#show = null;
    this.holding = false;
  }

  #end = (): void => {
    this.#hideFill();
    if (this.#press) clearTimeout(this.#press);
    this.#press = null;
  };

  /** A right click or the menu key opens the sheet; on a held finger this event is the hold, which runs the command. */
  #menu = (e: Event): void => {
    e.preventDefault();
    if (this.#touch) {
      // Android sends it at about 400 ms, before our timer, and may cancel the pointer right after: it is the hold.
      if (this.#press) {
        clearTimeout(this.#press);
        this.#press = null;
        this.#long = true;
        this.#hideFill();
        haptic('medium');
        this.#execute();
      }
      return;
    }
    this.#end();
    this.#sheet();
  };

  /** A key press means the keyboard is in use: a later context menu does not come from a finger. */
  #key = (): void => {
    this.#touch = false;
  };

  render() {
    const { hass, item } = this;
    if (!hass || !item) return nothing;
    const st = hass.states[item.entityId];
    const waiting = this.sent && st === this.sent.from ? this.sent : null;
    const open = !!st && !['closed', 'unavailable', 'unknown'].includes(st.state);
    const down = !st || st.state === 'unavailable';
    const flap = this.kind === 'flap';
    const words = flap ? FLAP : COVER;
    return html`<button
      class="tile ${open ? 'on' : ''} ${down ? 'na' : ''} ${this.holding ? 'holding' : ''}"
      @pointerdown=${this.#down}
      @pointerup=${this.#end}
      @pointerleave=${this.#end}
      @pointercancel=${this.#end}
      aria-haspopup="dialog"
      @contextmenu=${this.#menu}
      @keydown=${this.#key}
      @click=${this.#click}
    >
      <span class="icon">${icon(flap ? (open ? mdiTelevision : mdiTelevisionOff) : open ? mdiCurtains : mdiCurtainsClosed)}</span>
      <span class="text"><span class="name">${item.name}</span><span class="state">${waiting ? waiting.word : coverWords(st, words)}</span></span>
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
      height: 100%;
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
      font-weight: 700;
      font-size: 13px;
      line-height: 1.25;
      ${tileName}
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
    ${holdFill}
  `;
}

define('hubb-cover-tile', HubbCoverTile);
