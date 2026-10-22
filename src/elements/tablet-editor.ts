import { LitElement, css, html, nothing } from 'lit';
import type { HomeAssistant } from '../ha/types';
import { displayName } from '../model/names';
import { DEFAULT_REST, REST_CHOICES, slugify } from '../model/tablet';
import type { Room, TabletOverride } from '../model/types';
import { SETTINGS } from '../strings';
import { define } from './define';
import { unlisted } from './unlisted';

/** What the editor asks the home to save: the whole entry of the user, or null to drop it. */
export interface TabletChange {
  userId: string;
  patch: TabletOverride | null;
  message: string;
}

const PRESENCE_CLASSES = ['motion', 'occupancy', 'presence'];

/**
 * The wall tablet of one user, in Ajustes: whether the account is one, its room, the minutes before it
 * rests, what wakes it and which device of the app dims its screen. A "dumb" child: every change goes
 * up as `hubb-tablet`, and the home saves it with Desfazer.
 */
export class HubbTabletEditor extends LitElement {
  static properties = {
    hass: { attribute: false },
    rooms: { attribute: false },
    userId: { attribute: false },
    name: { attribute: false },
    value: { attribute: false },
  };

  declare hass: HomeAssistant | undefined;
  declare rooms: readonly Room[];
  declare userId: string;
  declare name: string;
  declare value: TabletOverride | null;

  constructor() {
    super();
    this.hass = undefined;
    this.rooms = [];
    this.userId = '';
    this.name = '';
    this.value = null;
  }

