import {
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
import type { SensorItem, SensorKind } from '../model/types';
import { S, SENSE } from '../strings';
import { define } from './define';
import { icon } from './icon';

const ICONS: Readonly<Record<SensorKind, [on: string, off: string]>> = {
  door: [mdiDoorOpen, mdiDoorClosed],
  window: [mdiWindowOpenVariant, mdiWindowClosedVariant],
  garage_door: [mdiGarageOpen, mdiGarage],
  opening: [mdiDoorOpen, mdiDoorClosed],
  presence: [mdiMotionSensor, mdiMotionSensorOff],
  temperature: [mdiThermometer, mdiThermometer],
  humidity: [mdiWaterPercent, mdiWaterPercent],
};

/** The icon of a door or window sensor in its state, for the chips of the home. */
export const sensorIcon = (kind: SensorKind, on: boolean): string => ICONS[kind][on ? 0 : 1];

/** What a sensor reads, in words: "Aberta", "Ocupado", "24,4°", "61%"; null when it says nothing. */
export function sensorWords(hass: HomeAssistant, item: SensorItem): { text: string; on: boolean } {
  const st = hass.states[item.entityId];
  if (!st || st.state === 'unavailable' || st.state === 'unknown' || st.state === '') return { text: S.noResponse, on: false };
  if (item.kind === 'temperature' || item.kind === 'humidity') {
    const v = Number(st.state);
    if (!Number.isFinite(v)) return { text: S.noResponse, on: false };
    return { text: item.kind === 'temperature' ? `${degrees(v)}${degreeSign(st.attributes.unit_of_measurement)}` : `${Math.round(v)}%`, on: false };
  }
  const on = st.state === 'on';
  if (item.kind === 'presence') return { text: on ? SENSE.occupied : SENSE.free, on };
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
  declare item: SensorItem | undefined;

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
    return html`<button class="sensor ${on ? 'on' : ''} ${down ? 'na' : ''}" @click=${this.#open}>
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
  `;
}

define('hubb-sensor-tile', HubbSensorTile);
