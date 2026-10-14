import { mdiPlayCircleOutline } from '@mdi/js';
import { LitElement, css, html, nothing } from 'lit';
import { pressAction } from '../actions/action';
import { haptic } from '../actions/haptic';
import type { HomeAssistant } from '../ha/types';
import type { ActionItem } from '../model/types';
import { S } from '../strings';
import { define } from './define';
import { icon } from './icon';

/** How long "Feito" or "Sem resposta" stays after a press. */
export const ACTION_RESULT_MS = 2000;

/** An action: pressed, it says "Feito" for 2 s once Home Assistant takes it, or "Sem resposta" when the call fails. */
export class HubbActionButton extends LitElement {
  static properties = {
    hass: { attribute: false },
    item: { attribute: false },
    path: { attribute: false },
    result: { state: true },
  };

  declare hass: HomeAssistant | undefined;
  declare item: ActionItem | undefined;
  /** A built-in icon path for an item with no icon of its own (the appliance commands). */
  declare path: string | null;
  declare result: 'done' | 'failed' | null;

  #timer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    super();
    this.hass = undefined;
    this.item = undefined;
    this.path = null;
    this.result = null;
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this.#timer) clearTimeout(this.#timer);
    this.#timer = null;
    this.result = null;
  }

  #show(result: 'done' | 'failed'): void {
    this.result = result;
    if (this.#timer) clearTimeout(this.#timer);
    this.#timer = setTimeout(() => {
      this.#timer = null;
      this.result = null;
    }, ACTION_RESULT_MS);
  }

  #press = (): void => {
    const { hass, item } = this;
    if (!hass || !item) return;
    if (hass.states[item.entityId]?.state === 'unavailable') {
      haptic('warning');
      return;
    }
    haptic('light');
    pressAction(hass, item.entityId).then(
      () => this.#show('done'),
      () => {
        haptic('failure');
        this.#show('failed');
      },
    );
  };

  render() {
    const item = this.item;
    if (!item) return nothing;
    const down = this.hass?.states[item.entityId]?.state === 'unavailable';
    const said = this.result === 'done' ? S.done : this.result === 'failed' || down ? S.noResponse : null;
    return html`<button class="action ${this.result ?? ''} ${down ? 'na' : ''}" @click=${this.#press}>
      <span class="icon">${item.icon ? html`<ha-icon .icon=${item.icon}></ha-icon>` : icon(this.path ?? mdiPlayCircleOutline)}</span>
      <span class="name">${item.name}</span>
      <!-- Always there, empty or not: "Feito" appearing must not move the buttons beside it. -->
      <span class="result" role="status">${said ?? ''}</span>
    </button>`;
  }

  static styles = css`
    :host {
      display: block;
      height: 100%;
    }
    .action {
      all: unset;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      gap: 8px;
      width: 100%;
      height: 100%;
      min-height: 72px;
      padding: 12px;
      border-radius: var(--hubb-radius, 16px);
      background: var(--hubb-surface);
      box-shadow: var(--hubb-card-shadow);
      color: var(--hubb-text);
      font-family: var(--hubb-font);
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;
    }
    .action:focus-visible {
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
      font-weight: 700;
      font-size: 13px;
      line-height: 1.25;
    }
    .result {
      min-height: 14px;
      font-size: 11px;
      font-weight: 600;
      color: var(--hubb-text-2);
    }
    .action.done .result {
      color: var(--hubb-amber-text);
    }
    .action.na {
      background: transparent;
      border: 1.5px dashed color-mix(in srgb, var(--hubb-text-2) 55%, transparent);
    }
    .action.na .icon {
      opacity: 0.5;
    }
  `;
}

define('hubb-action-button', HubbActionButton);
