import { LitElement, css, html, nothing } from 'lit';
import { haptic } from '../actions/haptic';
import { S } from '../strings';
import { define } from './define';

export class HubbToast extends LitElement {
  static properties = { message: { state: true } };

  declare message: string | null;

  #onUndo: (() => void) | null = null;
  #timer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    super();
    this.message = null;
  }

  show(message: string, onUndo: () => void, ms = 5000): void {
    this.#clearTimer();
    this.message = message;
    this.#onUndo = onUndo;
    this.#timer = setTimeout(() => this.hide(), ms);
  }

  hide(): void {
    this.#clearTimer();
    this.message = null;
    this.#onUndo = null;
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#clearTimer();
  }

  #clearTimer(): void {
    if (this.#timer) {
      clearTimeout(this.#timer);
      this.#timer = null;
    }
  }

  #undo = (): void => {
    const fn = this.#onUndo;
    this.hide();
    if (fn) {
      haptic('success');
      fn();
    }
  };

  render() {
    if (this.message === null) return nothing;
    return html`<div class="toast" role="status"><span>${this.message}</span><button @click=${this.#undo}>${S.undo}</button></div>`;
  }

  static styles = css`
    .toast {
      position: fixed;
      left: 16px;
      right: 16px;
      bottom: calc(84px + env(safe-area-inset-bottom));
      z-index: 30;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      max-width: 528px;
      margin: 0 auto;
      padding: 10px 10px 10px 16px;
      border-radius: 14px;
      background: var(--hubb-primary-bg);
      color: var(--hubb-primary-ink);
      font-family: var(--hubb-font);
      font-weight: 700;
      font-size: 13px;
    }
    button {
      all: unset;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 44px;
      padding: 0 12px;
      border-radius: 10px;
      color: var(--hubb-toast-action);
      font-weight: 800;
      cursor: pointer;
    }
  `;
}

define('hubb-toast', HubbToast);
