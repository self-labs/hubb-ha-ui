import { LitElement, css, html, nothing } from 'lit';
import { haptic } from '../actions/haptic';
import type { HomeAssistant } from '../ha/types';
import { roomsOn, type FloorItem } from '../model/floors';
import type { Room } from '../model/types';
import { lightsCount, S } from '../strings';
import { lightsOnAcross } from '../summary';
import { define } from './define';

/** One button per floor, with the lights on of each floor; a tap asks the home to show that floor. */
export class HubbFloorTabs extends LitElement {
  static properties = {
    hass: { attribute: false },
    floors: { attribute: false },
    rooms: { attribute: false },
    current: { attribute: false },
  };

  declare hass: HomeAssistant | undefined;
  declare floors: FloorItem[];
  declare rooms: Room[];
  declare current: string | null;

  constructor() {
    super();
    this.hass = undefined;
    this.floors = [];
    this.rooms = [];
    this.current = null;
  }

  #pick(floorId: string): void {
    if (floorId === this.current) return;
    haptic('selection');
    this.dispatchEvent(new CustomEvent('hubb-floor', { detail: { floorId }, bubbles: true, composed: true }));
  }

  render() {
    const hass = this.hass;
    if (!hass || this.floors.length === 0) return nothing;
    return html`<div class="tabs" role="tablist" aria-label=${S.floors}>
      ${this.floors.map((f) => {
        const n = lightsOnAcross(roomsOn(this.rooms, f.floorId), hass);
        const cur = f.floorId === this.current;
        return html`<button
          role="tab"
          class=${cur ? 'cur' : ''}
          aria-selected=${cur ? 'true' : 'false'}
          aria-label=${n ? `${f.name}, ${lightsCount(n)}` : f.name}
          @click=${() => this.#pick(f.floorId)}
        ><span class="label">${f.name}</span>${n ? html`<span class="n">${n}</span>` : nothing}</button>`;
      })}
    </div>`;
  }

  static styles = css`
    :host {
      display: block;
    }
    /* Fixed height: the row never jumps when a number shows up. */
    .tabs {
      display: flex;
      gap: 6px;
      min-height: 44px;
      overflow-x: auto;
      scrollbar-width: none;
    }
    button {
      all: unset;
      box-sizing: border-box;
      flex: none;
      display: inline-flex;
      align-items: center;
      min-height: 44px;
      padding: 0 14px;
      border-radius: 12px;
      background: var(--hubb-surface);
      color: var(--hubb-text);
      font-family: var(--hubb-font);
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
    }
    button:focus-visible {
      outline: 2px solid var(--hubb-focus);
      outline-offset: 2px;
    }
    button.cur {
      background: var(--hubb-text);
      color: var(--hubb-bg);
    }
    .n {
      margin-left: 6px;
      color: var(--hubb-amber-text);
    }
    button.cur .n {
      color: inherit;
      opacity: 0.8;
    }
  `;
}

define('hubb-floor-tabs', HubbFloorTabs);
