import { LitElement, css, html, nothing } from 'lit';
import { has } from '../actions/climate';
import { haptic } from '../actions/haptic';
import type { HomeAssistant } from '../ha/types';
import { COVER, S } from '../strings';
import { COVER_FEATURE, coverWords } from './cover-tile';
import { define } from './define';

const POSITIONS = [0, 25, 50, 75, 100];

/** The sheet of a curtain: Abrir, Parar, Fechar, and the position when it has one. */
export class HubbCoverPanel extends LitElement {
  static properties = {
    hass: { attribute: false },
    entityId: { attribute: false },
  };

  declare hass: HomeAssistant | undefined;
  declare entityId: string;

  constructor() {
    super();
    this.hass = undefined;
    this.entityId = '';
  }

  #call(service: string, data?: Record<string, unknown>): void {
    haptic('light');
    this.hass?.callService('cover', service, data, { entity_id: this.entityId }).catch(() => haptic('failure'));
  }

  render() {
    const st = this.hass?.states[this.entityId];
    if (!st) return nothing;
    if (st.state === 'unavailable') return html`<p class="now">${S.noResponse}</p>`;
    const now = st.attributes.current_position;
    return html`<p class="now">${coverWords(st)}</p>
      <div class="row">
        ${has(st, COVER_FEATURE.open) ? html`<button class="open" @click=${() => this.#call('open_cover')}>${COVER.doOpen}</button>` : nothing}
        ${has(st, COVER_FEATURE.stop) ? html`<button class="stop" @click=${() => this.#call('stop_cover')}>${COVER.doStop}</button>` : nothing}
        ${has(st, COVER_FEATURE.close) ? html`<button class="close" @click=${() => this.#call('close_cover')}>${COVER.doClose}</button>` : nothing}
      </div>
      ${has(st, COVER_FEATURE.position)
        ? html`<p class="label">${COVER.position}</p>
            <div class="row">
              ${POSITIONS.map(
                (p) =>
                  html`<button class="position ${p === now ? 'current' : ''}" aria-pressed=${p === now ? 'true' : 'false'} @click=${() => this.#call('set_cover_position', { position: p })}>
                    ${p}%
                  </button>`,
              )}
            </div>`
        : nothing}`;
  }

  static styles = css`
    :host {
      display: block;
      font-family: var(--hubb-font);
      color: var(--hubb-text);
    }
    .now {
      margin: 4px 2px 14px;
      font-size: 22px;
      font-weight: 800;
    }
    .label {
      margin: 16px 2px 8px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--hubb-text-2);
    }
    .row {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    button {
      all: unset;
      box-sizing: border-box;
      min-height: 44px;
      padding: 0 16px;
      display: inline-flex;
      align-items: center;
      border-radius: 12px;
      background: var(--hubb-surface-2);
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
    }
    button.current {
      background: var(--hubb-primary-bg);
      color: var(--hubb-primary-ink);
    }
    button:focus-visible {
      outline: 2px solid var(--hubb-focus);
      outline-offset: 2px;
    }
  `;
}

define('hubb-cover-panel', HubbCoverPanel);
