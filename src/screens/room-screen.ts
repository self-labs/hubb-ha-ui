import { mdiChevronLeft } from '@mdi/js';
import { css, html, nothing } from 'lit';
import { setLight } from '../actions/light';
import { goBack } from '../actions/navigate';
import { define } from '../elements/define';
import '../elements/dimmer-panel';
import { icon } from '../elements/icon';
import '../elements/light-tile';
import '../elements/nav-bar';
import '../elements/scene-button';
import '../elements/sheet';
import type { Room } from '../model/types';
import { roomStatus, roomTurnedOff, S } from '../strings';
import { tokens } from '../theme/tokens';
import { HubbScreen } from './base';

export interface RoomScreenConfig {
  type: string;
  room: Room;
  lightIds: string[];
}

export class HubbRoomScreen extends HubbScreen {
  static properties = {
    config: { attribute: false },
    dimmer: { state: true },
  };

  declare config: RoomScreenConfig | undefined;
  declare dimmer: { entityId: string; name: string } | null;

  #onOpenDimmer = (e: Event): void => {
    this.dimmer = (e as CustomEvent<{ entityId: string; name: string }>).detail;
  };

  constructor() {
    super();
    this.config = undefined;
    this.dimmer = null;
    this.addEventListener('hubb-open-dimmer', this.#onOpenDimmer);
  }

  setConfig(config: RoomScreenConfig): void {
    if (!config || !config.room) throw new Error('hubb-room-screen: missing room');
    this.config = config;
  }

  protected scope(): string[] {
    return this.config?.lightIds ?? [];
  }

  #turnOff(room: Room, onIds: string[]): void {
    const hass = this.hass;
    if (!hass || onIds.length === 0) return;
    this.undoable(onIds, roomTurnedOff(room.name, onIds.length), () => setLight(hass, onIds, false));
  }

  render() {
    const hass = this.hass;
    const room = this.config?.room;
    if (!hass || !room) return nothing;
    const onIds = room.lights.filter((l) => hass.states[l.entityId]?.state === 'on').map((l) => l.entityId);
    return html`<header class="hero" style=${room.photo ? `--photo:url("${room.photo}")` : ''}>
        <button class="back" aria-label=${S.back} @click=${() => goBack()}>${icon(mdiChevronLeft)}</button>
        <h1>${room.name}</h1>
        <p>${roomStatus(onIds.length, room.lights.length)}</p>
      </header>
      <main>
        ${onIds.length || room.scenes.length
          ? html`<div class="actions">
              ${onIds.length ? html`<button class="primary" @click=${() => this.#turnOff(room, onIds)}>${S.turnRoomOff}</button>` : nothing}
              ${room.scenes.map((s) => html`<hubb-scene-button variant="chip" .scene=${s}></hubb-scene-button>`)}
            </div>`
          : nothing}
        <h2>${S.lights}</h2>
        <div class="grid">${room.lights.map((l) => html`<hubb-light-tile .hass=${hass} .item=${l}></hubb-light-tile>`)}</div>
      </main>
      <hubb-sheet ?open=${this.dimmer !== null} heading=${this.dimmer?.name ?? ''} subheading=${room.name} @hubb-close=${() => (this.dimmer = null)}>
        ${this.dimmer ? html`<hubb-dimmer-panel .hass=${hass} .entityId=${this.dimmer.entityId}></hubb-dimmer-panel>` : nothing}
      </hubb-sheet>
      <hubb-toast></hubb-toast>
      <hubb-nav-bar current="home"></hubb-nav-bar>`;
  }

  static styles = [
    tokens,
    HubbScreen.baseStyles,
    css`
      .hero {
        position: relative;
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        justify-content: flex-end;
        min-height: 168px;
        padding: calc(56px + env(safe-area-inset-top)) 18px 14px;
        background: linear-gradient(180deg, transparent 25%, var(--hubb-bg) 100%), var(--photo, none) center / cover,
          linear-gradient(160deg, var(--hubb-surface-2), var(--hubb-bg) 75%);
      }
      .back {
        all: unset;
        position: absolute;
        top: calc(12px + env(safe-area-inset-top));
        left: 12px;
        width: 44px;
        height: 44px;
        display: grid;
        place-items: center;
        border-radius: 50%;
        background: rgba(0, 0, 0, 0.3);
        color: #fff;
        cursor: pointer;
      }
      .back svg {
        width: 24px;
        height: 24px;
        fill: currentColor;
      }
      h1 {
        margin: 0;
        font-size: 24px;
        font-weight: 800;
        letter-spacing: -0.02em;
      }
      .hero p {
        margin: 2px 0 0;
        font-size: 12px;
        font-weight: 600;
        color: var(--hubb-text-2);
      }
      main {
        padding-top: 8px;
      }
      .actions {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
    `,
  ];
}

define('hubb-room-screen', HubbRoomScreen);
