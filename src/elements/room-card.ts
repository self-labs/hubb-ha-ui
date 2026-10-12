import { LitElement, css, html, nothing } from 'lit';
import { haptic } from '../actions/haptic';
import { basePath, navigate } from '../actions/navigate';
import { artStyles, roomArt } from '../art/render';
import type { HomeAssistant } from '../ha/types';
import type { Room } from '../model/types';
import { onCount, outletsOnCount, S } from '../strings';
import { outletsOnIn } from '../summary';
import { define } from './define';

export class HubbRoomCard extends LitElement {
  static properties = {
    hass: { attribute: false },
    room: { attribute: false },
  };

  declare hass: HomeAssistant | undefined;
  declare room: Room | undefined;

  constructor() {
    super();
    this.hass = undefined;
    this.room = undefined;
  }

  #open = (): void => {
    if (!this.room) return;
    haptic('selection');
    navigate(`${basePath()}/${this.room.path}`, { back: true });
  };

  render() {
    const { hass, room } = this;
    if (!hass || !room) return nothing;
    const on = room.lights.filter((l) => hass.states[l.entityId]?.state === 'on').length;
    // A room with no lights speaks about its outlets instead of saying "Apagado".
    const outletsOnly = room.lights.length === 0 && room.outlets.length > 0;
    const plugged = outletsOnly ? outletsOnIn(room, hass) : 0;
    const status = outletsOnly ? (plugged ? outletsOnCount(plugged) : S.roomOutletsOff) : on ? onCount(on) : S.roomOff;
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
    `,
  ];
}

define('hubb-room-card', HubbRoomCard);
