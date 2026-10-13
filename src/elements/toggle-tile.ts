import { LitElement, css, html, nothing, type TemplateResult } from 'lit';
import type { TileColor } from '../actions/color';
import { haptic } from '../actions/haptic';
import { PendingTracker, type PendingStatus } from '../actions/pending';
import type { HassEntityState, HomeAssistant } from '../ha/types';
import { noResponseSince, S } from '../strings';
import { icon } from './icon';

const LONG_PRESS_MS = 500;
const EXPLAIN_MS = 4000;
const UNAVAILABLE = new Set(['unavailable', 'unknown']);

export interface TileItem {
  entityId: string;
  name: string;
}

/** What a tile says in each state: "Acesa" for a light, "Ligada" for an outlet. */
export interface TileWords {
  on: string;
  off: string;
  turningOn: string;
  turningOff: string;
}

/** What a confirmed "on" state can add: the brightness bar and the colour of the light. */
export interface TileExtras {
  pct: number | null;
  color: TileColor | null;
}

interface TileView extends TileExtras {
  on: boolean;
  text: string;
  cls: string;
}

const PLAIN: TileExtras = { pct: null, color: null };

/**
 * A tile that turns one entity on and off. It shows the change at once, waits 3 s for Home Assistant
 * to confirm, says "Sem resposta" when nothing does, vibrates, and on a tap while the entity is down
 * says since when. Subclasses give the words, the icon, the service and an optional long-press sheet.
 */
export abstract class HubbToggleTile<T extends TileItem = TileItem> extends LitElement {
  static properties = {
    hass: { attribute: false },
    item: { attribute: false },
  };

  declare hass: HomeAssistant | undefined;
  declare item: T | undefined;

  #tracker = new PendingTracker();
  #pressTimer: ReturnType<typeof setTimeout> | null = null;
  /** The next moment the tile changes by time alone (end of the wait, of "Sem resposta", of the explanation). */
  #refresh: ReturnType<typeof setTimeout> | null = null;
  #longPressed = false;
  /** Whether the press in progress is a finger or a pen: a long press with them may still end in a click. */
  #touch = false;
  #lastStatus: PendingStatus = 'idle';
  /** Until when a tap on an unavailable tile shows since when it stopped answering. */
  #explainUntil = 0;

  constructor() {
    super();
    this.hass = undefined;
    this.item = undefined;
  }

  protected abstract words(): TileWords;
  protected abstract iconPath(on: boolean): string;
  protected abstract send(hass: HomeAssistant, entityId: string, on: boolean): Promise<unknown>;

  /** Whether a long press opens something for this item; when false, a slow press still toggles. */
  protected hasSheet(_item: T): boolean {
    return false;
  }

  /** Called on a long press, only when `hasSheet` is true. */
  protected openSheet(_item: T): void {}

  protected extras(_item: T, _state: HassEntityState): TileExtras {
    return PLAIN;
  }

  /** The icon inside the tile; a subclass may draw a Home Assistant icon name instead of a path. */
  protected iconTemplate(_item: T, on: boolean): TemplateResult {
    return icon(this.iconPath(on));
  }

