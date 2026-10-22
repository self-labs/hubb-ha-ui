import {
  mdiAlert,
  mdiAlertOutline,
  mdiDoorClosed,
  mdiDoorOpen,
  mdiGarage,
  mdiGarageOpen,
  mdiMotionSensor,
  mdiMotionSensorOff,
  mdiThermometer,
  mdiWaterPercent,
  mdiWindowClosedVariant,
  mdiWindowOpenVariant,
} from '@mdi/js';
import { LitElement, css, html, nothing } from 'lit';
import { degreeSign, degrees } from '../actions/climate';
import { haptic } from '../actions/haptic';
import type { HomeAssistant } from '../ha/types';
import type { DangerKind, SensorItem, SensorKind } from '../model/types';
import { S, SENSE, STRIP } from '../strings';
import { define } from './define';
import { icon } from './icon';

/** A sensor of a room, or a danger sensor that is on, listed on the security tab. */
export type TileItem = Omit<SensorItem, 'kind'> & { kind: SensorKind | DangerKind };

const ICONS: Readonly<Record<SensorKind | DangerKind, [on: string, off: string]>> = {
  door: [mdiDoorOpen, mdiDoorClosed],
  window: [mdiWindowOpenVariant, mdiWindowClosedVariant],
  garage_door: [mdiGarageOpen, mdiGarage],
  opening: [mdiDoorOpen, mdiDoorClosed],
  presence: [mdiMotionSensor, mdiMotionSensorOff],
  temperature: [mdiThermometer, mdiThermometer],
  humidity: [mdiWaterPercent, mdiWaterPercent],
  smoke: [mdiAlert, mdiAlertOutline],
  gas: [mdiAlert, mdiAlertOutline],
  carbon_monoxide: [mdiAlert, mdiAlertOutline],
  moisture: [mdiAlert, mdiAlertOutline],
};

const DANGER: ReadonlySet<string> = new Set<DangerKind>(['smoke', 'gas', 'carbon_monoxide', 'moisture']);

/** The icon of a door or window sensor in its state, for the chips of the home. */
export const sensorIcon = (kind: SensorKind | DangerKind, on: boolean): string => ICONS[kind][on ? 0 : 1];

/** What a sensor reads, in words: "Aberta", "Ocupado", "24,4°", "61%", "Fumaça detectada". */
export function sensorWords(hass: HomeAssistant, item: TileItem): { text: string; on: boolean } {
  const st = hass.states[item.entityId];
  if (!st || st.state === 'unavailable' || st.state === 'unknown' || st.state === '') return { text: S.noResponse, on: false };
  if (item.kind === 'temperature' || item.kind === 'humidity') {
    const v = Number(st.state);
    if (!Number.isFinite(v)) return { text: S.noResponse, on: false };
    return { text: item.kind === 'temperature' ? `${degrees(v)}${degreeSign(st.attributes.unit_of_measurement)}` : `${Math.round(v)}%`, on: false };
  }
  const on = st.state === 'on';
  if (item.kind === 'presence') return { text: on ? SENSE.occupied : SENSE.free, on };
  // A danger sensor that went quiet says it in Home Assistant's words: the tab lists only those on.
  if (DANGER.has(item.kind)) return { text: on ? (STRIP.detected[item.kind] ?? st.state) : (hass.formatEntityState?.(st) ?? st.state), on };
  return { text: (on ? SENSE.openState : SENSE.closedState)[item.kind] ?? st.state, on };
}

/**
 * A sensor on its room page or on the security tab: what it is and what it reads. A tap opens the
 * window of Home Assistant with its history; nothing here switches anything.
 */
export class HubbSensorTile extends LitElement {
  static properties = {
    hass: { attribute: false },
    item: { attribute: false },
  };

  declare hass: HomeAssistant | undefined;
  declare item: TileItem | undefined;

  constructor() {
    super();
    this.hass = undefined;
    this.item = undefined;
  }

  #open = (): void => {
    if (!this.item) return;
    haptic('selection');
    this.dispatchEvent(new CustomEvent('hass-more-info', { detail: { entityId: this.item.entityId }, bubbles: true, composed: true }));
  };

  render() {
    const { hass, item } = this;
    if (!hass || !item) return nothing;
    const { text, on } = sensorWords(hass, item);
    const down = text === S.noResponse;
    // Smoke, gas or a leak is the red of the strip, not the amber of an open door.
    const alert = on && DANGER.has(item.kind);
    return html`<button class="sensor ${on ? 'on' : ''} ${alert ? 'alert' : ''} ${down ? 'na' : ''}" @click=${this.#open}>
      <span class="icon">${icon(sensorIcon(item.kind, on))}</span>
      <span class="text"><span class="name">${item.name}</span><span class="state">${text}</span></span>
    </button>`;
  }

  static styles = css`
    :host {
      display: block;
    }
    .sensor {
      all: unset;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      gap: 8px;
      width: 100%;
      min-height: 80px;
      padding: 10px 12px;
      border-radius: var(--hubb-radius, 16px);
      background: var(--hubb-surface);
      box-shadow: var(--hubb-card-shadow);
      color: var(--hubb-text);
      font-family: var(--hubb-font);
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;
    }
    .sensor:focus-visible {
      outline: 2px solid var(--hubb-focus);
      outline-offset: 2px;
    }
    .icon {
      width: 28px;
      height: 28px;
      border-radius: 9px;
      display: grid;
      place-items: center;
      background: var(--hubb-surface-2);
      color: var(--hubb-text-2);
    }
    .icon svg {
      width: 17px;
      height: 17px;
      fill: currentColor;
    }
    .name {
      display: block;
      font-weight: 700;
      font-size: 12px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .state {
      display: block;
      margin-top: 2px;
      font-weight: 700;
      font-size: 14px;
    }
    .sensor.on .icon {
      background: var(--hubb-amber);
      color: var(--hubb-amber-ink);
    }
    .sensor.on .state {
      color: var(--hubb-amber-text);
    }
    .sensor.na .state {
      font-size: 12px;
      color: var(--hubb-text-2);
    }
    .sensor.alert {
      background: var(--hubb-alert-bg);
      color: var(--hubb-alert-ink);
    }
    .sensor.alert .icon {
      background: color-mix(in srgb, var(--hubb-alert-ink) 20%, transparent);
      color: inherit;
    }
    .sensor.alert .state {
      color: inherit;
    }
    /* The focus colour vanishes on the red: the words of the red ring it. */
    .sensor.alert:focus-visible {
      outline-color: var(--hubb-alert-ink);
    }
  `;
}

define('hubb-sensor-tile', HubbSensorTile);
