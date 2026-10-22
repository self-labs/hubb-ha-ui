import { LitElement, css, html, nothing } from 'lit';
import { haptic } from '../actions/haptic';
import { basePath, navigate } from '../actions/navigate';
import { artStyles, roomArt } from '../art/render';
import type { HomeAssistant } from '../ha/types';
import type { Room } from '../model/types';
import { roomCardStatus, roomTemperature } from '../summary';
import { define } from './define';

export class HubbRoomCard extends LitElement {
  static properties = {
    hass: { attribute: false },
    room: { attribute: false },
    variant: { reflect: true },
    selected: { type: Boolean, reflect: true },
  };

  declare hass: HomeAssistant | undefined;
  declare room: Room | undefined;
  /** A card of the home grid, or a row of the list of the wide home (it picks, it does not navigate). */
  declare variant: 'card' | 'row';
  /** The row of the room open on the right side of the wide home. */
  declare selected: boolean;

  constructor() {
    super();
    this.hass = undefined;
    this.room = undefined;
    this.variant = 'card';
    this.selected = false;
  }

  #open = (): void => {
    if (!this.room) return;
    haptic('selection');
    if (this.variant === 'row') {
      this.dispatchEvent(new CustomEvent('hubb-select-room', { detail: { areaId: this.room.areaId }, bubbles: true, composed: true }));
      return;
    }
    navigate(`${basePath()}/${this.room.path}`, { back: true });
  };

  render() {
    const { hass, room } = this;
    if (!hass || !room) return nothing;
    const on = room.lights.filter((l) => hass.states[l.entityId]?.state === 'on').length;
    // A room with no lights speaks about what it has instead of saying "Apagado".
    const status = roomCardStatus(room, hass);
    if (this.variant === 'row') {
      const temp = roomTemperature(hass, room);
      return html`<button class="row ${on ? 'on lit' : ''}" aria-current=${this.selected ? 'true' : 'false'} @click=${this.#open}>
        <span class="thumb">${roomArt(room.art)}</span>
        <span class="words"><span class="name">${room.name}</span><span class="status">${status}</span></span>
        ${temp ? html`<span class="temp">${temp}</span>` : nothing}
      </button>`;
    }
    return html`<button
      class="room ${on ? 'on lit' : ''} ${room.photo ? 'photo' : ''}"
      style=${room.photo ? `--photo:url("${room.photo}")` : ''}
      @click=${this.#open}
    >
      ${room.photo ? nothing : roomArt(room.art)}
      <span class="name">${room.name}</span><span class="status">${status}</span>
    </button>`;
  }

  static styles = [
    artStyles,
    css`
      :host {
        display: block;
      }
      .room {
        all: unset;
        box-sizing: border-box;
        position: relative;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        justify-content: flex-end;
        width: 100%;
        height: 96px;
        padding: 10px 12px;
        border-radius: var(--hubb-radius, 16px);
        background: var(--hubb-surface);
        box-shadow: var(--hubb-card-shadow);
        color: var(--hubb-text);
        font-family: var(--hubb-font);
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
      }
      .room:focus-visible {
        outline: 2px solid var(--hubb-focus);
        outline-offset: 2px;
      }
      /* The light pools on the right, where the lamp of the drawing is. */
      .room.on {
        background: radial-gradient(120% 90% at 85% 10%, var(--hubb-amber-tint), transparent 62%), var(--hubb-on-bg);
      }
      .room .art {
        right: -2px;
        bottom: 0;
        height: 92%;
        width: 64%;
      }
      /* The dark scrim only makes sense over a photo, with white text on top of it. */
      .room.photo {
        background: linear-gradient(180deg, transparent 30%, rgba(0, 0, 0, 0.55)), var(--photo) center / cover,
          var(--hubb-surface);
        color: #fff;
      }
      .room.photo.on {
        background: radial-gradient(120% 90% at 20% 0%, rgba(242, 201, 138, 0.35), transparent 60%),
          linear-gradient(180deg, transparent 30%, rgba(0, 0, 0, 0.45)), var(--photo) center / cover, var(--hubb-on-bg);
      }
      .name {
        position: relative;
        font-weight: 700;
        font-size: 13px;
      }
      .status {
        position: relative;
        font-size: 11px;
        font-weight: 600;
        opacity: 0.8;
      }
      .room.on .status {
        color: var(--hubb-amber-text);
        opacity: 1;
      }
      .room.photo.on .status {
        color: #f2c98a;
      }
      /* A row of the list of the wide home: the drawing small on the left, the temperature on the right. */
      .row {
        all: unset;
        box-sizing: border-box;
        display: flex;
        align-items: center;
        gap: 12px;
        width: 100%;
        min-height: 62px;
        padding: 8px 12px 8px 8px;
        border-radius: var(--hubb-radius, 16px);
        background: var(--hubb-surface);
        box-shadow: var(--hubb-card-shadow);
        color: var(--hubb-text);
        font-family: var(--hubb-font);
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
      }
      .row:focus-visible {
        outline: 2px solid var(--hubb-focus);
        outline-offset: 2px;
      }
      :host([selected]) .row {
        background: var(--hubb-surface-2);
        box-shadow: inset 3px 0 0 var(--hubb-amber);
      }
      .thumb {
        position: relative;
        flex: none;
        width: 64px;
        height: 46px;
        overflow: hidden;
        border-radius: 12px;
        background: color-mix(in srgb, var(--hubb-bg) 60%, transparent);
      }
      .thumb .art {
        inset: 0;
        width: 100%;
        height: 100%;
      }
      .words {
        flex: 1;
        min-width: 0;
        display: grid;
      }
      .row .name {
        font-size: 14px;
      }
      .row.on .status {
        color: var(--hubb-amber-text);
        opacity: 1;
      }
      .temp {
        flex: none;
        font-size: 13px;
        font-weight: 600;
        color: var(--hubb-text-2);
      }
    `,
  ];
}

define('hubb-room-card', HubbRoomCard);
