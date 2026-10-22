import { LitElement, css, html } from 'lit';
import { define } from './define';

/** The time and the date, as people read them in Brazil, kept to the minute. */
export class HubbClock extends LitElement {
  #tick: ReturnType<typeof setInterval> | null = null;

  connectedCallback(): void {
    super.connectedCallback();
    this.#tick = setInterval(() => this.requestUpdate(), 15_000);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this.#tick) clearInterval(this.#tick);
    this.#tick = null;
  }

  render() {
    const now = new Date();
    return html`<div class="time">${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>
      <div class="date">${now.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</div>`;
  }

  static styles = css`
    :host {
      display: block;
      font-family: var(--hubb-font);
      color: var(--hubb-text);
    }
    .time {
      font-size: 48px;
      font-weight: 700;
      letter-spacing: -0.02em;
      line-height: 1;
    }
    .date {
      margin-top: 6px;
      font-size: 13px;
      color: var(--hubb-text-2);
    }
  `;
}

define('hubb-clock', HubbClock);
