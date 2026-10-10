import { css, html, nothing } from 'lit';
import { setLight } from '../actions/light';
import { define } from '../elements/define';
import '../elements/light-tile';
import '../elements/nav-bar';
import '../elements/room-card';
import '../elements/scene-button';
import '../elements/sheet';
import type { HomeAssistant } from '../ha/types';
import { allLightIds } from '../model/build-house';
import type { House } from '../model/types';
import { greeting, lightsCount, lightsTurnedOff, onCount, S } from '../strings';
import { lightsOnByRoom, summarize } from '../summary';
import { tokens } from '../theme/tokens';
import { HubbScreen } from './base';

export interface HomeScreenConfig {
  type: string;
  house: House;
}

function outsideTemp(hass: HomeAssistant, entityId: string | null): number | null {
  if (!entityId) return null;
  const t = hass.states[entityId]?.attributes.temperature;
  return typeof t === 'number' ? Math.round(t) : null;
}

export class HubbHomeScreen extends HubbScreen {
  static properties = {
    config: { attribute: false },
    sheetIds: { state: true },
  };

  declare config: HomeScreenConfig | undefined;
  /** Lights that were on when the sheet opened; they stay listed while it is open. */
  declare sheetIds: string[] | null;

  constructor() {
    super();
    this.config = undefined;
    this.sheetIds = null;
  }

  setConfig(config: HomeScreenConfig): void {
    if (!config || !config.house) throw new Error('hubb-home-screen: missing house');
    this.config = config;
  }

  protected scope(): string[] {
    return this.config ? allLightIds(this.config.house) : [];
  }

  #openSheet(house: House, hass: HomeAssistant): void {
    this.sheetIds = lightsOnByRoom(house, hass).flatMap((g) => g.on);
  }

  #turnAllOff(ids: string[]): void {
    const hass = this.hass;
    this.sheetIds = null;
    if (!hass) return;
    const on = ids.filter((id) => hass.states[id]?.state === 'on');
    if (on.length === 0) return;
    this.undoable(on, lightsTurnedOff(on.length), () => setLight(hass, on, false));
  }

  #empty(hass: HomeAssistant) {
    return html`<div class="empty">
      <strong>${S.emptyHouse}</strong>
      ${hass.user?.is_admin ? html`<span>${S.emptyHouseAdmin}</span>` : nothing}
    </div>`;
  }

  #sheetContent(house: House, hass: HomeAssistant, ids: string[]) {
    const groups = house.rooms
      .map((room) => ({ room, lights: room.lights.filter((l) => ids.includes(l.entityId)) }))
      .filter((g) => g.lights.length > 0);
    return html`<button class="primary wide" @click=${() => this.#turnAllOff(ids)}>${S.turnAllOff}</button>
      ${groups.map(
        (g) => html`<h2>${g.room.name}</h2>
          <div class="grid">${g.lights.map((l) => html`<hubb-light-tile .hass=${hass} .item=${l}></hubb-light-tile>`)}</div>`,
      )}`;
  }

  render() {
    const hass = this.hass;
    const house = this.config?.house;
    if (!hass || !house) return nothing;
    const summary = summarize(house, hass);
    const firstName = (hass.user?.name ?? '').trim().split(/\s+/)[0] ?? '';
    const temp = outsideTemp(hass, house.weatherEntityId);
    const ids = this.sheetIds;
    return html`<main>
        <header>
          <div>
            <h1>${greeting(new Date().getHours())}${firstName ? `, ${firstName}` : ''}</h1>
            <p class="house">${house.name}</p>
          </div>
          ${temp !== null ? html`<span class="weather">${temp}°</span>` : nothing}
        </header>
        ${house.rooms.length === 0
          ? this.#empty(hass)
          : html`<p class="headline">${summary.headline} ${summary.detail ? html`<span>${summary.detail}</span>` : nothing}</p>
              ${summary.lightsOn > 0
                ? html`<div class="chips"><button class="chip on" @click=${() => this.#openSheet(house, hass)}>${onCount(summary.lightsOn)}</button></div>`
                : nothing}
              ${house.scenes.length
                ? html`<h2>${S.scenes}</h2>
                    <div class="scenes">${house.scenes.slice(0, 4).map((s) => html`<hubb-scene-button variant="tile" .scene=${s}></hubb-scene-button>`)}</div>`
                : nothing}
              <h2>${S.rooms}</h2>
              <div class="rooms">${house.rooms.map((r) => html`<hubb-room-card .hass=${hass} .room=${r}></hubb-room-card>`)}</div>`}
      </main>
      <hubb-sheet ?open=${ids !== null} heading=${S.lightsOnTitle} subheading=${ids ? lightsCount(ids.length) : ''} @hubb-close=${() => (this.sheetIds = null)}>
        ${ids ? this.#sheetContent(house, hass, ids) : nothing}
      </hubb-sheet>
      <hubb-toast></hubb-toast>
      <hubb-nav-bar current="home"></hubb-nav-bar>`;
  }

  static styles = [
    tokens,
    HubbScreen.baseStyles,
    css`
      header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 12px;
      }
      h1 {
        margin: 0;
        font-size: 15px;
        font-weight: 700;
      }
      .house {
        margin: 2px 0 0;
        font-size: 12px;
        color: var(--hubb-text-2);
      }
      .weather {
        padding: 6px 10px;
        border-radius: 12px;
        background: var(--hubb-surface);
        font-size: 12px;
        font-weight: 700;
      }
      .headline {
        margin: 18px 2px 12px;
        font-size: 20px;
        font-weight: 800;
        line-height: 1.22;
        letter-spacing: -0.02em;
      }
      .headline span {
        font-weight: 500;
      }
      .chips {
        display: flex;
        gap: 6px;
      }
      .chip {
        all: unset;
        box-sizing: border-box;
        min-height: 36px;
        padding: 0 12px;
        display: inline-flex;
        align-items: center;
        border-radius: 12px;
        background: var(--hubb-surface);
        font-size: 12px;
        font-weight: 700;
        cursor: pointer;
      }
      .chip.on {
        background: var(--hubb-on-bg);
        color: var(--hubb-amber-text);
      }
      .scenes {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 6px;
      }
      .rooms {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 8px;
      }
      .wide {
        width: 100%;
        margin-bottom: 4px;
      }
    `,
  ];
}

define('hubb-home-screen', HubbHomeScreen);
