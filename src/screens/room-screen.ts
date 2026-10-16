import { mdiCheck, mdiChevronLeft, mdiPencilOutline } from '@mdi/js';
import { css, html, nothing, type PropertyValues } from 'lit';
import { putBack, setEntity, setOrders, showEntity } from '../actions/dashboard-config';
import { setLight } from '../actions/light';
import { goBack } from '../actions/navigate';
import { artStyles, roomArt } from '../art/render';
import '../elements/access-tile';
import '../elements/action-button';
import '../elements/appliance-card';
import '../elements/appliance-panel';
import '../elements/climate-card';
import '../elements/climate-panel';
import '../elements/color-panel';
import '../elements/cover-panel';
import '../elements/cover-tile';
import { define } from '../elements/define';
import '../elements/dimmer-panel';
import '../elements/equipment-tile';
import '../elements/fan-tile';
import '../elements/item-editor';
import type { EditItem, EditRequest } from '../elements/item-editor';
import { icon } from '../elements/icon';
import '../elements/light-tile';
import '../elements/media-card';
import '../elements/media-panel';
import '../elements/nav-bar';
import '../elements/people-picker';
import '../elements/outlet-tile';
import '../elements/power-panel';
import '../elements/sensor-tile';
import '../elements/scene-button';
import '../elements/sheet';
import { isEditing, setEditing } from '../editing';
import { normalizeRoom } from '../model/build-house';
import { gateSensorCandidates } from '../model/gate-sensor';
import { hiddenForList } from '../model/visibility';
import { originOf } from '../model/origin';
import type { ItemKind } from '../model/config';
import type { HiddenItem, HubbConfig, Room, Shared } from '../model/types';
import { ACCESS, CLIMATE, COVER, EDIT, KIND_LABELS, MEDIA, POWER, roomTurnedOff, S, SENSE } from '../strings';
import { applianceSubheading, roomClimate, roomHeroStatus } from '../summary';
import { tokens } from '../theme/tokens';
import { HubbScreen } from './base';
import { sizeOf, type SizedKind } from '../model/sizes';
import { keepSheet, keptSheet } from '../sheets';

export interface RoomScreenConfig {
  type: string;
  room: Room;
  lightIds: string[];
  /** Name of the first tab of the bottom bar; "Casa" when missing (dashboards frozen on 2026.10.3). */
  homeLabel?: string;
  /** The dashboard configuration, for the editor; missing on frozen dashboards, which cannot be edited. */
  options?: HubbConfig;
  /** Alerts and the security tab; missing on dashboards frozen before M4. */
  shared?: Shared;
}

/** The sheets of a device (M3, and the consumption of M4), each named after the event that opens it (`hubb-open-climate`...). */
const DEVICE_SHEETS = ['climate', 'cover', 'media', 'power'] as const;
type DeviceSheet = (typeof DEVICE_SHEETS)[number];

export class HubbRoomScreen extends HubbScreen {
  static properties = {
    config: { attribute: false },
    dimmer: { state: true },
    appliance: { state: true },
    device: { state: true },
    editingItem: { state: true },
  };

  declare config: RoomScreenConfig | undefined;
  declare dimmer: { entityId: string; name: string } | null;
  /** The device of the appliance whose sheet is open. */
  declare appliance: string | null;
  /** The air conditioner, fan, curtain or player whose sheet is open. */
  declare device: { sheet: DeviceSheet; entityId: string } | null;
  /** The item whose editor is open, in the edit mode. */
  declare editingItem: EditItem | null;

