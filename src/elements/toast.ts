import { LitElement, css, html, nothing } from 'lit';
import { haptic } from '../actions/haptic';
import { S } from '../strings';
import { define } from './define';

/** The undo on offer. One for the whole panel, so it survives moving to another screen within its time. */
interface Offer {
  message: string;
  onUndo: () => void;
  until: number;
}

let offer: Offer | null = null;
const onPage = new Set<HubbToast>();

function current(): Offer | null {
  return offer && Date.now() < offer.until ? offer : null;
}

function publish(next: Offer | null): void {
  offer = next;
  onPage.forEach((toast) => toast.requestUpdate());
}

/** Shows the undo on offer. Every screen has one; they all show the same offer. */
export class HubbToast extends LitElement {
  #timer: ReturnType<typeof setTimeout> | null = null;

  show(message: string, onUndo: () => void, ms = 5000): void {
    publish({ message, onUndo, until: Date.now() + ms });
  }

  /** Withdraws the offer; given its undo, only if that offer is still the one shown. */
  hide(onUndo?: () => void): void {
    if (onUndo && offer?.onUndo !== onUndo) return;
    publish(null);
  }

  connectedCallback(): void {
    super.connectedCallback();
    onPage.add(this);
    this.requestUpdate();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    onPage.delete(this);
    this.#clearTimer();
  }

  protected updated(): void {
    this.#clearTimer();
    const o = current();
    if (o) this.#timer = setTimeout(() => this.requestUpdate(), o.until - Date.now());
  }

  #clearTimer(): void {
    if (this.#timer) {
      clearTimeout(this.#timer);
      this.#timer = null;
    }
  }

  #undo = (): void => {
    const o = current();
    publish(null);
    if (o) {
      haptic('success');
      o.onUndo();
    }
  };

  render() {
    const o = current();
    // The live region stays on the page and only its content changes, so readers announce it.
    return html`<div class="region" role="status">
      ${o ? html`<div class="toast"><span>${o.message}</span><button @click=${this.#undo}>${S.undo}</button></div>` : nothing}
    </div>`;
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
    button:focus-visible {
      outline: 2px solid var(--hubb-primary-ink);
      outline-offset: 2px;
    }
  `;
}

define('hubb-toast', HubbToast);
