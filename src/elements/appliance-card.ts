import { mdiDevices, mdiDishwasher, mdiTumbleDryer, mdiWashingMachine } from '@mdi/js';
import { LitElement, css, html, nothing } from 'lit';
import { haptic } from '../actions/haptic';
import type { HomeAssistant } from '../ha/types';
import { applianceKind, progressPct, situation, type ApplianceItem, type ApplianceKind } from '../model/appliances';
import { applianceLine } from '../summary';
import { define } from './define';
import { icon } from './icon';

const ICONS: Readonly<Record<ApplianceKind, string>> = {
  dishwasher: mdiDishwasher,
  washer: mdiWashingMachine,
  dryer: mdiTumbleDryer,
  other: mdiDevices,
};

/** The icon of an appliance, from its name: a dishwasher, a washer, a dryer, or a generic device. */
export function applianceIcon(name: string): string {
  return ICONS[applianceKind(name)];
}

/** An appliance on its room page: the name and the state line, amber and the progress bar only while it works. */
export class HubbApplianceCard extends LitElement {
  static properties = {
    hass: { attribute: false },
    item: { attribute: false },
  };

  declare hass: HomeAssistant | undefined;
  declare item: ApplianceItem | undefined;

  constructor() {
    super();
    this.hass = undefined;
    this.item = undefined;
  }

  #open = (): void => {
    if (!this.item) return;
    haptic('selection');
    this.dispatchEvent(
      new CustomEvent('hubb-open-appliance', { detail: { deviceId: this.item.deviceId }, bubbles: true, composed: true }),
    );
  };

  render() {
    const { hass, item } = this;
    if (!hass || !item) return nothing;
    const working = situation(hass, item.parts) === 'working';
    const pct = working ? progressPct(hass, item.parts) : null;
    return html`<button class="appliance ${working ? 'on' : ''}" @click=${this.#open}>
      <span class="icon">${icon(applianceIcon(item.name))}</span>
      <span class="text"><span class="name">${item.name}</span><span class="state">${applianceLine(hass, item)}</span></span>
      ${pct !== null ? html`<span class="level" style="width:${pct}%"></span>` : nothing}
    </button>`;
  }

  static styles = css`
    :host {
      display: block;
    }
    .appliance {
      all: unset;
      box-sizing: border-box;
      position: relative;
      overflow: hidden;
      display: flex;
      align-items: center;
      gap: 10px;
      width: 100%;
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
    .appliance:focus-visible {
      outline: 2px solid var(--hubb-focus);
      outline-offset: 2px;
    }
    .icon {
      flex: none;
      width: 36px;
      height: 36px;
      border-radius: 12px;
      display: grid;
      place-items: center;
      background: var(--hubb-surface-2);
      color: var(--hubb-text-2);
    }
    .icon svg {
      width: 22px;
      height: 22px;
      fill: currentColor;
    }
    .text {
      min-width: 0;
    }
    .name {
      display: block;
      font-weight: 700;
      font-size: 13px;
    }
    .state {
      display: block;
      margin-top: 2px;
      font-weight: 600;
      font-size: 11px;
      color: var(--hubb-text-2);
    }
    .appliance.on {
      background: radial-gradient(110% 80% at 15% 0%, var(--hubb-amber-tint), transparent 65%), var(--hubb-on-bg);
    }
    .appliance.on .icon {
      background: var(--hubb-amber);
      color: var(--hubb-amber-ink);
    }
    .appliance.on .state {
      color: var(--hubb-amber-text);
    }
    .level {
      position: absolute;
      left: 0;
      bottom: 0;
      height: 4px;
      background: var(--hubb-amber);
      border-radius: 0 2px 2px 0;
    }
  `;
}

define('hubb-appliance-card', HubbApplianceCard);
