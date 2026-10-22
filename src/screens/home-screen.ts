import {
  mdiCheck,
  mdiChevronLeft,
  mdiChevronRight,
  mdiCogOutline,
  mdiFlash,
  mdiLightbulbOnOutline,
  mdiPencilOutline,
  mdiShieldAlertOutline,
  mdiShieldCheckOutline,
  mdiSnowflake,
  mdiWrenchOutline,
} from '@mdi/js';
import { climateLine, setClimatePower } from '../actions/climate';
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
import { loadUsers, residents, type HaUser } from '../actions/people';
import '../elements/place-picker';
import { unlisted } from '../elements/unlisted';
import '../elements/tablet-editor';
import type { ProfileId } from '../model/profiles';
import type { TabletChange } from '../elements/tablet-editor';
import { DEFAULT_REST } from '../model/tablet';
import { staleEntries } from '../model/visibility';
import '../elements/clock';
import '../elements/room-card';
import '../elements/weather-now';
import { sensorIcon } from '../elements/sensor-tile';
import '../elements/scene-button';
import '../elements/sheet';
import type { HomeAssistant } from '../ha/types';
import { putBackRooms, putBackTablets, setRooms, setRootKeys, setTablets } from '../actions/dashboard-config';
import { isEditing, setEditing } from '../editing';
import { allLightIds, normalizeHouse } from '../model/build-house';
import { pickFloor, roomsOn } from '../model/floors';
import { reviewItems } from '../model/review';
import type { House, HubbConfig, Room, Shared } from '../model/types';
import { CLIMATE_ON, EDIT, greeting, lightsCount, lightsTurnedOff, onCount, PILLS, PLACE, REVIEW, S, SENSE, SETTINGS } from '../strings';
import { summaryPills, type Pill } from '../model/pills';
import { displayName } from '../model/names';
import {
  applianceChipText,
  applianceSubheading,
  busyAppliances,
  climateOn,
  findAppliance,
  lightsOnByRoom,
  openingWord,
  openNow,
  summarize,
} from '../summary';
import { pickRoom, wantedRoom } from '../model/pick-room';
import { onSelectionChange, rememberedRoom, selectedRoom, selectRoom } from '../selection';
import { layoutStyles } from '../theme/layout';
import './room-screen';
import '../elements/media-panel';
import '../elements/mini-player';
import { mediaView, nowPlaying } from '../model/media';
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
    settings: { state: true },
    climateSheet: { state: true },
    mediaId: { state: true },
  };

  static keptSheets = ['sheetIds', 'applianceId', 'peopleRoom', 'settings', 'climateSheet', 'mediaId'];

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
  /** Ajustes open on its list, or on the tablet of one user; null when closed. */
  declare settings: 'main' | { tablet: string } | null;
  /** The sheet of the air conditioners on: true while open (null, not false, when closed, for keptSheets). */
  declare climateSheet: true | null;
  /** The speaker whose sheet the music playing at the foot of the wide column opened. */
  declare mediaId: string | null;

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
    this.settings = null;
    this.climateSheet = null;
    this.mediaId = null;
    this.addEventListener('hubb-floor', this.#onFloor);
    this.addEventListener('hubb-select-room', (e) => selectRoom((e as CustomEvent<{ areaId: string }>).detail.areaId));
  }

  #unwatchSelection: (() => void) | null = null;

  connectedCallback(): void {
    super.connectedCallback();
    this.#unwatchSelection = onSelectionChange(() => this.requestUpdate());
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#unwatchSelection?.();
    this.#unwatchSelection = null;
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
    // Turned upright with a sheet of the room on the right open: the home has no room on its side any
    // more, so it goes to the page of that room, where the sheet opens again (src/sheets.ts).
    if (changed.has('screenLayout') && changed.get('screenLayout') === 'wide' && this.screenLayout !== 'wide') {
      const room = this.renderRoot.querySelector('hubb-room-screen[embedded]') as (HubbScreen & { config?: { room?: Room } }) | null;
      const path = room?.config?.room?.path;
      if (room && path && room.hasOpenSheet()) navigate(`${basePath()}/${path}`);
    }
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

  /** Wide, the two columns scroll by themselves too. */
  protected scrollers(): HTMLElement[] {
    const columns = [...this.renderRoot.querySelectorAll<HTMLElement>('.side, .pane')];
    return [this, ...columns];
  }

  #roomInEdit(hass: HomeAssistant, house: House, room: House['rooms'][number], picked: Room | null = null) {
    const at = house.rooms.indexOf(room);
    // Wide, a row that picks the room for the right side, as out of the edit mode: never its page.
    return html`<div class="room-edit" data-name=${room.name}>
      ${picked === null
        ? html`<hubb-room-card .hass=${hass} .room=${room}></hubb-room-card>`
        : html`<hubb-room-card variant="row" data-area=${room.areaId} ?selected=${room.areaId === picked.areaId} .hass=${hass} .room=${room}></hubb-room-card>`}
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

  /** Ajustes: the list of what the panel lets an administrator set, or the editor of one tablet. */
  #settingsContent(hass: HomeAssistant, house: House) {
    const settings = this.settings;
    const tablets = this.config?.options?.tablets ?? {};
    if (settings && typeof settings === 'object') {
      const user = (this.users ?? []).find((u) => u.id === settings.tablet);
      return html`<button class="back-settings" @click=${() => (this.settings = 'main')}>${icon(mdiChevronLeft)}${SETTINGS.back}</button>
        <hubb-tablet-editor
          .hass=${hass}
          .rooms=${house.rooms}
          .userId=${settings.tablet}
          .name=${user?.name ?? settings.tablet}
          .value=${tablets[settings.tablet] ?? null}
          @hubb-tablet=${this.#onTablet}
        ></hubb-tablet-editor>`;
    }
    const meters = Object.keys(hass.states)
      .filter((id) => id.startsWith('sensor.') && hass.states[id]!.attributes.device_class === 'power')
      .sort();
    const power = this.config?.options?.house_power ?? '';
    return html`<h2>${PLACE.title}</h2>
      <p class="settings-hint">${PLACE.hint}</p>
      <hubb-place-picker .value=${house.profile} @hubb-place=${this.#onPlace}></hubb-place-picker>
      <h2>${SETTINGS.power}</h2>
      <p class="settings-hint">${SETTINGS.powerHint}</p>
      <select class="house-power" aria-label=${SETTINGS.power} @change=${(e: Event) => this.#setHousePower((e.target as HTMLSelectElement).value)}>
        ${unlisted(power, ['', ...meters], (x) => x)}
        <option value="" ?selected=${!power}>${SETTINGS.none}</option>
        ${meters.map((id) => html`<option value=${id} ?selected=${id === power}>${displayName(hass, id, null)}</option>`)}
      </select>
      <h2>${SETTINGS.tablets}</h2>
      <p class="settings-hint">${SETTINGS.tabletsHint}</p>
      <div class="settings-list">
        ${residents(this.users ?? []).map((u) => {
          const t = tablets[u.id];
          const room = t?.room ? (house.rooms.find((r) => r.areaId === t.room)?.name ?? t.room) : null;
          const rest = (t?.rest_after ?? DEFAULT_REST) === 0 ? SETTINGS.restNever : SETTINGS.minutes(t?.rest_after ?? DEFAULT_REST);
          return html`<button class="tablet-user" @click=${() => (this.settings = { tablet: u.id })}>
            <span class="name">${u.name}</span>
            <span class="what">${t ? SETTINGS.summary(room ?? '', rest) : SETTINGS.notTablet}</span>
            ${icon(mdiChevronRight)}
          </button>`;
        })}
      </div>`;
  }

  /** One pill of the column of the wide home; a tap opens what it summarizes. */
  #pill(p: Pill, house: House, hass: HomeAssistant) {
    const icons: Record<Pill['kind'], string> = {
      lights: mdiLightbulbOnOutline,
      climate: mdiSnowflake,
      security: p.title === PILLS.allClosed ? mdiShieldCheckOutline : mdiShieldAlertOutline,
      energy: mdiFlash,
    };
    const open = (): void => {
      if (p.kind === 'lights') this.#openSheet(house, hass);
      else if (p.kind === 'climate') this.climateSheet = true;
      else if (p.kind === 'security') navigate(`${basePath()}/seguranca`, { replace: true });
      else {
        const power = this.config?.options?.house_power;
        if (power) this.dispatchEvent(new CustomEvent('hass-more-info', { detail: { entityId: power }, bubbles: true, composed: true }));
      }
    };
    return html`<button class="pill ${p.kind}" @click=${open}>
      <span class="pi">${icon(icons[p.kind])}</span>
      <span class="pw"><b>${p.title}</b><span>${p.detail}</span></span>
    </button>`;
  }

  /** "Clima ligado": every air conditioner on, each with Desligar, and all of them at once. */
  #climateContent(house: House, hass: HomeAssistant) {
    const airs = climateOn(house.rooms, hass);
    if (!airs.length) return html`<p class="settings-hint">${CLIMATE_ON.none}</p>`;
    return html`<button class="primary wide" @click=${() => airs.forEach((a) => this.#climateOff(hass, a.item.entityId))}>${CLIMATE_ON.allOff}</button>
      <div class="settings-list">
        ${airs.map((a) => {
          const st = hass.states[a.item.entityId];
          return html`<div class="climate-row">
            <span class="words"><span class="name">${a.item.name} · ${a.roomName}</span><span class="what">${st ? climateLine(st) : ''}</span></span>
            <button class="off" @click=${() => this.#climateOff(hass, a.item.entityId)}>${CLIMATE_ON.off}</button>
          </div>`;
        })}
      </div>`;
  }

  #climateOff(hass: HomeAssistant, entityId: string): void {
    const st = hass.states[entityId];
    if (!st) return;
    haptic('light');
    setClimatePower(hass, st, false).catch(() => haptic('failure'));
  }

  /** The power meter of the house, for the energy pill; saved at the root of the strategy, with Desfazer. */
  #setHousePower(value: string): void {
    void this.saveChange(value ? SETTINGS.powerSaved : SETTINGS.powerCleared, async (hass, urlPath) => {
      const before = await setRootKeys(hass, urlPath, { house_power: value || undefined });
      return (h) => setRootKeys(h, urlPath, before);
    });
  }

  #onPlace = (e: Event): void => {
    const { profile } = (e as CustomEvent<{ profile: ProfileId }>).detail;
    void this.saveChange(PLACE.saved(PLACE.names[profile]), async (hass, urlPath) => {
      const before = await setRootKeys(hass, urlPath, { profile });
      return (h) => setRootKeys(h, urlPath, before);
    });
  };

  #onTablet = (e: Event): void => {
    const { userId, patch, message } = (e as CustomEvent<TabletChange>).detail;
    void this.saveChange(message, async (hass, urlPath) => {
      const before = await setTablets(hass, urlPath, { [userId]: patch });
      return (h) => putBackTablets(h, urlPath, before);
    });
  };

  /** The room open on the right of the wide home: its own page, drawn inside this one. */
  #pane(hass: HomeAssistant, house: House, room: Room) {
    const config = {
      type: 'custom:hubb-room-screen',
      room,
      lightIds: allLightIds(house),
      homeLabel: house.homeLabel,
      options: this.config?.options,
      shared: this.config?.shared,
    };
    return html`<hubb-room-screen embedded .hass=${hass} .config=${config}></hubb-room-screen>`;
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
    // Wide: the room the tablet, a tap or this device asks for, on whatever floor it is. Its floor is the
    // one shown, unless a floor tab was tapped since.
    const wanted =
      this.screenLayout === 'wide'
        ? wantedRoom(house.rooms, { chosen: selectedRoom(), tablet: this.config?.shared?.tablet?.room ?? null, remembered: rememberedRoom() })
        : null;
    const floor = pickFloor(house.floors, this.floor || wanted?.floorId || null, this.floor || !house.floors.length ? null : rememberedFloor());
    // The strategy hands the configuration to the home exactly when it creates the review view for an
    // administrator; a dashboard frozen before the review has neither, and its key would lead nowhere.
    const admin = this.canEdit(this.config?.options);
    const editing = admin && isEditing();
    // The people who no longer exist count too, once the users are read (an empty list was not read).
    const options = this.config?.options ?? NO_OPTIONS;
    const stale = admin && this.users?.length ? staleEntries(options, new Set(this.users.map((u) => u.id))).length : 0;
    const pending = admin ? reviewItems(hass, options).length + stale : 0;
    const shown = floor === null ? house.rooms : roomsOn(house.rooms, floor);
    const airs = climateOn(house.rooms, hass);
    const pills = summaryPills(house, hass, { security: this.config?.shared?.security ?? false, housePower: this.config?.options?.house_power ?? null });
    // Wide: the house in a column on the left, a room open on the right (spec tablet, Section 3).
    const wide = this.screenLayout === 'wide' && house.rooms.length > 0;
    const picked = wide ? (wanted ?? pickRoom(shown, hass, { chosen: null, tablet: null, remembered: null })) : null;
    const playing = nowPlaying(house, hass, picked?.areaId ?? null);
    const adminTools = html`${admin
        ? html`<button class="key" aria-label=${REVIEW.key(pending)} @click=${() => this.#openReview()}>
            ${icon(mdiWrenchOutline)}${pending ? html`<span class="badge">${pending}</span>` : nothing}
          </button>`
        : nothing}
      ${editing
        ? html`<button class="settings-open" aria-label=${SETTINGS.title} @click=${() => (this.settings = 'main')}>${icon(mdiCogOutline)}</button>`
        : nothing}
      ${admin
        ? html`<button class="edit ${editing ? 'on' : ''}" aria-label=${editing ? EDIT.done : EDIT.edit} @click=${() => setEditing(!editing)}>
            ${icon(editing ? mdiCheck : mdiPencilOutline)}
          </button>`
        : nothing}`;
    // Wide: the time and the weather open the column (a wall tablet is read from across the room).
    const column = html`${wide
        ? html`<div class="clock-card">
              <div class="clock-top">
                <hubb-clock></hubb-clock>
                ${house.weatherEntityId ? html`<hubb-weather-now .hass=${hass} .entityId=${house.weatherEntityId} show="now"></hubb-weather-now>` : nothing}
              </div>
              ${house.weatherEntityId ? html`<hubb-weather-now .hass=${hass} .entityId=${house.weatherEntityId} show="hours"></hubb-weather-now>` : nothing}
            </div>
            ${admin ? html`<div class="tools side-tools">${adminTools}</div>` : nothing}`
        : html`<header>
            <div>
              <h1>${greeting(new Date().getHours())}${firstName ? `, ${firstName}` : ''}</h1>
              <p class="house">${house.name}</p>
            </div>
            <div class="tools">
              ${temp !== null && house.weatherEntityId
                ? html`<button class="weather" aria-label=${S.weather} @click=${() => this.#openWeather(house.weatherEntityId!)}>${temp}°</button>`
                : nothing}
              ${adminTools}
            </div>
          </header>`}
        ${editing ? html`<p class="hint" role="status">${this.editNotice ?? EDIT.hintHome}</p>` : nothing}
        ${house.rooms.length === 0
          ? this.#empty(hass)
          : html`<p class="headline">${summary.headline} ${summary.detail ? html`<span>${summary.detail}</span>` : nothing}</p>
              ${wide && pills.length ? html`<div class="pills">${pills.map((p) => this.#pill(p, house, hass))}</div>` : nothing}
              ${wide && !busy.length
                ? nothing
                : html`<div class="chips">
                ${!wide && summary.lightsOn > 0
                  ? html`<button class="chip on" @click=${() => this.#openSheet(house, hass)}>${onCount(summary.lightsOn)}</button>`
                  : nothing}
                ${!wide && airs.length ? html`<button class="chip on climate" @click=${() => (this.climateSheet = true)}>${PILLS.climateOn(airs.length)}</button>` : nothing}
                ${busy.map(
                  (b) =>
                    html`<button class="chip on" @click=${() => (this.applianceId = b.item.deviceId)}>${applianceChipText(hass, b.item)}</button>`,
                )}
                ${wide
                  ? nothing
                  : openNow(hass, house.rooms.flatMap((r) => r.openings)).map(
                      (o) =>
                        html`<button class="chip open" @click=${() => navigate(`${basePath()}/${o.path}`)}>
                          ${icon(sensorIcon(o.kind, true))}${SENSE.openAt(openingWord(o), o.roomName!)}
                        </button>`,
                    )}
              </div>`}
              ${house.scenes.length
                ? html`<h2>${S.scenes}</h2>
                    <div class="scenes">${house.scenes.slice(0, 4).map((s) => html`<hubb-scene-button variant="tile" .scene=${s}></hubb-scene-button>`)}</div>`
                : nothing}
              ${floor === null
                ? html`<h2>${S.rooms}</h2>`
                : html`<hubb-floor-tabs .hass=${hass} .floors=${house.floors} .rooms=${house.rooms} .current=${floor}></hubb-floor-tabs>`}
              ${wide
                ? html`<div class="rows">
                    ${shown.map((r) =>
                      editing
                        ? this.#roomInEdit(hass, house, r, picked)
                        : html`<hubb-room-card
                            variant="row"
                            data-area=${r.areaId}
                            ?selected=${r.areaId === picked?.areaId}
                            .hass=${hass}
                            .room=${r}
                          ></hubb-room-card>`,
                    )}
                  </div>`
                : html`<div class="rooms">
                    ${shown.map((r) => (editing ? this.#roomInEdit(hass, house, r) : html`<hubb-room-card .hass=${hass} .room=${r}></hubb-room-card>`))}
                  </div>`}
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
                : nothing}`}`;
    return html`${this.strips(this.config?.shared)}${wide
        ? html`<div class="wide-home">
            <aside class="side">
              ${column}
              ${playing
                ? html`<hubb-mini-player
                    class="playing"
                    .hass=${hass}
                    .item=${playing}
                    @hubb-open-media=${(e: CustomEvent<{ entityId: string }>) => (this.mediaId = e.detail.entityId)}
                  ></hubb-mini-player>`
                : nothing}
            </aside>
            <section class="pane">${picked ? keyed(picked.areaId, this.#pane(hass, house, picked)) : nothing}</section>
          </div>`
        : html`<main>${column}</main>`}
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
                .place=${this.place()}
                .hiddenFor=${peopleRoom.hiddenFor}
                @hubb-people=${(e: CustomEvent<PeopleChange>) => this.#setRoomPeople(peopleRoom, e.detail)}
              ></hubb-people-picker>`,
            )
          : nothing}
      </hubb-sheet>
      <hubb-sheet class="settings" ?open=${this.settings !== null} heading=${SETTINGS.title} @hubb-close=${() => (this.settings = null)}>
        ${this.settings ? this.#settingsContent(hass, house) : nothing}
      </hubb-sheet>
      <hubb-sheet
        class="media"
        ?open=${this.mediaId !== null}
        heading=${this.mediaId ? displayName(hass, this.mediaId, null) : ''}
        @hubb-close=${() => (this.mediaId = null)}
      >
        ${this.mediaId
          ? html`<hubb-media-panel .hass=${hass} .entityId=${this.mediaId} .visible=${this.config?.shared?.media ?? []}></hubb-media-panel>`
          : nothing}
      </hubb-sheet>
      <hubb-sheet class="climate-on" ?open=${this.climateSheet !== null} heading=${CLIMATE_ON.title} @hubb-close=${() => (this.climateSheet = null)}>
        ${this.climateSheet ? this.#climateContent(house, hass) : nothing}
      </hubb-sheet>
      <hubb-toast></hubb-toast>
      <hubb-nav-bar
        current="home"
        home-label=${house.homeLabel}
        .homeIcon=${this.homeIcon()}
        ?security=${this.config?.shared?.security ?? false}
        .scenes=${this.config?.shared?.scenes ?? true}
      ></hubb-nav-bar>${this.restLayer(
        [...pills.map((p) => p.title), playing ? mediaView(hass, playing.entityId).title : null].filter(Boolean).join(' · '),
        house.weatherEntityId,
      )}`;
  }

  static styles = [
    tokens,
    HubbScreen.baseStyles,
    layoutStyles,
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
      .key,
      .settings-open {
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
      .key:focus-visible,
      .settings-open:focus-visible,
      .tablet-user:focus-visible,
      .back-settings:focus-visible {
        outline: 2px solid var(--hubb-focus);
        outline-offset: 2px;
      }
      .key svg,
      .settings-open svg {
        width: 20px;
        height: 20px;
        fill: currentColor;
      }
      /* Ajustes: one row per resident, then the editor of the tablet of one of them. */
      .settings-hint {
        margin: 0 2px 10px;
        font-size: 13px;
        color: var(--hubb-text-2);
      }
      .settings-list {
        display: grid;
        gap: 6px;
      }
      .tablet-user {
        all: unset;
        box-sizing: border-box;
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        align-items: center;
        min-height: 56px;
        padding: 8px 12px;
        border-radius: 12px;
        background: var(--hubb-surface);
        cursor: pointer;
      }
      .tablet-user .name {
        font-size: 14px;
        font-weight: 700;
      }
      .tablet-user .what {
        grid-column: 1;
        font-size: 12px;
        color: var(--hubb-text-2);
      }
      .tablet-user svg {
        grid-row: 1 / span 2;
        grid-column: 2;
        width: 20px;
        height: 20px;
        fill: var(--hubb-text-2);
      }
      .back-settings {
        all: unset;
        display: inline-flex;
        align-items: center;
        gap: 4px;
        min-height: 44px;
        margin-bottom: 8px;
        font-size: 13px;
        font-weight: 700;
        color: var(--hubb-text-2);
        cursor: pointer;
      }
      .back-settings svg {
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
      :host([screen-layout='roomy']) .rooms {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }
      /* Wide: the house in a column on the left, a room on the right, each scrolling by itself, so the
         page under them never scrolls. Never sideways, and with no scroll bar: on a wall tablet a bar
         is only noise (Gustavo, 21/10, on the iPad Mini 5). */
      :host([screen-layout='wide']:not([embedded])) {
        display: flex;
        flex-direction: column;
        box-sizing: border-box;
        min-height: 0;
        height: calc(100vh - var(--hubb-area-top, 0px));
        height: calc(100dvh - var(--hubb-area-top, 0px));
      }
      :host([screen-layout='wide']:not([embedded])) hubb-status-strips {
        flex: none;
      }
      /* The rail put away: the handle that brings it back sits on the left edge, beside the column. */
      :host([rail-hidden]) .side {
        padding-left: 40px;
      }
      .wide-home {
        flex: 1 1 auto;
        min-height: 0;
        display: grid;
        grid-template-columns: clamp(300px, 32%, 380px) minmax(0, 1fr);
        grid-template-rows: minmax(0, 1fr);
      }
      .side,
      .pane {
        box-sizing: border-box;
        min-height: 0;
        overflow-x: hidden;
        overflow-y: auto;
        overscroll-behavior: contain;
        scrollbar-width: none;
      }
      .side::-webkit-scrollbar,
      .pane::-webkit-scrollbar {
        display: none;
      }
      .side {
        padding: 16px 12px 24px 16px;
      }
      .rows {
        display: grid;
        gap: 6px;
      }
      .clock-card {
        display: grid;
        gap: 10px;
        padding: 14px 16px;
        border-radius: var(--hubb-radius, 16px);
        background: var(--hubb-surface);
        box-shadow: var(--hubb-card-shadow);
      }
      .clock-top {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 12px;
      }
      .clock-top hubb-clock {
        min-width: 0;
      }
      .side-tools {
        justify-content: flex-end;
        margin-top: 8px;
      }
      /* The music playing stays at the foot of the column while its list scrolls. The column's bottom
         padding is the sticky edge, so the player reaches past it, and the page colour under it hides
         the rows passing below. */
      .playing {
        position: sticky;
        bottom: -24px;
        margin: 12px 0 -24px;
        padding: 8px 0 24px;
        background: var(--hubb-bg);
      }
      /* The summary of the house: two pills a row, each with its icon. */
      .pills {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 8px;
        margin-bottom: 10px;
      }
      .pill {
        all: unset;
        box-sizing: border-box;
        display: flex;
        align-items: center;
        gap: 10px;
        min-height: 56px;
        padding: 10px 12px;
        border-radius: var(--hubb-radius, 16px);
        background: var(--hubb-surface);
        box-shadow: var(--hubb-card-shadow);
        cursor: pointer;
      }
      .pill:focus-visible,
      .climate-row .off:focus-visible,
      .house-power:focus-visible {
        outline: 2px solid var(--hubb-focus);
        outline-offset: 2px;
      }
      .pi {
        flex: none;
        width: 34px;
        height: 34px;
        display: grid;
        place-items: center;
        border-radius: 11px;
        background: var(--hubb-surface-2);
      }
      .pi svg {
        width: 19px;
        height: 19px;
        fill: var(--hubb-text-2);
      }
      .pill.lights .pi {
        background: var(--hubb-amber);
      }
      .pill.lights .pi svg {
        fill: var(--hubb-amber-ink);
      }
      .pw {
        min-width: 0;
        display: grid;
      }
      .pw b {
        font-size: 13px;
      }
      .pw span {
        overflow: hidden;
        font-size: 11px;
        color: var(--hubb-text-2);
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .climate-row {
        display: flex;
        align-items: center;
        gap: 10px;
        min-height: 56px;
        padding: 8px 12px;
        border-radius: 12px;
        background: var(--hubb-surface);
      }
      .climate-row .words {
        flex: 1;
        min-width: 0;
        display: grid;
      }
      .climate-row .name {
        font-size: 14px;
        font-weight: 700;
      }
      .climate-row .what {
        font-size: 12px;
        color: var(--hubb-text-2);
      }
      .climate-row .off {
        all: unset;
        min-height: 40px;
        padding: 0 14px;
        border-radius: 12px;
        background: var(--hubb-surface-2);
        font-size: 13px;
        font-weight: 700;
        cursor: pointer;
      }
      .house-power {
        box-sizing: border-box;
        width: 100%;
        min-height: 48px;
        margin-bottom: 8px;
        padding: 0 12px;
        border: 1.5px solid color-mix(in srgb, var(--hubb-text-2) 35%, transparent);
        border-radius: 12px;
        background: var(--hubb-surface-2);
        color: var(--hubb-text);
        font-family: var(--hubb-font);
        font-size: 16px;
      }
      /* Two a row: at 1024 px the column is 300 px, and four tiles cut "Chegar em casa" mid-word. */
      .side .scenes {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
      .pane {
        min-width: 0;
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
