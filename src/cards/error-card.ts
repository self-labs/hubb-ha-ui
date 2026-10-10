import { LitElement, css, html, nothing } from 'lit';
import { define } from '../elements/define';
import type { HomeAssistant } from '../ha/types';
import { tokens } from '../theme/tokens';

export interface ErrorCardConfig {
  type: string;
  message: string;
  detail?: string;
}

export class HubbErrorCard extends LitElement {
  static properties = {
    hass: { attribute: false },
    config: { attribute: false },
  };

  declare hass: HomeAssistant | undefined;
  declare config: ErrorCardConfig | undefined;

  constructor() {
    super();
    this.hass = undefined;
    this.config = undefined;
  }

  setConfig(config: ErrorCardConfig): void {
    this.config = config;
  }

  getCardSize(): number {
    return 2;
  }

  render() {
    const config = this.config;
    if (!config) return nothing;
    return html`<div class="box">
      <p class="message">${config.message}</p>
      ${this.hass?.user?.is_admin && config.detail ? html`<pre class="detail">${config.detail}</pre>` : nothing}
    </div>`;
  }

  static styles = [
    tokens,
    css`
      :host {
        display: block;
        min-height: 100vh;
        background: var(--hubb-bg);
        color: var(--hubb-text);
        font-family: var(--hubb-font);
      }
      .box {
        max-width: 520px;
        margin: 0 auto;
        padding: 64px 24px;
        text-align: center;
      }
      .message {
        font-size: 16px;
        font-weight: 700;
      }
      .detail {
        white-space: pre-wrap;
        text-align: left;
        font-size: 12px;
        color: var(--hubb-text-2);
      }
    `,
  ];
}

define('hubb-error-card', HubbErrorCard);
