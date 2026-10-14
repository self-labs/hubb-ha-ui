import { mdiChevronRight } from '@mdi/js';
import { LitElement, css, html } from 'lit';
import { haptic } from '../actions/haptic';
import { define } from './define';
import { icon } from './icon';

/** How far the thumb must go, of the whole track, to count. */
const DONE_AT = 0.85;
/** One press of an arrow key moves the thumb this much of the track. */
const KEY_STEP = 0.25;

/**
 * Slide to confirm: drag the thumb to the end of the track (or press the right arrow until it gets
 * there) and it fires `hubb-confirm`; let go before and it slides back. A tap never fires: this is
 * what keeps a gate or a lock from opening by accident.
 */
export class HubbSlideConfirm extends LitElement {
  static properties = {
    label: {},
    disabled: { type: Boolean, reflect: true },
    progress: { state: true },
  };

  declare label: string;
  declare disabled: boolean;
  /** 0 to 1: where the thumb is. */
  declare progress: number;

  /** The finger that started the drag, where it started, and how far the thumb can go. */
  #start: { pointerId: number; x: number; width: number } | null = null;

  constructor() {
    super();
    this.label = '';
    this.disabled = false;
    this.progress = 0;
  }

  #fire(): void {
    this.progress = 0;
    haptic('success');
    this.dispatchEvent(new CustomEvent('hubb-confirm', { bubbles: true, composed: true }));
  }

  #down = (e: PointerEvent): void => {
    if (this.disabled || this.#start || e.button > 0) return;
    const track = this.renderRoot.querySelector<HTMLElement>('.track');
    const thumb = this.renderRoot.querySelector<HTMLElement>('.thumb');
    if (!track || !thumb) return;
    const width = track.getBoundingClientRect().width - thumb.getBoundingClientRect().width;
    if (width <= 0) return;
    this.progress = 0;
    this.#start = { pointerId: e.pointerId, x: e.clientX, width };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    haptic('light');
  };

  #move = (e: PointerEvent): void => {
    if (!this.#start || e.pointerId !== this.#start.pointerId) return;
    this.progress = Math.min(1, Math.max(0, (e.clientX - this.#start.x) / this.#start.width));
  };

  #up = (e: PointerEvent): void => {
    if (!this.#start || e.pointerId !== this.#start.pointerId) return;
    this.#start = null;
    if (this.progress >= DONE_AT) this.#fire();
    else this.progress = 0;
  };

  /** The system took the touch (a back gesture, a call, the palm): that is not letting go at the end. */
  #cancel = (e: PointerEvent): void => {
    if (!this.#start || e.pointerId !== this.#start.pointerId) return;
    this.#start = null;
    this.progress = 0;
  };

  #key = (e: KeyboardEvent): void => {
    // A held key repeats: only real presses move the thumb, so holding the arrow fires at most once.
    if (this.disabled || e.repeat) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault();
      this.progress = Math.min(1, this.progress + KEY_STEP);
      if (this.progress >= 1) this.#fire();
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown' || e.key === 'Escape') {
      e.preventDefault();
      this.progress = 0;
    }
  };

  render() {
    const pct = Math.round(this.progress * 100);
    return html`<div
      class="track"
      role="slider"
      tabindex=${this.disabled ? '-1' : '0'}
      aria-label=${this.label}
      aria-valuemin="0"
      aria-valuemax="100"
      aria-valuenow=${pct}
      aria-disabled=${this.disabled ? 'true' : 'false'}
      @keydown=${this.#key}
    >
      <span class="fill" style="width: calc((100% - 52px) * ${this.progress} + 52px)"></span>
      <span class="label">${this.label}</span>
      <span
        class="thumb"
        style="left: calc((100% - 52px) * ${this.progress} + 4px)"
        @pointerdown=${this.#down}
        @pointermove=${this.#move}
        @pointerup=${this.#up}
        @pointercancel=${this.#cancel}
        @lostpointercapture=${this.#cancel}
        >${icon(mdiChevronRight)}</span
      >
    </div>`;
  }

  static styles = css`
    :host {
      display: block;
    }
    .track {
      position: relative;
      box-sizing: border-box;
      height: 52px;
      border-radius: 26px;
      background: var(--hubb-surface-2);
      overflow: hidden;
      user-select: none;
      -webkit-user-select: none;
      /* The page still scrolls from the track; only the thumb keeps the finger to itself. */
      touch-action: pan-y;
    }
    .track:focus-visible {
      outline: 2px solid var(--hubb-focus);
      outline-offset: 2px;
    }
    .fill {
      position: absolute;
      inset: 0 auto 0 0;
      border-radius: 26px;
      background: var(--hubb-amber-tint);
    }
    .label {
      position: absolute;
      inset: 0;
      display: grid;
      place-items: center;
      padding-left: 40px;
      font-family: var(--hubb-font);
      font-size: 13px;
      font-weight: 700;
      color: var(--hubb-text-2);
    }
    .thumb {
      position: absolute;
      top: 4px;
      width: 44px;
      height: 44px;
      border-radius: 50%;
      display: grid;
      place-items: center;
      background: var(--hubb-amber);
      color: var(--hubb-amber-ink);
      cursor: grab;
      touch-action: none;
    }
    .thumb svg {
      width: 24px;
      height: 24px;
      fill: currentColor;
    }
    :host([disabled]) .track {
      opacity: 0.5;
    }
  `;
}

define('hubb-slide-confirm', HubbSlideConfirm);
