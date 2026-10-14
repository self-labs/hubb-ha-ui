import { mdiAlert, mdiWifiOff } from '@mdi/js';
import { LitElement, css, html, nothing } from 'lit';
import { haptic } from '../actions/haptic';
import { basePath, navigate } from '../actions/navigate';
import type { HomeAssistant } from '../ha/types';
import type { AlertItem } from '../model/types';
import { STRIP } from '../strings';
import { define } from './define';
import { icon } from './icon';

/** Alerts already announced with a buzz: module state, so another screen does not buzz again. */
const warned = new Set<string>();

/** For tests: forget the alerts already announced. */
export function resetWarned(): void {
  warned.clear();
}

/** Only `on` counts (`triggered` for an alarm): a sensor that is down or unknown raises nothing. */
export function alertActive(hass: HomeAssistant, a: AlertItem): boolean {
  const state = hass.states[a.entityId]?.state;
  return a.kind === 'alarm' ? state === 'triggered' : state === 'on';
}

function one(a: AlertItem): string {
  if (a.kind === 'alarm') return STRIP.alarm;
  const what = STRIP.kind[a.kind] ?? a.kind;
  return a.roomName ? STRIP.at(what, a.roomName) : (STRIP.detected[a.kind] ?? what);
}

/** "Fumaça · Cozinha", or "Fumaça · Cozinha e mais 1" when there are more. */
export function alertText(active: readonly AlertItem[]): string {
  const first = one(active[0]!);
  return active.length > 1 ? STRIP.more(first, active.length - 1) : first;
}

/**
 * The two strips at the top of every screen: an alert (smoke, gas, leak, the alarm going off), which
 * stays while the sensor is on and leads to its room; and the house out of reach.
 */
export class HubbStatusStrips extends LitElement {
  static properties = {
    hass: { attribute: false },
    alerts: { attribute: false },
  };

  declare hass: HomeAssistant | undefined;
  declare alerts: AlertItem[];

  constructor() {
    super();
    this.hass = undefined;
    this.alerts = [];
  }

  protected updated(): void {
    const hass = this.hass;
    if (!hass) return;
    for (const a of this.alerts) {
      if (!alertActive(hass, a)) warned.delete(a.entityId);
      else if (!warned.has(a.entityId)) {
        warned.add(a.entityId);
        haptic('warning');
      }
    }
  }

  render() {
    const hass = this.hass;
    if (!hass) return nothing;
    const active = this.alerts.filter((a) => alertActive(hass, a));
    // A roomless alert or the alarm lead to the security tab, where the alarm and the house are.
    const go = (): void => navigate(`${basePath()}/${active[0]?.path ?? 'seguranca'}`);
    return html`${active.length
      ? html`<div role="alert"><button class="alert" @click=${go}>${icon(mdiAlert)}<span>${alertText(active)}</span></button></div>`
      : nothing}${hass.connected === false
      ? html`<p class="offline" role="status">${icon(mdiWifiOff)}<span>${STRIP.offline}</span></p>`
      : nothing}`;
  }

  static styles = css`
    :host {
      display: block;
    }
    /* A button that must look like the strip below it: nothing of the browser's button stays. */
    .alert {
      all: unset;
    }
    .alert,
    .offline {
      box-sizing: border-box;
      display: flex;
      align-items: center;
      gap: 8px;
      width: calc(100% - 32px);
      max-width: 528px;
      min-height: 44px;
      margin: 8px auto 0;
      padding: 10px 14px;
      border-radius: 14px;
      font-family: var(--hubb-font);
      font-size: 13px;
      font-weight: 700;
      line-height: 1.3;
    }
    .alert {
      background: var(--hubb-alert-bg);
      color: var(--hubb-alert-ink);
      cursor: pointer;
    }
    .alert:focus-visible {
      outline: 2px solid var(--hubb-focus);
      outline-offset: 2px;
    }
    .offline {
      background: var(--hubb-surface-2);
      color: var(--hubb-text);
    }
    svg {
      flex: none;
      width: 18px;
      height: 18px;
      fill: currentColor;
    }
  `;
}

define('hubb-status-strips', HubbStatusStrips);
