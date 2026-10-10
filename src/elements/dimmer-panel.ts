import { LitElement, css, html } from 'lit';
import { haptic } from '../actions/haptic';
import { brightnessPct, setLight } from '../actions/light';
import type { HomeAssistant } from '../ha/types';
import { S } from '../strings';
import { define } from './define';

export const PRESETS = [25, 50, 75, 100] as const;
const CONFIRM_MS = 3000;

export function pctFromPointer(clientY: number, top: number, height: number): number {
  if (height <= 0) return 0;
  const ratio = 1 - (clientY - top) / height;
  return Math.min(100, Math.max(0, Math.round(ratio * 100)));
}

export class HubbDimmerPanel extends LitElement {
  static properties = {
    hass: { attribute: false },
    entityId: { attribute: false },
    dragPct: { state: true },
  };

  declare hass: HomeAssistant | undefined;
  declare entityId: string;
  declare dragPct: number | null;

  #dragging = false;
  /** What was last asked, shown until Home Assistant reports it or CONFIRM_MS pass. */
  #pendingPct: number | null = null;
  #pendingAt = 0;
  #pendingTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    super();
    this.hass = undefined;
    this.entityId = '';
    this.dragPct = null;
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this.#pendingTimer) clearTimeout(this.#pendingTimer);
  }

  #current(): number {
    if (this.dragPct !== null) return this.dragPct;
    const actual = brightnessPct(this.hass?.states[this.entityId]) ?? 0;
    if (this.#pendingPct === null) return actual;
    // Brightness travels as 0-255, so a percentage can come back one point off.
    if (Math.abs(actual - this.#pendingPct) <= 1 || Date.now() - this.#pendingAt >= CONFIRM_MS) {
      this.#pendingPct = null;
      return actual;
    }
    return this.#pendingPct;
  }

  #apply(pct: number): void {
    if (!this.hass) return;
    haptic('selection');
    this.#pendingPct = pct;
    this.#pendingAt = Date.now();
    if (this.#pendingTimer) clearTimeout(this.#pendingTimer);
    this.#pendingTimer = setTimeout(() => this.requestUpdate(), CONFIRM_MS + 50);
    this.requestUpdate();
    setLight(this.hass, this.entityId, pct > 0, pct > 0 ? pct : undefined).catch(() => haptic('failure'));
  }

  #track(e: MouseEvent): void {
    const r = (e.currentTarget as Element).getBoundingClientRect();
    this.dragPct = pctFromPointer(e.clientY, r.top, r.height);
  }

  #down = (e: MouseEvent): void => {
    this.#dragging = true;
    this.#track(e);
  };

  #move = (e: MouseEvent): void => {
    if (this.#dragging) this.#track(e);
  };

  #up = (): void => {
    if (!this.#dragging) return;
    this.#dragging = false;
    const pct = this.dragPct;
    this.dragPct = null;
    if (pct !== null) this.#apply(pct);
  };

  render() {
    const pct = this.#current();
    return html`<div
        class="column"
        role="slider"
        aria-label=${S.brightness}
        aria-valuemin="0"
        aria-valuemax="100"
        aria-valuenow=${pct}
        @pointerdown=${this.#down}
        @pointermove=${this.#move}
        @pointerup=${this.#up}
        @pointercancel=${this.#up}
      >
        <span class="pct">${pct}%</span><span class="fill" style="height:${pct}%"></span>
      </div>
      <div class="presets">
        ${PRESETS.map(
          (p) => html`<button class=${p === pct ? 'cur' : ''} aria-pressed=${p === pct ? 'true' : 'false'} @click=${() => this.#apply(p)}>${p}</button>`,
        )}
      </div>`;
  }

  static styles = css`
    :host {
      display: block;
    }
    .column {
      position: relative;
      overflow: hidden;
      width: 96px;
      height: 220px;
      margin: 8px auto 16px;
      border-radius: 28px;
      background: var(--hubb-surface-2);
      touch-action: none;
      cursor: ns-resize;
    }
    .fill {
      position: absolute;
      left: 0;
      right: 0;
      bottom: 0;
      background: linear-gradient(0deg, var(--hubb-amber), color-mix(in srgb, var(--hubb-amber) 70%, #fff));
      transition: height var(--hubb-motion, 200ms) ease;
    }
    .pct {
      position: absolute;
      z-index: 1;
      top: 12px;
      left: 0;
      right: 0;
      text-align: center;
      font-weight: 800;
      font-size: 14px;
      color: var(--hubb-text);
      mix-blend-mode: difference;
    }
    .presets {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 6px;
    }
    .presets button {
      all: unset;
      box-sizing: border-box;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 44px;
      border-radius: 12px;
      text-align: center;
      font-family: var(--hubb-font);
      font-weight: 700;
      font-size: 13px;
      background: var(--hubb-surface-2);
      color: var(--hubb-text);
      cursor: pointer;
    }
    .presets button.cur {
      background: var(--hubb-primary-bg);
      color: var(--hubb-primary-ink);
    }
  `;
}

define('hubb-dimmer-panel', HubbDimmerPanel);
