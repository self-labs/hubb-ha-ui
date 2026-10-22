import { mdiCheck, mdiChevronLeft, mdiChevronRight, mdiPencilOutline, mdiWrenchOutline } from '@mdi/js';
import { css, html, nothing, type PropertyValues } from 'lit';
import { keyed } from 'lit/directives/keyed.js';
import { haptic } from '../actions/haptic';
import { setLight } from '../actions/light';
import { basePath, navigate } from '../actions/navigate';
import { define } from '../elements/define';
import { icon } from '../elements/icon';
import '../elements/appliance-panel';
import '../elements/floor-tabs';
import '../elements/light-tile';
import '../elements/nav-bar';
import '../elements/people-picker';
import type { PeopleChange } from '../elements/people-picker';
import { loadUsers, type HaUser } from '../actions/people';
import { staleEntries } from '../model/visibility';
import '../elements/room-card';
import { sensorIcon } from '../elements/sensor-tile';
import '../elements/scene-button';
import '../elements/sheet';
import type { HomeAssistant } from '../ha/types';
import { putBackRooms, setRooms } from '../actions/dashboard-config';
import { isEditing, setEditing } from '../editing';
import { allLightIds, normalizeHouse } from '../model/build-house';
import { pickFloor, roomsOn } from '../model/floors';
import { reviewItems } from '../model/review';
import type { House, HubbConfig, Room, Shared } from '../model/types';
import { EDIT, greeting, lightsCount, lightsTurnedOff, onCount, REVIEW, S, SENSE } from '../strings';
import {
  applianceChipText,
  applianceSubheading,
  busyAppliances,
  findAppliance,
  lightsOnByRoom,
  openingWord,
  openNow,
  summarize,
} from '../summary';
import { tokens } from '../theme/tokens';
import { HubbScreen } from './base';

export interface HomeScreenConfig {
  type: string;
  house: House;
  /** The dashboard configuration, for the number on the review key; missing on frozen dashboards. */
  options?: HubbConfig;
  /** Alerts and the security tab; missing on dashboards frozen before M4. */
  shared?: Shared;
}

/** One object for a missing configuration, so the cached review keeps its key. */
const NO_OPTIONS: HubbConfig = {};

function outsideTemp(hass: HomeAssistant, entityId: string | null): number | null {
  if (!entityId) return null;
  const t = hass.states[entityId]?.attributes.temperature;
  return typeof t === 'number' ? Math.round(t) : null;
}

/** The floor last opened on this device for this dashboard; null when the browser keeps no storage. */
function rememberedFloor(): string | null {
  try {
    return window.localStorage.getItem(`hubb-floor:${basePath()}`);
  } catch {
    return null;
  }
}

function rememberFloor(floorId: string): void {
  try {
    window.localStorage.setItem(`hubb-floor:${basePath()}`, floorId);
  } catch {
    // A private window or blocked storage: the floor is kept only while the page stays open.
  }
}

export class HubbHomeScreen extends HubbScreen {
  static properties = {
    config: { attribute: false },
    sheetIds: { state: true },
    applianceId: { state: true },
    floor: { state: true },
    peopleRoom: { state: true },
    users: { state: true },
  };

  static keptSheets = ['sheetIds', 'applianceId', 'peopleRoom'];

  declare config: HomeScreenConfig | undefined;
  /** Lights that were on when the sheet opened; they stay listed while it is open. */
  declare sheetIds: string[] | null;
  /** The device of the appliance whose sheet is open on the home. */
  declare applianceId: string | null;
  /** The floor tab picked on this screen; null until the resident picks one. */
  declare floor: string | null;
  /** The room whose "Quem vê" sheet is open, by area id. */
  declare peopleRoom: string | null;
  /** Every user of Home Assistant, for the key of the review (administrators only); null until read. */
  declare users: HaUser[] | null;

  #loadingUsers = false;