  connectedCallback(): void {
    super.connectedCallback();
    // Back on the page (a view switch, a re-insertion): redraw and re-arm the clock it lost.
    this.requestUpdate();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this.#pressTimer) clearTimeout(this.#pressTimer);
    if (this.#refresh) clearTimeout(this.#refresh);
    this.#refresh = null;
    // Whatever happens while away is not news when the tile comes back: no vibration for it.
    this.#lastStatus = 'idle';
  }

  protected updated(): void {
    this.#arm();
  }

  /** One timer for the next moment the tile changes by time alone, re-armed after every render. */
  #arm(): void {
    if (this.#refresh) clearTimeout(this.#refresh);
    this.#refresh = null;
    const item = this.item;
    if (!item || !this.isConnected) return;
    const waits: number[] = [];
    const pending = this.#tracker.msUntilChange(item.entityId);
    if (pending !== null) waits.push(pending);
    const explain = this.#explainUntil - Date.now();
    if (explain > 0) waits.push(explain);
    if (waits.length) this.#refresh = setTimeout(() => this.requestUpdate(), Math.min(...waits) + 20);
  }

  #view(item: T): TileView {
    const words = this.words();
    const st = this.hass?.states[item.entityId];
    const status = this.#tracker.status(item.entityId, st?.state, st);
    if (this.#lastStatus === 'pending' && status === 'failed') haptic('failure');
    if (this.#lastStatus === 'pending' && status === 'idle') haptic('success');
    this.#lastStatus = status;
    if (!st || (UNAVAILABLE.has(st.state) && status !== 'pending')) {
      const explain = st?.last_changed && Date.now() < this.#explainUntil;
      const since = explain ? new Date(st.last_changed!).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';
      return { on: false, text: explain ? noResponseSince(since) : S.noResponse, cls: 'na', ...PLAIN };
    }
    if (status === 'pending') {
      const on = this.#tracker.expected(item.entityId) === 'on';
      return { on, text: on ? words.turningOn : words.turningOff, cls: on ? 'on busy' : 'busy', ...PLAIN };
    }
    const on = st.state === 'on';
    if (status === 'failed') return { on, text: S.noResponse, cls: on ? 'on na' : 'na', ...PLAIN };
    if (!on) return { on, text: words.off, cls: '', ...PLAIN };
    const extras = this.extras(item, st);
    return { on, text: extras.pct !== null ? `${extras.pct}%` : words.on, cls: extras.color ? 'on colored' : 'on', ...extras };
  }

  #toggle(): void {
    const { hass, item } = this;
    if (!hass || !item) return;
    const st = hass.states[item.entityId];
    if (!st || UNAVAILABLE.has(st.state)) {
      haptic('warning');
      this.#explainUntil = Date.now() + EXPLAIN_MS;
      this.requestUpdate();
      return;
    }
    const shownOn = (this.#tracker.expected(item.entityId) ?? st.state) === 'on';
    this.#tracker.start(item.entityId, shownOn ? 'off' : 'on', st);
    haptic('light');
    this.requestUpdate();
    this.send(hass, item.entityId, !shownOn).catch(() => haptic('failure'));
  }

  #onPointerDown = (e: PointerEvent): void => {
    this.#longPressed = false;
    this.#touch = e.pointerType === 'touch' || e.pointerType === 'pen';
    // Only the main button: a right click opens the sheet through the context menu.
    if (e.button > 0 || !this.item || !this.hasSheet(this.item)) return;
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
    if (!item || !this.hasSheet(item)) return;
    haptic('medium');
    this.openSheet(item);
  }

  /** A key press means the keyboard is in use: a later context menu does not come from a finger. */
  #onKey = (): void => {
    this.#touch = false;
  };

  /** Right click, the menu key or Shift+F10 open the sheet too: the way in without a long press. */
  #onContextMenu = (e: Event): void => {
    e.preventDefault();
    const item = this.item;
    if (!item || !this.hasSheet(item) || this.#longPressed) return;
    // A finger held down may still end in a click; a right click or the keyboard never does.
    if (this.#touch) this.#longPressed = true;
    this.#onPointerEnd();
    haptic('medium');
    this.openSheet(item);
  };

  render() {
    const item = this.item;
    if (!item) return nothing;
    const v = this.#view(item);
    return html`<button
      class="tile ${v.cls}"
      style=${v.color ? `--tile-color:${v.color.fill};--tile-ink:${v.color.ink}` : ''}
      aria-pressed=${v.on ? 'true' : 'false'}
      @pointerdown=${this.#onPointerDown}
      @pointerup=${this.#onPointerEnd}
      @pointerleave=${this.#onPointerEnd}
      @pointercancel=${this.#onPointerEnd}
      @keydown=${this.#onKey}
      @contextmenu=${this.#onContextMenu}
      @click=${this.#onClick}
    >
      <span class="icon">${this.iconTemplate(item, v.on)}</span>
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
      box-shadow: var(--hubb-card-shadow);
      color: var(--hubb-text);
      font-family: var(--hubb-font);
      cursor: pointer;
      user-select: none;
      -webkit-user-select: none;
      -webkit-tap-highlight-color: transparent;
      transition: background var(--hubb-motion, 200ms) ease;
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
    .icon ha-icon {
      --mdc-icon-size: 18px;
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
    /* A colour light shows its own colour; whites keep the amber above. */
    .tile.on.colored .icon {
      background: var(--tile-color);
      color: var(--tile-ink);
      box-shadow: 0 0 18px color-mix(in srgb, var(--tile-color) 45%, transparent);
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
