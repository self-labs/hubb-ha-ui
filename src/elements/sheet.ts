import { mdiClose } from '@mdi/js';
import { LitElement, css, html, nothing, type PropertyValues } from 'lit';
import { LayoutWatcher } from '../layout';
import type { Layout } from '../model/layout';
import { S } from '../strings';
import { define } from './define';
import { icon } from './icon';

const DRAG_CLOSE_PX = 80;

export class HubbSheet extends LitElement {
  static properties = {
    open: { type: Boolean, reflect: true },
    heading: {},
    subheading: {},
    screenLayout: { reflect: true, attribute: 'screen-layout' },
  };

  declare open: boolean;
  declare heading: string;
  declare subheading: string;
  /** Wide: a window in the middle of the area, closed by its button, instead of a sheet from below. */
  declare screenLayout: Layout;

  #dragStartY: number | null = null;
  /**
   * Whether the touch now ending began on the backdrop. On an iPhone, the release of a long press
   * that opened the sheet sends its click to whatever is under the finger, often the backdrop: that
   * click must not close what it just opened (a resident's iPhone, 14/10).
   */
  #downOnBackdrop = false;

  #backdropDown = (): void => {
    this.#downOnBackdrop = true;
  };

  #backdropClick = (): void => {
    const began = this.#downOnBackdrop;
    this.#downOnBackdrop = false;
    if (began) this.close();
  };

  /** A touch cancelled by the browser (a swipe) sends no click: it must not wait for the next one. */
  #backdropCancel = (): void => {
    this.#downOnBackdrop = false;
  };

  constructor() {
    super();
    this.open = false;
    this.heading = '';
    this.subheading = '';
    this.screenLayout = 'phone';
    new LayoutWatcher(this);
  }

  close(): void {
    this.open = false;
    this.dispatchEvent(new CustomEvent('hubb-close', { bubbles: true, composed: true }));
  }

  #down = (e: MouseEvent): void => {
    this.#dragStartY = e.clientY;
  };

  #move = (e: MouseEvent): void => {
    if (this.#dragStartY !== null && e.clientY - this.#dragStartY > DRAG_CLOSE_PX) {
      this.#dragStartY = null;
      this.close();
    }
  };

  #up = (): void => {
    this.#dragStartY = null;
  };

  #onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') {
      e.preventDefault();
      this.close();
    }
  };

  protected willUpdate(changed: PropertyValues<this>): void {
    // Every opening starts clean: a touch of an earlier one never closes this one.
    if (changed.has('open')) this.#downOnBackdrop = false;
  }

  protected updated(changed: PropertyValues<this>): void {
    // The focus goes into the sheet when it opens, so the keyboard and screen readers land inside it.
    if (changed.has('open') && this.open) this.renderRoot.querySelector<HTMLElement>('.sheet')?.focus();
  }

  render() {
    if (!this.open) return nothing;
    return html`<div class="backdrop" @pointerdown=${this.#backdropDown} @pointercancel=${this.#backdropCancel} @click=${this.#backdropClick}></div>
      <section class="sheet" role="dialog" aria-modal="true" aria-label=${this.heading} tabindex="-1" @keydown=${this.#onKey}>
        ${this.screenLayout === 'wide'
          ? html`<button class="close" aria-label=${S.close} @click=${() => this.close()}>${icon(mdiClose)}</button>`
          : html`<div class="grab" @pointerdown=${this.#down} @pointermove=${this.#move} @pointerup=${this.#up} @pointercancel=${this.#up}>
              <span></span>
            </div>`}
        <h2>${this.heading}</h2>
        ${this.subheading ? html`<p class="sub">${this.subheading}</p>` : nothing}
        <slot></slot>
      </section>`;
  }

  static styles = css`
    .backdrop {
      position: fixed;
      inset: 0;
      z-index: 20;
      background: var(--hubb-backdrop);
    }
    .sheet {
      position: fixed;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 21;
      box-sizing: border-box;
      max-height: 75vh;
      overflow-y: auto;
      /* It scrolls with no bar, like every screen: the resident scrolls to see more (Gustavo, 24/10). */
      scrollbar-width: none;
      padding: 8px 16px calc(24px + env(safe-area-inset-bottom));
      border-radius: var(--hubb-radius-sheet, 24px) var(--hubb-radius-sheet, 24px) 0 0;
      background: var(--hubb-sheet);
      color: var(--hubb-text);
      font-family: var(--hubb-font);
    }
    .sheet::-webkit-scrollbar {
      display: none;
    }
    /* It takes the focus only to hand it to its content; the whole sheet needs no ring. */
    .sheet:focus {
      outline: none;
    }
    .grab {
      display: flex;
      justify-content: center;
      padding: 6px 0 12px;
      touch-action: none;
    }
    .grab span {
      width: 36px;
      height: 4px;
      border-radius: 2px;
      background: color-mix(in srgb, var(--hubb-text-2) 60%, transparent);
    }
    h2 {
      margin: 0;
      font-size: 16px;
      font-weight: 800;
    }
    .sub {
      margin: 2px 0 12px;
      font-size: 12px;
      color: var(--hubb-text-2);
    }
    /* Wide: a window in the middle of the area of the panel (src/theme/layout.ts). */
    :host([screen-layout='wide']) .sheet {
      left: calc(var(--hubb-area-left, 0px) + var(--hubb-area-width, 100vw) / 2);
      right: auto;
      top: calc(var(--hubb-area-top, 0px) + (100vh - var(--hubb-area-top, 0px)) / 2);
      bottom: auto;
      width: calc(var(--hubb-area-width, 100vw) - 48px);
      max-width: 520px;
      max-height: 80vh;
      padding: 20px 20px 24px;
      border-radius: var(--hubb-radius-sheet, 24px);
      transform: translate(-50%, -50%);
    }
    :host([screen-layout='wide']) h2 {
      padding-right: 48px;
    }
    .close {
      all: unset;
      position: absolute;
      top: 12px;
      right: 12px;
      width: 44px;
      height: 44px;
      display: grid;
      place-items: center;
      border-radius: 12px;
      background: var(--hubb-surface-2);
      color: var(--hubb-text);
      cursor: pointer;
    }
    .close:focus-visible {
      outline: 2px solid var(--hubb-focus);
      outline-offset: 2px;
    }
    .close svg {
      width: 22px;
      height: 22px;
      fill: currentColor;
    }
  `;
}

define('hubb-sheet', HubbSheet);
