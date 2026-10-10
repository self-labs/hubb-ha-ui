import { LitElement, css, html, nothing } from 'lit';
import { define } from './define';

const DRAG_CLOSE_PX = 80;

export class HubbSheet extends LitElement {
  static properties = {
    open: { type: Boolean, reflect: true },
    heading: {},
    subheading: {},
  };

  declare open: boolean;
  declare heading: string;
  declare subheading: string;

  #dragStartY: number | null = null;

  constructor() {
    super();
    this.open = false;
    this.heading = '';
    this.subheading = '';
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

  render() {
    if (!this.open) return nothing;
    return html`<div class="backdrop" @click=${() => this.close()}></div>
      <section class="sheet" role="dialog" aria-modal="true" aria-label=${this.heading}>
        <div class="grab" @pointerdown=${this.#down} @pointermove=${this.#move} @pointerup=${this.#up} @pointercancel=${this.#up}>
          <span></span>
        </div>
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
      padding: 8px 16px calc(24px + env(safe-area-inset-bottom));
      border-radius: var(--hubb-radius-sheet, 24px) var(--hubb-radius-sheet, 24px) 0 0;
      background: var(--hubb-sheet);
      color: var(--hubb-text);
      font-family: var(--hubb-font);
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
  `;
}

define('hubb-sheet', HubbSheet);