  #onEdit = (e: Event): void => {
    const request = (e as CustomEvent<EditRequest>).detail;
    // "Quem vê" keeps the editor open, so the installer taps one person after another.
    if (!request.keepOpen) this.editingItem = null;
    void this.saveChange(request.message, async (hass, urlPath) => {
      const before = request.orders
        ? await setOrders(hass, urlPath, request.orders)
        : await setEntity(hass, urlPath, request.entityId, request.patch ?? {});
      return (h) => putBack(h, urlPath, before);
    });
  };

  #onOpenDimmer = (e: Event): void => {
    this.dimmer = (e as CustomEvent<{ entityId: string; name: string }>).detail;
  };

  #onOpenAppliance = (e: Event): void => {
    this.appliance = (e as CustomEvent<{ deviceId: string }>).detail.deviceId;
  };

  #onOpenDevice = (e: Event): void => {
    const sheet = e.type.slice('hubb-open-'.length) as DeviceSheet;
    this.device = { sheet, entityId: (e as CustomEvent<{ entityId: string }>).detail.entityId };
  };

  constructor() {
    super();
    this.config = undefined;
    this.dimmer = null;
    this.appliance = null;
    this.device = null;
    this.editingItem = null;
    this.addEventListener('hubb-open-dimmer', this.#onOpenDimmer);
    this.addEventListener('hubb-open-appliance', this.#onOpenAppliance);
    for (const sheet of DEVICE_SHEETS) this.addEventListener(`hubb-open-${sheet}`, this.#onOpenDevice);
  }

  setConfig(config: RoomScreenConfig): void {
    if (!config || !config.room) throw new Error('hubb-room-screen: missing room');
    this.config = { ...config, room: normalizeRoom(config.room) };
  }

  #reopened = false;

  protected willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed);
    const area = this.config?.room.areaId;
    if (!area) return;
    // The editor of an item survives the rebuild after a "Quem vê" tap: the new page opens it again.
    if (!this.#reopened) {
      this.#reopened = true;
      this.editingItem ??= keptSheet<EditItem>(`hubb-room-screen:${area}`);
    } else if (changed.has('editingItem')) keepSheet(`hubb-room-screen:${area}`, this.editingItem);
  }

  protected scope(): string[] {
    return this.config?.lightIds ?? [];
  }

  /** The class that sets how wide a card is: `entities.<id>.size`, or today's look. */
  #size(entityId: string, kind: SizedKind): string {
    return `size-${sizeOf(this.config?.options, entityId, kind)}`;
  }

  #turnOff(room: Room, onIds: string[]): void {
    const hass = this.hass;
    if (!hass || onIds.length === 0) return;
    this.undoable(onIds, roomTurnedOff(room.name, onIds.length), () => setLight(hass, onIds, false), { targets: onIds });
  }

  /** In the edit mode an item is a button that opens its editor; nothing switches by accident. */
  #editTiles<T extends { entityId: string; name: string }>(items: readonly T[], kindOf: ItemKind | ((item: T) => ItemKind)) {
    const siblings = items.map((i) => i.entityId);
    return items.map((i) => {
      const kind = typeof kindOf === 'function' ? kindOf(i) : kindOf;
      // Where it comes from, so two items with one name can be told apart (Gustavo, 14/10).
      const origin = this.hass ? originOf(this.hass, i.entityId) : null;
      // As wide as its card will be, so the installer sees the room as the residents will.
      return html`<button class="edit-tile ${this.#size(i.entityId, kind)}" @click=${() => (this.editingItem = { entityId: i.entityId, name: i.name, kind, siblings })}>
        <span class="icon">${icon(mdiPencilOutline)}</span>
        <span class="text"
          ><span class="name">${i.name}</span><span class="kind">${KIND_LABELS[kind]}</span>${origin
            ? html`<span class="origin">${origin}</span>`
            : nothing}<hubb-hidden-tag
            .hass=${this.hass}
            .ids=${hiddenForList(this.config?.options?.entities?.[i.entityId]?.hidden_for)}
          ></hubb-hidden-tag></span
        >
      </button>`;
    });
  }

  /** The name of the device whose sheet is open, as its card shows it. */
  #deviceName(room: Room, entityId: string): string {
    const item = [...room.climate, ...room.covers, ...room.media, ...room.outlets, ...room.equipment].find((i) => i.entityId === entityId);
    return item?.name ?? String(this.hass?.states[entityId]?.attributes.friendly_name ?? entityId);
  }

  #showItem(item: HiddenItem): void {
    void this.saveChange(EDIT.itemShown(item.name), (hass, urlPath) => showEntity(hass, urlPath, item.entityId));
  }

  render() {
    const hass = this.hass;
    const room = this.config?.room;
    if (!hass || !room) return nothing;
    const editable = this.canEdit(this.config?.options);
    const editing = editable && isEditing();
    // The contact of a gate speaks through its card; the edit mode still reaches it.
    const sensors = editing ? room.sensors : room.sensors.filter((s) => !s.pairedWith);
    const onIds = room.lights.filter((l) => hass.states[l.entityId]?.state === 'on').map((l) => l.entityId);
    const status = roomHeroStatus(room, hass);
    const open = this.appliance ? (room.appliances.find((a) => a.deviceId === this.appliance) ?? null) : null;
    const device = this.device;
    const climate = roomClimate(hass, room);
    return html`${this.strips(this.config?.shared)}<header
        class="hero ${room.photo ? 'photo' : ''} ${onIds.length ? 'lit' : ''}"
        style=${room.photo ? `--photo:url("${room.photo}")` : ''}
      >
        ${room.photo ? nothing : roomArt(room.art)}
        <button class="back" aria-label=${S.back} @click=${() => goBack()}>${icon(mdiChevronLeft)}</button>
        <div>
          <h1>${room.name}</h1>
          ${status ? html`<p>${status}</p>` : nothing}
          ${climate ? html`<p class="climate">${climate}</p>` : nothing}
        </div>
        ${editable
          ? html`<button class="edit ${editing ? 'on' : ''}" aria-label=${editing ? EDIT.done : EDIT.edit} @click=${() => setEditing(!editing)}>
              ${icon(editing ? mdiCheck : mdiPencilOutline)}
            </button>`
          : nothing}
      </header>
      <main>
        ${editing ? html`<p class="hint" role="status">${this.editNotice ?? EDIT.hintRoom}</p>` : nothing}
        ${!editing && (room.lights.length || room.scenes.length)
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
        ${room.access.length
          ? html`<h2>${ACCESS.title}</h2>
              <div class="grid">
                ${editing
                  ? this.#editTiles(room.access, (a) => (a.kind === 'lock' ? 'lock' : 'gate'))
                  : room.access.map(
                      (a) => html`<hubb-access-tile class=${this.#size(a.entityId, a.kind === 'lock' ? 'lock' : 'gate')} .hass=${hass} .item=${a}></hubb-access-tile>`,
                    )}
              </div>`
          : nothing}
        ${room.lights.length
          ? html`<h2>${S.lights}</h2>
              <div class="grid">
                ${editing
                  ? this.#editTiles(room.lights, 'light')
                  : room.lights.map((l) => html`<hubb-light-tile class=${this.#size(l.entityId, 'light')} .hass=${hass} .item=${l}></hubb-light-tile>`)}
              </div>`
          : nothing}
        ${room.climate.length
          ? html`<h2>${CLIMATE.title}</h2>
              <div class="grid">
                ${editing
                  ? this.#editTiles(room.climate, (c) => c.kind)
                  : room.climate.map((c) =>
                      c.kind === 'fan'
                        ? html`<hubb-fan-tile class=${this.#size(c.entityId, 'fan')} .hass=${hass} .item=${c}></hubb-fan-tile>`
                        : html`<hubb-climate-card class=${this.#size(c.entityId, 'climate')} .hass=${hass} .item=${c}></hubb-climate-card>`,
                    )}
              </div>`
          : nothing}
        ${room.covers.length
          ? html`<h2>${COVER.title}</h2>
              <div class="grid">
                ${editing
                  ? this.#editTiles(room.covers, 'cover')
                  : room.covers.map((c) => html`<hubb-cover-tile class=${this.#size(c.entityId, 'cover')} .hass=${hass} .item=${c}></hubb-cover-tile>`)}
              </div>`
          : nothing}
        ${room.media.length
          ? html`<h2>${MEDIA.title}</h2>
              <div class="grid">
                ${editing
                  ? this.#editTiles(room.media, 'media')
                  : room.media.map((m) => html`<hubb-media-card class=${this.#size(m.entityId, 'media')} .hass=${hass} .item=${m}></hubb-media-card>`)}
              </div>`
          : nothing}
        ${room.outlets.length || room.equipment.length
          ? html`<h2>${S.outlets}</h2>
              <div class="grid">
                ${editing
                  ? [this.#editTiles(room.outlets, 'outlet'), this.#editTiles(room.equipment, 'equipment')]
                  : [
                      room.outlets.map((o) => html`<hubb-outlet-tile class=${this.#size(o.entityId, 'outlet')} .hass=${hass} .item=${o}></hubb-outlet-tile>`),
                      room.equipment.map(
                        (q) => html`<hubb-equipment-tile class=${this.#size(q.entityId, 'equipment')} .hass=${hass} .item=${q}></hubb-equipment-tile>`,
                      ),
                    ]}
              </div>`
          : nothing}
        ${room.appliances.length
          ? html`<h2>${S.appliances}</h2>
              <div class="grid">
                ${editing
                  ? this.#editTiles(room.appliances, 'appliance')
                  : room.appliances.map(
                      (a) => html`<hubb-appliance-card class=${this.#size(a.entityId, 'appliance')} .hass=${hass} .item=${a}></hubb-appliance-card>`,
                    )}
              </div>`
          : nothing}
        ${room.actions.length
          ? html`<h2>${S.actions}</h2>
              <div class="grid">
                ${editing
                  ? this.#editTiles(room.actions, 'action')
                  : room.actions.map((a) => html`<hubb-action-button class=${this.#size(a.entityId, 'action')} .hass=${hass} .item=${a}></hubb-action-button>`)}
              </div>`
          : nothing}
        ${sensors.length
          ? html`<h2>${SENSE.title}</h2>
              <div class="grid">
                ${editing
                  ? this.#editTiles(sensors, (i) => i.kind)
                  : sensors.map((i) => html`<hubb-sensor-tile class=${this.#size(i.entityId, i.kind)} .hass=${hass} .item=${i}></hubb-sensor-tile>`)}
              </div>`
          : nothing}
        ${editing && room.hidden.length
          ? html`<div class="hidden-items">
              <h2>${EDIT.hiddenItems}</h2>
              ${room.hidden.map(
                (i) => html`<div class="hidden-row">
                  <span>${i.name}</span>
                  <button class="show" @click=${() => this.#showItem(i)}>${EDIT.show}</button>
                </div>`,
              )}
            </div>`
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
      <hubb-sheet
        class="device"
        ?open=${device !== null}
        heading=${device ? this.#deviceName(room, device.entityId) : ''}
        subheading=${device?.sheet === 'power' ? `${POWER.title} · ${room.name}` : room.name}
        @hubb-close=${() => (this.device = null)}
      >
        ${device?.sheet === 'climate'
          ? html`<hubb-climate-panel
              .hass=${hass}
              .entityId=${device.entityId}
              .allowed=${room.climate.find((c) => c.entityId === device.entityId) ?? null}
            ></hubb-climate-panel>`
          : nothing}
        ${device?.sheet === 'cover' ? html`<hubb-cover-panel .hass=${hass} .entityId=${device.entityId}></hubb-cover-panel>` : nothing}
        ${device?.sheet === 'media' ? html`<hubb-media-panel .hass=${hass} .entityId=${device.entityId}></hubb-media-panel>` : nothing}
        ${device?.sheet === 'power' ? html`<hubb-power-panel .hass=${hass} .item=${[...room.outlets, ...room.equipment].find((i) => i.entityId === device.entityId)}></hubb-power-panel>` : nothing}
      </hubb-sheet>
      <hubb-sheet
        class="item-sheet"
        ?open=${this.editingItem !== null}
        heading=${this.editingItem?.name ?? ''}
        subheading=${room.name}
        @hubb-close=${() => (this.editingItem = null)}
      >
        ${this.editingItem
          ? html`<hubb-item-editor
              .hass=${hass}
              .item=${this.editingItem}
              .roomAreaId=${room.areaId}
              .named=${!!this.config?.options?.entities?.[this.editingItem.entityId]?.name}
              .settings=${this.config?.options?.entities?.[this.editingItem.entityId]}
              .extras=${room.climate.find((c) => c.entityId === this.editingItem?.entityId)?.extras ?? []}
              .sensors=${this.editingItem.kind === 'gate' ? gateSensorCandidates(hass, this.config?.options ?? {}, room.areaId, this.editingItem.entityId) : []}
              @hubb-edit=${this.#onEdit}
            ></hubb-item-editor>`
          : nothing}
      </hubb-sheet>
      <hubb-toast></hubb-toast>
      <hubb-nav-bar
        current="home"
        home-label=${this.config?.homeLabel ?? S.home}
        ?security=${this.config?.shared?.security ?? false}
        .scenes=${this.config?.shared?.scenes ?? true}
      ></hubb-nav-bar>`;
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
      .hero p.climate {
        color: var(--hubb-text);
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
      /* Six columns: a card takes a third (small), half (medium) or the whole row (large), as the
         installer picks (entities.<id>.size). Cards with buttons or a slide are never small. */
      .grid {
        grid-template-columns: repeat(6, minmax(0, 1fr));
      }
      .grid > .size-small {
        grid-column: span 2;
      }
      .grid > .size-medium {
        grid-column: span 3;
      }
      .grid > .size-large {
        grid-column: 1 / -1;
      }
      .hero .edit {
        margin-left: auto;
      }
      .edit {
        all: unset;
        position: relative;
        flex: none;
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
      .edit svg,
      .edit-tile svg {
        width: 20px;
        height: 20px;
        fill: currentColor;
      }
      .edit:focus-visible,
      .edit-tile:focus-visible,
      .show:focus-visible {
        outline: 2px solid var(--hubb-focus);
        outline-offset: 2px;
      }
      .hint {
        margin: 0 2px 4px;
        padding: 10px 12px;
        border-radius: 12px;
        background: var(--hubb-surface);
        font-size: 12px;
        font-weight: 600;
        color: var(--hubb-text-2);
      }
      .edit-tile {
        all: unset;
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        gap: 10px;
        min-height: 96px;
        padding: 12px;
        border-radius: var(--hubb-radius, 16px);
        border: 1.5px dashed color-mix(in srgb, var(--hubb-text-2) 55%, transparent);
        background: var(--hubb-surface);
        color: var(--hubb-text);
        font-family: var(--hubb-font);
        cursor: pointer;
      }
      .edit-tile .icon {
        width: 30px;
        height: 30px;
        border-radius: 10px;
        display: grid;
        place-items: center;
        background: var(--hubb-surface-2);
        color: var(--hubb-text-2);
      }
      .edit-tile .name {
        display: block;
        font-weight: 700;
        font-size: 13px;
      }
      /* One line each: "Ar-condicionado" broke at its hyphen in a third of a phone. */
      .edit-tile .kind,
      .edit-tile .origin {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .edit-tile .origin {
        display: block;
        margin-top: 1px;
        font-size: 10px;
        font-weight: 600;
        color: var(--hubb-text-2);
        opacity: 0.85;
      }
      .edit-tile .kind {
        display: block;
        margin-top: 2px;
        font-size: 11px;
        font-weight: 600;
        color: var(--hubb-text-2);
      }
      .hidden-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        min-height: 52px;
        margin-bottom: 6px;
        padding: 0 4px 0 12px;
        border-radius: 14px;
        background: var(--hubb-surface);
        font-size: 13px;
        font-weight: 700;
      }
      .show {
        all: unset;
        box-sizing: border-box;
        min-height: 40px;
        padding: 0 12px;
        display: inline-flex;
        align-items: center;
        border-radius: 12px;
        background: var(--hubb-surface-2);
        font-size: 12px;
        font-weight: 700;
        cursor: pointer;
      }
    `,
  ];
}

define('hubb-room-screen', HubbRoomScreen);