  #send(patch: TabletOverride | null): void {
    const message = patch === null ? SETTINGS.tabletOff(this.name) : this.value ? SETTINGS.tabletChanged(this.name) : SETTINGS.tabletOn(this.name);
    this.dispatchEvent(new CustomEvent<TabletChange>('hubb-tablet', { detail: { userId: this.userId, patch, message }, bubbles: true, composed: true }));
  }

  /**
   * One key of the entry, which the save merges into what is stored; a key set to nothing leaves. Only
   * that key: the entry this editor last drew may already be old when two changes come quickly.
   */
  #with(key: keyof TabletOverride, v: string | number | undefined): TabletOverride {
    return { [key]: v === '' ? undefined : v } as TabletOverride;
  }

  /** The sensors that can wake it: those of its room first, then every other one of the house. */
  #sensors(hass: HomeAssistant, roomId: string | undefined): [string, string][] {
    const own = this.rooms.find((r) => r.areaId === roomId)?.presence ?? [];
    const others = Object.keys(hass.states)
      .filter((id) => id.startsWith('binary_sensor.') && PRESENCE_CLASSES.includes(String(hass.states[id]!.attributes.device_class ?? '')))
      .filter((id) => !own.includes(id))
      .sort();
    return [...own, ...others].map((id) => [id, displayName(hass, id, null)]);
  }

  /** The devices of the Home Assistant app, by their name when the device is known. */
  #devices(hass: HomeAssistant): [string, string][] {
    return Object.keys(hass.services?.notify ?? {})
      .filter((s) => s.startsWith('mobile_app_'))
      .sort()
      .map((s) => {
        const dev = Object.values(hass.devices).find((d) => d.name && `mobile_app_${slugify(d.name)}` === s);
        return [s, dev?.name ?? s];
      });
  }

  render() {
    const hass = this.hass;
    if (!hass) return nothing;
    const on = this.value !== null;
    return html`<div class="row">
        <span class="label">${SETTINGS.isTablet}</span>
        <button
          class="switch is-tablet ${on ? 'on' : ''}"
          role="switch"
          aria-checked=${on ? 'true' : 'false'}
          aria-label=${SETTINGS.isTablet}
          @click=${() => this.#send(on ? null : { room: this.rooms[0]?.areaId })}
        >
          <i></i>
        </button>
      </div>
      ${on ? this.#settings(hass, this.value!) : nothing}`;
  }

  #settings(hass: HomeAssistant, v: TabletOverride) {
    const rest = v.rest_after ?? DEFAULT_REST;
    const sensors = this.#sensors(hass, v.room);
    const devices = this.#devices(hass);
    return html`<label class="field">
        <span class="label">${SETTINGS.room}</span>
        <select class="room" @change=${(e: Event) => this.#send(this.#with('room', (e.target as HTMLSelectElement).value))}>
          ${unlisted(v.room ?? '', this.rooms.map((r) => r.areaId), (x) => x)}
          ${this.rooms.map((r) => html`<option value=${r.areaId} ?selected=${r.areaId === v.room}>${r.name}</option>`)}
        </select>
      </label>
      <div class="field">
        <span class="label">${SETTINGS.restAfter}</span>
        <div class="rest">
          ${REST_CHOICES.map(
            (n) => html`<button class=${n === rest ? 'current' : ''} aria-pressed=${n === rest ? 'true' : 'false'} @click=${() => this.#send(this.#with('rest_after', n))}>
              ${n === 0 ? SETTINGS.never : SETTINGS.minutes(n)}
            </button>`,
          )}
        </div>
      </div>
      <label class="field">
        <span class="label">${SETTINGS.presence}</span>
        <select class="presence" @change=${(e: Event) => this.#send(this.#with('presence', (e.target as HTMLSelectElement).value))}>
          ${unlisted(v.presence ?? '', ['', ...sensors.map(([id]) => id), 'none'], (x) => x)}
          <option value="" ?selected=${!v.presence}>${SETTINGS.presenceRoom}</option>
          ${sensors.map(([id, name]) => html`<option value=${id} ?selected=${id === v.presence}>${name}</option>`)}
          <option value="none" ?selected=${v.presence === 'none'}>${SETTINGS.none}</option>
        </select>
      </label>
      <label class="field">
        <span class="label">${SETTINGS.device}</span>
        <select class="device" @change=${(e: Event) => this.#send(this.#with('notify', (e.target as HTMLSelectElement).value))}>
          ${unlisted(v.notify ?? '', ['', ...devices.map(([id]) => id)], (x) => x)}
          <option value="" ?selected=${!v.notify}>${SETTINGS.none}</option>
          ${devices.map(([id, name]) => html`<option value=${id} ?selected=${id === v.notify}>${name}</option>`)}
        </select>
      </label>`;
  }

  static styles = css`
    :host {
      display: grid;
      gap: 12px;
      font-family: var(--hubb-font);
      color: var(--hubb-text);
    }
    .row,
    .field {
      display: grid;
      gap: 6px;
    }
    .row {
      grid-template-columns: 1fr auto;
      align-items: center;
      min-height: 52px;
      padding: 0 12px;
      border-radius: 12px;
      background: var(--hubb-surface);
    }
    .label {
      font-size: 14px;
      font-weight: 700;
    }
    .field .label {
      font-size: 11px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--hubb-text-2);
    }
    select {
      box-sizing: border-box;
      width: 100%;
      min-height: 48px;
      padding: 0 12px;
      border: 1.5px solid color-mix(in srgb, var(--hubb-text-2) 35%, transparent);
      border-radius: 12px;
      background: var(--hubb-surface-2);
      color: var(--hubb-text);
      font-family: var(--hubb-font);
      font-size: 16px;
    }
    .rest {
      display: grid;
      grid-template-columns: repeat(5, minmax(0, 1fr));
      gap: 6px;
    }
    .rest button {
      all: unset;
      box-sizing: border-box;
      min-height: 44px;
      display: grid;
      place-items: center;
      border-radius: 12px;
      background: var(--hubb-surface);
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
    }
    .rest button.current {
      background: var(--hubb-primary-bg);
      color: var(--hubb-primary-ink);
    }
    .switch {
      all: unset;
      position: relative;
      width: 48px;
      height: 28px;
      border-radius: 14px;
      background: var(--hubb-surface-2);
      cursor: pointer;
    }
    .switch i {
      position: absolute;
      top: 3px;
      left: 3px;
      width: 22px;
      height: 22px;
      border-radius: 50%;
      background: var(--hubb-text-2);
      transition: transform var(--hubb-motion, 200ms) ease;
    }
    .switch.on {
      background: var(--hubb-amber);
    }
    .switch.on i {
      transform: translateX(20px);
      background: var(--hubb-amber-ink);
    }
    .switch:focus-visible,
    .rest button:focus-visible,
    select:focus-visible {
      outline: 2px solid var(--hubb-focus);
      outline-offset: 2px;
    }
  `;
}

define('hubb-tablet-editor', HubbTabletEditor);
