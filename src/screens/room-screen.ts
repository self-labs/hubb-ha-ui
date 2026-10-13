import { mdiChevronLeft } from '@mdi/js';
import { css, html, nothing } from 'lit';
import { setLight } from '../actions/light';
import { goBack } from '../actions/navigate';
import { artStyles, roomArt } from '../art/render';
import '../elements/action-button';
import '../elements/appliance-card';
import '../elements/appliance-panel';
import '../elements/color-panel';
import { define } from '../elements/define';
import '../elements/dimmer-panel';
import '../elements/equipment-tile';
import { icon } from '../elements/icon';
import '../elements/light-tile';
import '../elements/nav-bar';
import '../elements/outlet-tile';
import '../elements/scene-button';
import '../elements/sheet';
import { normalizeRoom } from '../model/build-house';
import type { Room } from '../model/types';
import { roomTurnedOff, S } from '../strings';
import { applianceSubheading, roomHeroStatus } from '../summary';
import { tokens } from '../theme/tokens';
import { HubbScreen } from './base';

export interface RoomScreenConfig {
  type: string;
  room: Room;
  lightIds: string[];
  /** Name of the first tab of the bottom bar; "Casa" when missing (dashboards frozen on 2026.10.3). */
  homeLabel?: string;
}

export class HubbRoomScreen extends HubbScreen {
  static properties = {
    config: { attribute: false },
    dimmer: { state: true },
    appliance: { state: true },
  };

  declare config: RoomScreenConfig | undefined;
  declare dimmer: { entityId: string; name: string } | null;
  /** The device of the appliance whose sheet is open. */
  declare appliance: string | null;