  #onFloor = (e: Event): void => {
    const floorId = (e as CustomEvent<{ floorId: string }>).detail.floorId;
    this.floor = floorId;
    rememberFloor(floorId);
  };

  constructor() {
    super();
    this.config = undefined;
    this.sheetIds = null;
    this.applianceId = null;
    this.floor = null;
    this.peopleRoom = null;
    this.users = null;
    this.addEventListener('hubb-floor', this.#onFloor);
  }

  setConfig(config: HomeScreenConfig): void {
    if (!config || !config.house) throw new Error('hubb-home-screen: missing house');
    this.config = { ...config, house: normalizeHouse(config.house) };
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
    this.undoable(on, lightsTurnedOff(on.length), () => setLight(hass, on, false), { targets: on });
  }

  #openReview(): void {
    haptic('selection');
    navigate(`${basePath()}/revisar`, { back: true });
  }

  /** The forecast is Home Assistant's own: its more-info dialog of the weather entity. */
  #openWeather(entityId: string): void {
    haptic('selection');
    this.dispatchEvent(new CustomEvent('hass-more-info', { detail: { entityId }, bubbles: true, composed: true }));
  }

  /** Moves a room one place in the order of the home and saves the order of every room. */
  #moveRoom(house: House, areaId: string, name: string, step: number): void {
    const ids = house.rooms.map((r) => r.areaId);
    const i = ids.indexOf(areaId);
    const j = i + step;
    if (i < 0 || j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j]!, ids[i]!];
    const patches = Object.fromEntries(ids.map((id, n) => [id, { order: n + 1 }]));
    void this.saveChange(EDIT.moved(name), async (hass, urlPath) => {
      const before = await setRooms(hass, urlPath, patches);
      return (h) => putBackRooms(h, urlPath, before);
    });
  }

  #setRoomHidden(areaId: string, hidden: boolean, message: string): void {
    void this.saveChange(message, async (hass, urlPath) => {
      const before = await setRooms(hass, urlPath, { [areaId]: { hidden: hidden ? true : undefined } });
      return (h) => putBackRooms(h, urlPath, before);
    });
  }

  protected willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed);
    if (this.hass && this.canEdit(this.config?.options) && this.users === null && !this.#loadingUsers) {
      this.#loadingUsers = true;
      void loadUsers(this.hass).then((users) => (this.users = users ?? []));
    }
  }

  #setRoomPeople(room: Room, change: PeopleChange): void {
    const message = change.sees ? EDIT.nowShownFor(room.name, change.person) : EDIT.nowHiddenFor(room.name, change.person);
    void this.saveChange(message, async (hass, urlPath) => {
      const before = await setRooms(hass, urlPath, { [room.areaId]: { hidden_for: change.hiddenFor.length ? change.hiddenFor : undefined } });
      return (h) => putBackRooms(h, urlPath, before);
    }).then((saved) => {
      // Not saved: the sheet closes, so the notice behind it can be read and the buttons start over.
      if (!saved) this.peopleRoom = null;
    });
  }

  #roomInEdit(hass: HomeAssistant, house: House, room: House['rooms'][number]) {
    const at = house.rooms.indexOf(room);
    return html`<div class="room-edit" data-name=${room.name}>
      <hubb-room-card .hass=${hass} .room=${room}></hubb-room-card>
      <div class="room-tools">
        <button class="tool before" aria-label=${`${room.name}: ${EDIT.before}`} ?disabled=${at <= 0} @click=${() => this.#moveRoom(house, room.areaId, room.name, -1)}>
          ${icon(mdiChevronLeft)}
        </button>
        <button
          class="tool after"
          aria-label=${`${room.name}: ${EDIT.after}`}
          ?disabled=${at >= house.rooms.length - 1}
          @click=${() => this.#moveRoom(house, room.areaId, room.name, 1)}
        >
          ${icon(mdiChevronRight)}
        </button>
        <button class="tool hide" @click=${() => this.#setRoomHidden(room.areaId, true, EDIT.roomHidden(room.name))}>
          ${EDIT.hideRoom}
        </button>
        <button class="tool people" @click=${() => (this.peopleRoom = room.areaId)}>${EDIT.whoSees}</button>
      </div>
      <hubb-hidden-tag .hass=${hass} .ids=${room.hiddenFor}></hubb-hidden-tag>
    </div>`;
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
    const busy = busyAppliances(house.rooms, hass);
    const open = this.applianceId ? findAppliance(house.rooms, this.applianceId) : null;
    const peopleRoom = house.rooms.find((r) => r.areaId === this.peopleRoom) ?? null;
    const floor = pickFloor(house.floors, this.floor, this.floor || !house.floors.length ? null : rememberedFloor());
    // The strategy hands the configuration to the home exactly when it creates the review view for an
    // administrator; a dashboard frozen before the review has neither, and its key would lead nowhere.
    const admin = this.canEdit(this.config?.options);
    const editing = admin && isEditing();
    // The people who no longer exist count too, once the users are read (an empty list was not read).
    const options = this.config?.options ?? NO_OPTIONS;
    const stale = admin && this.users?.length ? staleEntries(options, new Set(this.users.map((u) => u.id))).length : 0;
    const pending = admin ? reviewItems(hass, options).length + stale : 0;
    const shown = floor === null ? house.rooms : roomsOn(house.rooms, floor);
    return html`${this.strips(this.config?.shared)}<main>
        <header>
          <div>
            <h1>${greeting(new Date().getHours())}${firstName ? `, ${firstName}` : ''}</h1>
            <p class="house">${house.name}</p>
          </div>
          <div class="tools">
            ${temp !== null && house.weatherEntityId
              ? html`<button class="weather" aria-label=${S.weather} @click=${() => this.#openWeather(house.weatherEntityId!)}>${temp}°</button>`
              : nothing}
            ${admin
              ? html`<button class="key" aria-label=${REVIEW.key(pending)} @click=${() => this.#openReview()}>
                  ${icon(mdiWrenchOutline)}${pending ? html`<span class="badge">${pending}</span>` : nothing}
                </button>`
              : nothing}
            ${admin
              ? html`<button class="edit ${editing ? 'on' : ''}" aria-label=${editing ? EDIT.done : EDIT.edit} @click=${() => setEditing(!editing)}>
                  ${icon(editing ? mdiCheck : mdiPencilOutline)}
                </button>`
              : nothing}
          </div>
        </header>
        ${editing ? html`<p class="hint" role="status">${this.editNotice ?? EDIT.hintHome}</p>` : nothing}
        ${house.rooms.length === 0
          ? this.#empty(hass)
          : html`<p class="headline">${summary.headline} ${summary.detail ? html`<span>${summary.detail}</span>` : nothing}</p>
              <div class="chips">
                ${summary.lightsOn > 0
                  ? html`<button class="chip on" @click=${() => this.#openSheet(house, hass)}>${onCount(summary.lightsOn)}</button>`
                  : nothing}
                ${busy.map(
                  (b) =>
                    html`<button class="chip on" @click=${() => (this.applianceId = b.item.deviceId)}>${applianceChipText(hass, b.item)}</button>`,
                )}
                ${openNow(hass, house.rooms.flatMap((r) => r.openings)).map(
                  (o) =>
                    html`<button class="chip open" @click=${() => navigate(`${basePath()}/${o.path}`)}>
                      ${icon(sensorIcon(o.kind, true))}${SENSE.openAt(openingWord(o), o.roomName!)}
                    </button>`,
                )}
              </div>
              ${house.scenes.length
                ? html`<h2>${S.scenes}</h2>
                    <div class="scenes">${house.scenes.slice(0, 4).map((s) => html`<hubb-scene-button variant="tile" .scene=${s}></hubb-scene-button>`)}</div>`
                : nothing}
              ${floor === null
                ? html`<h2>${S.rooms}</h2>`
                : html`<hubb-floor-tabs .hass=${hass} .floors=${house.floors} .rooms=${house.rooms} .current=${floor}></hubb-floor-tabs>`}
              <div class="rooms">
                ${shown.map((r) => (editing ? this.#roomInEdit(hass, house, r) : html`<hubb-room-card .hass=${hass} .room=${r}></hubb-room-card>`))}
              </div>
              ${editing && house.hiddenRooms.length
                ? html`<div class="hidden-rooms">
                    <h2>${EDIT.hiddenRooms}</h2>
                    ${house.hiddenRooms.map(
                      (r) => html`<div class="hidden-row">
                        <span>${r.name}</span>
                        <button class="show" @click=${() => this.#setRoomHidden(r.areaId, false, EDIT.roomShown(r.name))}>${EDIT.show}</button>
                      </div>`,
                    )}
                  </div>`
                : nothing}`}
      </main>
      <hubb-sheet ?open=${ids !== null} heading=${S.lightsOnTitle} subheading=${ids ? lightsCount(ids.length) : ''} @hubb-close=${() => (this.sheetIds = null)}>
        ${ids ? this.#sheetContent(house, hass, ids) : nothing}
      </hubb-sheet>
      <hubb-sheet
        class="appliance"
        ?open=${open !== null}
        heading=${open?.item.name ?? ''}
        subheading=${open ? applianceSubheading(hass, open.item, open.room.name) : ''}
        @hubb-close=${() => (this.applianceId = null)}
      >
        ${open ? html`<hubb-appliance-panel .hass=${hass} .item=${open.item}></hubb-appliance-panel>` : nothing}
      </hubb-sheet>
      <hubb-sheet
        class="people"
        ?open=${peopleRoom !== null}
        heading=${EDIT.whoSeesRoom}
        subheading=${peopleRoom?.name ?? ''}
        @hubb-close=${() => (this.peopleRoom = null)}
      >
        ${peopleRoom
          ? // One picker per room: the taps on one never carry over to the next one opened.
            keyed(
              peopleRoom.areaId,
              html`<hubb-people-picker
                .hass=${hass}
                .hiddenFor=${peopleRoom.hiddenFor}
                @hubb-people=${(e: CustomEvent<PeopleChange>) => this.#setRoomPeople(peopleRoom, e.detail)}
              ></hubb-people-picker>`,
            )
          : nothing}
      </hubb-sheet>
      <hubb-toast></hubb-toast>
      <hubb-nav-bar
        current="home"
        home-label=${house.homeLabel}
        ?security=${this.config?.shared?.security ?? false}
        .scenes=${this.config?.shared?.scenes ?? true}
      ></hubb-nav-bar>`;
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
      .tools {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .key {
        all: unset;
        position: relative;
        box-sizing: border-box;
        width: 44px;
        height: 44px;
        display: grid;
        place-items: center;
        border-radius: 12px;
        background: var(--hubb-surface);
        color: var(--hubb-text-2);
        cursor: pointer;
      }
      .key:focus-visible {
        outline: 2px solid var(--hubb-focus);
        outline-offset: 2px;
      }
      .key svg {
        width: 20px;
        height: 20px;
        fill: currentColor;
      }
      .badge {
        position: absolute;
        top: 3px;
        right: 3px;
        box-sizing: border-box;
        min-width: 18px;
        height: 18px;
        padding: 0 5px;
        border-radius: 9px;
        background: var(--hubb-amber);
        color: var(--hubb-amber-ink);
        font-size: 10px;
        font-weight: 800;
        line-height: 18px;
        text-align: center;
      }
      /* The same size as the review key beside it, and a touch target too. */
      .weather {
        all: unset;
        box-sizing: border-box;
        height: 44px;
        min-width: 44px;
        padding: 0 10px;
        display: grid;
        place-items: center;
        border-radius: 12px;
        background: var(--hubb-surface);
        color: var(--hubb-text);
        font-family: var(--hubb-font);
        font-size: 12px;
        font-weight: 700;
        cursor: pointer;
      }
      .weather:focus-visible {
        outline: 2px solid var(--hubb-focus);
        outline-offset: 2px;
      }
      /* Reserved height, so the cards below stay put when the sentence grows or the chip shows. */
      /* A calm sentence, not a title: it was shouting over the rooms (Gustavo, 14/10). */
      .headline {
        min-height: calc(2 * 1.3em);
        margin: 16px 2px 10px;
        font-size: 16px;
        font-weight: 700;
        line-height: 1.3;
        letter-spacing: -0.01em;
      }
      .headline span {
        font-weight: 500;
        color: var(--hubb-text-2);
      }
      .chips {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        min-height: 44px;
      }
      .chip {
        all: unset;
        box-sizing: border-box;
        min-height: 44px;
        padding: 0 12px;
        display: inline-flex;
        align-items: center;
        border-radius: 12px;
        background: var(--hubb-surface);
        font-size: 12px;
        font-weight: 700;
        cursor: pointer;
      }
      /* The icon says it is a sensor of the house, not a button that switches something. */
      .chip.open {
        gap: 6px;
      }
      .chip.open svg {
        width: 16px;
        height: 16px;
        fill: currentColor;
      }
      .chip:focus-visible {
        outline: 2px solid var(--hubb-focus);
        outline-offset: 2px;
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
      hubb-floor-tabs {
        margin: 18px 0 10px;
      }
      .edit {
        all: unset;
        box-sizing: border-box;
        width: 44px;
        height: 44px;
        display: grid;
        place-items: center;
        border-radius: 12px;
        background: var(--hubb-surface);
        color: var(--hubb-text-2);
        cursor: pointer;
      }
      .edit.on {
        background: var(--hubb-primary-bg);
        color: var(--hubb-primary-ink);
      }
      .edit:focus-visible,
      .tool:focus-visible,
      .show:focus-visible {
        outline: 2px solid var(--hubb-focus);
        outline-offset: 2px;
      }
      .edit svg,
      .tool svg {
        width: 20px;
        height: 20px;
        fill: currentColor;
      }
      .hint {
        margin: 12px 2px 0;
        padding: 10px 12px;
        border-radius: 12px;
        background: var(--hubb-surface);
        font-size: 12px;
        font-weight: 600;
        color: var(--hubb-text-2);
      }
      .room-edit {
        display: grid;
        gap: 6px;
        min-width: 0;
      }
      /* Two arrows and Esconder fit under a half-width card on a phone. */
      .room-tools {
        display: grid;
        grid-template-columns: 40px 40px minmax(0, 1fr);
        gap: 6px;
      }
      .tool.people {
        grid-column: 1 / -1;
        justify-content: center;
      }
      .tool,
      .show {
        all: unset;
        box-sizing: border-box;
        min-width: 44px;
        min-height: 40px;
        padding: 0 10px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 4px;
        border-radius: 12px;
        background: var(--hubb-surface);
        color: var(--hubb-text);
        font-size: 12px;
        font-weight: 700;
        cursor: pointer;
      }
      .tool {
        min-width: 0;
        padding: 0 6px;
      }
      .tool[disabled] {
        opacity: 0.4;
        cursor: default;
      }
      .hidden-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        min-height: 52px;
        padding: 0 4px 0 12px;
        border-radius: 14px;
        background: var(--hubb-surface);
        font-size: 13px;
        font-weight: 700;
        margin-bottom: 6px;
      }
    `,
  ];
}

define('hubb-home-screen', HubbHomeScreen);