  #onOpenDimmer = (e: Event): void => {
    this.dimmer = (e as CustomEvent<{ entityId: string; name: string }>).detail;
  };

  #onOpenAppliance = (e: Event): void => {
    this.appliance = (e as CustomEvent<{ deviceId: string }>).detail.deviceId;
  };

  constructor() {
    super();
    this.config = undefined;
    this.dimmer = null;
    this.appliance = null;
    this.addEventListener('hubb-open-dimmer', this.#onOpenDimmer);
    this.addEventListener('hubb-open-appliance', this.#onOpenAppliance);
  }

  setConfig(config: RoomScreenConfig): void {
    if (!config || !config.room) throw new Error('hubb-room-screen: missing room');
    this.config = { ...config, room: normalizeRoom(config.room) };
  }

  protected scope(): string[] {
    return this.config?.lightIds ?? [];
  }

  #turnOff(room: Room, onIds: string[]): void {
    const hass = this.hass;
    if (!hass || onIds.length === 0) return;
    this.undoable(onIds, roomTurnedOff(room.name, onIds.length), () => setLight(hass, onIds, false), { targets: onIds });
  }

  render() {
    const hass = this.hass;
    const room = this.config?.room;
    if (!hass || !room) return nothing;
    const onIds = room.lights.filter((l) => hass.states[l.entityId]?.state === 'on').map((l) => l.entityId);
    const status = roomHeroStatus(room, hass);
    const open = this.appliance ? (room.appliances.find((a) => a.deviceId === this.appliance) ?? null) : null;
    return html`<header
        class="hero ${room.photo ? 'photo' : ''} ${onIds.length ? 'lit' : ''}"
        style=${room.photo ? `--photo:url("${room.photo}")` : ''}
      >
        ${room.photo ? nothing : roomArt(room.art)}
        <button class="back" aria-label=${S.back} @click=${() => goBack()}>${icon(mdiChevronLeft)}</button>
        <div>
          <h1>${room.name}</h1>
          ${status ? html`<p>${status}</p>` : nothing}
        </div>
      </header>
      <main>
        ${room.lights.length || room.scenes.length
          ? html`<div class="actions">
              ${room.lights.length
                ? html`<!-- Always rendered when the room has lights: hiding it would push them down the moment one turns on. -->
                    <button
                      class="primary ${onIds.length ? '' : 'idle'}"
                      ?disabled=${onIds.length === 0}
                      aria-hidden=${onIds.length ? 'false' : 'true'}
                      @click=${() => this.#turnOff(room, onIds)}
                    >
                      ${S.turnRoomOff}
                    </button>`
                : nothing}
              ${room.scenes.map((s) => html`<hubb-scene-button variant="chip" .scene=${s}></hubb-scene-button>`)}
            </div>`
          : nothing}
        ${room.lights.length
          ? html`<h2>${S.lights}</h2>
              <div class="grid">${room.lights.map((l) => html`<hubb-light-tile .hass=${hass} .item=${l}></hubb-light-tile>`)}</div>`
          : nothing}
        ${room.outlets.length || room.equipment.length
          ? html`<h2>${S.outlets}</h2>
              <div class="grid">
                ${room.outlets.map((o) => html`<hubb-outlet-tile .hass=${hass} .item=${o}></hubb-outlet-tile>`)}
                ${room.equipment.map((q) => html`<hubb-equipment-tile .hass=${hass} .item=${q}></hubb-equipment-tile>`)}
              </div>`
          : nothing}
        ${room.appliances.length
          ? html`<h2>${S.appliances}</h2>
              <div class="grid">
                ${room.appliances.map((a) => html`<hubb-appliance-card .hass=${hass} .item=${a}></hubb-appliance-card>`)}
              </div>`
          : nothing}
        ${room.actions.length
          ? html`<h2>${S.actions}</h2>
              <div class="grid">${room.actions.map((a) => html`<hubb-action-button .hass=${hass} .item=${a}></hubb-action-button>`)}</div>`
          : nothing}
      </main>
      <hubb-sheet ?open=${this.dimmer !== null} heading=${this.dimmer?.name ?? ''} subheading=${room.name} @hubb-close=${() => (this.dimmer = null)}>
        ${this.dimmer
          ? html`<hubb-dimmer-panel .hass=${hass} .entityId=${this.dimmer.entityId}></hubb-dimmer-panel>
              <hubb-color-panel .hass=${hass} .entityId=${this.dimmer.entityId}></hubb-color-panel>`
          : nothing}
      </hubb-sheet>
      <hubb-sheet
        class="appliance"
        ?open=${open !== null}
        heading=${open?.name ?? ''}
        subheading=${open ? applianceSubheading(hass, open, room.name) : ''}
        @hubb-close=${() => (this.appliance = null)}
      >
        ${open ? html`<hubb-appliance-panel .hass=${hass} .item=${open}></hubb-appliance-panel>` : nothing}
      </hubb-sheet>
      <hubb-toast></hubb-toast>
      <hubb-nav-bar current="home" home-label=${this.config?.homeLabel ?? S.home}></hubb-nav-bar>`;
  }

  static styles = [
    tokens,
    HubbScreen.baseStyles,
    artStyles,
    css`
      /* Home Assistant already keeps the page below the status bar: no safe-area padding here. */
      .hero {
        position: relative;
        box-sizing: border-box;
        display: flex;
        align-items: center;
        gap: 12px;
        max-width: 560px;
        min-height: 76px;
        margin: 0 auto;
        padding: 12px 16px 4px;
        overflow: hidden;
      }
      .hero .art {
        top: 4px;
        right: 12px;
        width: 46%;
        height: calc(100% - 4px);
      }
      .hero > div {
        position: relative;
      }
      .hero.photo {
        max-width: none;
        min-height: 180px;
        align-items: flex-end;
        padding: 64px 16px 12px;
        background: linear-gradient(180deg, transparent 25%, var(--hubb-bg) 100%), var(--photo, none) center / cover;
      }
      .back {
        all: unset;
        position: relative;
        flex: none;
        width: 44px;
        height: 44px;
        display: grid;
        place-items: center;
        border-radius: 50%;
        background: var(--hubb-surface);
        color: var(--hubb-text);
        cursor: pointer;
      }
      .back:focus-visible {
        outline: 2px solid var(--hubb-focus);
        outline-offset: 2px;
      }
      .hero.photo .back {
        position: absolute;
        top: 12px;
        left: 12px;
        background: rgba(0, 0, 0, 0.3);
        color: #fff;
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
        min-height: 44px;
      }
      .primary.idle {
        visibility: hidden;
      }
      /* Wide: two of the three columns, so "Lavando · faltam 40 min" fits on one line. */
      hubb-appliance-card {
        grid-column: span 2;
      }
    `,
  ];
}

define('hubb-room-screen', HubbRoomScreen);
