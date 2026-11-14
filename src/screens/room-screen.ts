import { mdiCheck, mdiChevronLeft, mdiPencilOutline } from '@mdi/js';
import { css, html, nothing, type PropertyValues } from 'lit';
import { putBack, setEntity, setOrders, showEntity } from '../actions/dashboard-config';
import { setLight } from '../actions/light';
import { basePath, goBack, navigate } from '../actions/navigate';
import { selectRoom } from '../selection';
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
import '../elements/scene-strip';
import '../elements/sheet';
import { isEditing, setEditing } from '../editing';
import { sceneIsOn } from '../model/scene-state';
import { normalizeRoom } from '../model/build-house';
import { gateSensorCandidates } from '../model/gate-sensor';
import { hiddenForList } from '../model/visibility';
import { originOf } from '../model/origin';
import type { ItemKind } from '../model/config';
import type { HiddenItem, HubbConfig, Room, Shared } from '../model/types';
import { ACCESS, CLIMATE, COVER, EDIT, FLAP, KIND_LABELS, MEDIA, POWER, roomTurnedOff, S, SENSE } from '../strings';
import { applianceSubheading, roomClimate, roomHeroStatus } from '../summary';
import { gridSpans, layoutStyles } from '../theme/layout';
import { tokens } from '../theme/tokens';
import { HubbScreen } from './base';
import { defaultSize, rowSpans, sizeOf, spanOf, type SizedKind } from '../model/sizes';

/** What sets the width of a card of a grid: which entity it is, what it is and the name it shows. */
interface Card {
  entityId: string;
  kind: SizedKind;
  name: string;
}

const cardsOf = <T extends { entityId: string; name: string }>(items: readonly T[], kindOf: SizedKind | ((item: T) => SizedKind)): Card[] =>
  items.map((i) => ({ entityId: i.entityId, name: i.name, kind: typeof kindOf === 'function' ? kindOf(i) : kindOf }));

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

/** The cards that take the whole row on a phone and half of it on a tablet. */
const HALF_ON_TABLET: ReadonlySet<SizedKind> = new Set<SizedKind>(['media', 'gate', 'lock']);

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

  static keptSheets = ['dimmer', 'appliance', 'device', 'editingItem'];

  protected sheetScope(): string {
    return this.config?.room.areaId ?? '';
  }

  #sentHome = false;

  protected willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed);
    // Wide, a room is the right side of the home: a link (an alert, a notification) or a tablet turned
    // on its side while a room is open lands there, with that room picked.
    const area = this.config?.room.areaId;
    if (!this.embedded && this.screenLayout === 'wide' && area && !this.#sentHome) {
      this.#sentHome = true;
      selectRoom(area);
      navigate(`${basePath()}/home`, { replace: true });
    }
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#sentHome = false;
  }

  protected scope(): string[] {
    return this.config?.lightIds ?? [];
  }

  /**
   * The class that sets how wide a card is: `entities.<id>.size`, else today's look; on a phone, half a row for a
   * long name. A gate, a lock or a speaker is the whole row on a phone and half of it on a tablet (`tablet-half`),
   * where the whole row would put its name and its slide or buttons at the two ends of the pane.
   */
  #size(entityId: string, kind: SizedKind, name: string): string {
    const size = sizeOf(this.config?.options, entityId, kind, this.screenLayout, name);
    return size === 'large' && HALF_ON_TABLET.has(kind) ? 'size-large tablet-half' : `size-${size}`;
  }

  /**
   * The width classes of the cards of one grid, in order: the size of each and, on a phone, the span that fills
   * its row when the card is the last of a row that is not the last of the grid (see `rowSpans`).
   */
  #classes(cards: readonly Card[]): string[] {
    const sizes = cards.map((c) => sizeOf(this.config?.options, c.entityId, c.kind, this.screenLayout, c.name));
    const spans = this.screenLayout === 'phone' ? rowSpans(sizes) : null;
    return sizes.map((size, n) => (spans && spans[n] !== spanOf(size) ? `size-${size} span-${spans[n]}` : `size-${size}`));
  }

  #turnOff(room: Room, onIds: string[]): void {
    const hass = this.hass;
    if (!hass || onIds.length === 0) return;
    this.undoable(onIds, roomTurnedOff(room.name, onIds.length), () => setLight(hass, onIds, false), { targets: onIds });
  }

  /** In the edit mode an item is a button that opens its editor; nothing switches by accident. */
  #editTiles<T extends { entityId: string; name: string }>(items: readonly T[], kindOf: ItemKind | ((item: T) => ItemKind), classes: readonly string[]) {
    const siblings = items.map((i) => i.entityId);
    return items.map((i, n) => {
      const kind = typeof kindOf === 'function' ? kindOf(i) : kindOf;
      // Where it comes from, so two items with one name can be told apart (Gustavo, 14/10).
      const origin = this.hass ? originOf(this.hass, i.entityId) : null;
      // As wide as its card will be, so the installer sees the room as the residents will.
      return html`<button
        class="edit-tile ${classes[n]}"
        @click=${() => (this.editingItem = { entityId: i.entityId, name: i.name, kind, siblings, autoSize: defaultSize(kind, this.screenLayout, i.name) })}
      >
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

  #climateBlock(room: Room, editing: boolean) {
    const hass = this.hass;
    if (!room.climate.length) return nothing;
    const classes = this.#classes(cardsOf(room.climate, (c) => c.kind));
    return html`<h2>${CLIMATE.title}</h2>
      <div class="grid">
        ${editing
          ? this.#editTiles(room.climate, (c) => c.kind, classes)
          : room.climate.map((c, n) =>
              c.kind === 'fan'
                ? html`<hubb-fan-tile class=${classes[n]} .hass=${hass} .item=${c}></hubb-fan-tile>`
                : html`<hubb-climate-card class=${classes[n]} .hass=${hass} .item=${c}></hubb-climate-card>`,
            )}
      </div>`;
  }

  #coversBlock(room: Room, editing: boolean) {
    const hass = this.hass;
    if (!room.covers.length) return nothing;
    const classes = this.#classes(cardsOf(room.covers, 'cover'));
    return html`<h2>${COVER.title}</h2>
      <div class="grid">
        ${editing
          ? this.#editTiles(room.covers, 'cover', classes)
          : room.covers.map((c, n) => html`<hubb-cover-tile class=${classes[n]} .hass=${hass} .item=${c}></hubb-cover-tile>`)}
      </div>`;
  }

  /** The flap of a ceiling TV: a cover shown as Flap, in its own block after Cortinas. */
  #flapsBlock(room: Room, editing: boolean) {
    const hass = this.hass;
    if (!room.flaps.length) return nothing;
    const classes = this.#classes(cardsOf(room.flaps, 'flap'));
    return html`<h2>${FLAP.title}</h2>
      <div class="grid">
        ${editing
          ? this.#editTiles(room.flaps, 'flap', classes)
          : room.flaps.map((f, n) => html`<hubb-cover-tile class=${classes[n]} .kind=${'flap'} .hass=${hass} .item=${f}></hubb-cover-tile>`)}
      </div>`;
  }
  #mediaBlock(room: Room, editing: boolean) {
    const hass = this.hass;
    if (!room.media.length) return nothing;
    return html`<h2>${MEDIA.title}</h2>
      <div class="grid">
        ${editing
          ? this.#editTiles(room.media, 'media', room.media.map((m) => this.#size(m.entityId, 'media', m.name)))
          : room.media.map((m) => html`<hubb-media-card class=${this.#size(m.entityId, 'media', m.name)} .hass=${hass} .item=${m} .pairs=${this.config?.shared?.mediaPairs ?? {}}></hubb-media-card>`)}
      </div>`;
  }

  /** The name of the device whose sheet is open, as its card shows it. */
  #deviceName(room: Room, entityId: string): string {
    const item = [...room.climate, ...room.covers, ...room.flaps, ...room.media, ...room.outlets, ...room.equipment].find((i) => i.entityId === entityId);
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
    // One list of classes per grid, in the order its cards are drawn: a row fills over the cards next to it.
    const lightClasses = this.#classes(cardsOf(room.lights, 'light'));
    const plugClasses = this.#classes([...cardsOf(room.outlets, 'outlet'), ...cardsOf(room.equipment, 'equipment')]);
    const actionClasses = this.#classes(cardsOf(room.actions, 'action'));
    const sensorClasses = this.#classes(cardsOf(sensors, (i) => i.kind));
    const onIds = room.lights.filter((l) => hass.states[l.entityId]?.state === 'on').map((l) => l.entityId);
    const status = roomHeroStatus(room, hass);
    const open = this.appliance ? (room.appliances.find((a) => a.deviceId === this.appliance) ?? null) : null;
    const device = this.device;
    const climate = roomClimate(hass, room);
    // Drawn inside the wide home, the room is only the room: the home has the strips, the pencil, the
    // undo and the rail, and nothing to go back to.
    const own = !this.embedded;
    // Wide, the air conditioner and the player sit side by side when the room has both.
    const pairUp = this.screenLayout === 'wide' && room.climate.length > 0 && room.media.length > 0;
    // Apagar tudo and the scenes on one line: the button stays in sight, dimmed with every light off, so
    // nothing moves when one turns on and no blank band is left. The scenes swipe sideways in what is
    // left of the line, so many of them never push the lights down (spec Cenas no cômodo, opção C).
    const actions =
      !editing && (room.lights.length || room.scenes.length)
        ? html`<div class="actions">
            ${room.lights.length
              ? html`<button class="primary ${onIds.length ? '' : 'idle'}" ?disabled=${onIds.length === 0} @click=${() => this.#turnOff(room, onIds)}>
                  ${S.turnRoomOff}
                </button>`
              : nothing}
            ${room.scenes.length
              ? html`<hubb-scene-strip class="scene-strip">
                  ${room.scenes.map((s) => html`<hubb-scene-button variant="chip" .scene=${s} .on=${sceneIsOn(hass, s)}></hubb-scene-button>`)}
                </hubb-scene-strip>`
              : nothing}
          </div>`
        : nothing;
    // Wide, they sit in the header beside the drawing, which is tall anyway: under it they left a
    // hole between the name of the room and its first block (the iPad Mini 5, 21/10).
    const actionsInHero = this.screenLayout === 'wide';
    return html`${own ? this.strips(this.config?.shared) : nothing}<header
        class="hero ${room.photo ? 'photo' : ''} ${onIds.length ? 'lit' : ''}"
        style=${room.photo ? `--photo:url("${room.photo}")` : ''}
      >
        ${room.photo ? nothing : roomArt(room.art)}
        <!-- Only the name beside the arrow: what follows starts at the edge, with the blocks under it. -->
        <div class="head">
          ${own ? html`<button class="back" aria-label=${S.back} @click=${() => goBack()}>${icon(mdiChevronLeft)}</button>` : nothing}
          <h1>${room.name}</h1>
          ${editable && own
            ? html`<button class="edit ${editing ? 'on' : ''}" aria-label=${editing ? EDIT.done : EDIT.edit} @click=${() => setEditing(!editing)}>
                ${icon(editing ? mdiCheck : mdiPencilOutline)}
              </button>`
            : nothing}
        </div>
        <div class="under">
          ${status ? html`<p>${status}</p>` : nothing}
          ${climate ? html`<p class="climate">${climate}</p>` : nothing}
          ${actionsInHero ? actions : nothing}
        </div>
      </header>
      <main>
        ${editing ? html`<p class="hint" role="status">${this.editNotice ?? EDIT.hintRoom}</p>` : nothing}
        ${actionsInHero ? nothing : actions}
        ${room.access.length
          ? html`<h2>${ACCESS.title}</h2>
              <div class="grid">
                ${editing
                  ? this.#editTiles(
                      room.access,
                      (a) => (a.kind === 'lock' ? 'lock' : 'gate'),
                      room.access.map((a) => this.#size(a.entityId, a.kind === 'lock' ? 'lock' : 'gate', a.name)),
                    )
                  : room.access.map(
                      (a) => html`<hubb-access-tile class=${this.#size(a.entityId, a.kind === 'lock' ? 'lock' : 'gate', a.name)} .hass=${hass} .item=${a}></hubb-access-tile>`,
                    )}
              </div>`
          : nothing}
        ${room.lights.length
          ? html`<h2>${S.lights}</h2>
              <div class="grid">
                ${editing
                  ? this.#editTiles(room.lights, 'light', lightClasses)
                  : room.lights.map((l, n) => html`<hubb-light-tile class=${lightClasses[n]} .sheetOnTap=${true} .hass=${hass} .item=${l}></hubb-light-tile>`)}
              </div>`
          : nothing}
        ${pairUp
          ? html`<div class="pair both"><section>${this.#climateBlock(room, editing)}</section><section>${this.#mediaBlock(room, editing)}</section></div>
              ${this.#coversBlock(room, editing)}${this.#flapsBlock(room, editing)}`
          : html`${this.#climateBlock(room, editing)}${this.#coversBlock(room, editing)}${this.#flapsBlock(room, editing)}${this.#mediaBlock(room, editing)}`}
        ${room.outlets.length || room.equipment.length
          ? html`<h2>${S.outlets}</h2>
              <div class="grid">
                ${editing
                  ? [
                      this.#editTiles(room.outlets, 'outlet', plugClasses.slice(0, room.outlets.length)),
                      this.#editTiles(room.equipment, 'equipment', plugClasses.slice(room.outlets.length)),
                    ]
                  : [
                      room.outlets.map((o, n) => html`<hubb-outlet-tile class=${plugClasses[n]} .sheetOnTap=${true} .hass=${hass} .item=${o}></hubb-outlet-tile>`),
                      room.equipment.map(
                        (q, n) => html`<hubb-equipment-tile class=${plugClasses[room.outlets.length + n]} .sheetOnTap=${true} .hass=${hass} .item=${q}></hubb-equipment-tile>`,
                      ),
                    ]}
              </div>`
          : nothing}
        ${room.appliances.length
          ? html`<h2>${S.appliances}</h2>
              <div class="grid">
                ${editing
                  ? this.#editTiles(room.appliances, 'appliance', room.appliances.map((a) => this.#size(a.entityId, 'appliance', a.name)))
                  : room.appliances.map(
                      (a) => html`<hubb-appliance-card class=${this.#size(a.entityId, 'appliance', a.name)} .hass=${hass} .item=${a}></hubb-appliance-card>`,
                    )}
              </div>`
          : nothing}
        ${room.actions.length
          ? html`<h2>${S.actions}</h2>
              <div class="grid">
                ${editing
                  ? this.#editTiles(room.actions, 'action', actionClasses)
                  : room.actions.map((a, n) => html`<hubb-action-button class=${actionClasses[n]} .hass=${hass} .item=${a}></hubb-action-button>`)}
              </div>`
          : nothing}
        ${sensors.length
          ? html`<h2>${SENSE.title}</h2>
              <div class="grid">
                ${editing
                  ? this.#editTiles(sensors, (i) => i.kind, sensorClasses)
                  : sensors.map((i, n) => html`<hubb-sensor-tile class=${sensorClasses[n]} .hass=${hass} .item=${i}></hubb-sensor-tile>`)}
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
        ${device?.sheet === 'cover'
          ? html`<hubb-cover-panel .hass=${hass} .entityId=${device.entityId} .kind=${room.flaps.some((f) => f.entityId === device.entityId) ? 'flap' : 'cover'}></hubb-cover-panel>`
          : nothing}
        ${device?.sheet === 'media' ? html`<hubb-media-panel .hass=${hass} .entityId=${device.entityId} .visible=${this.config?.shared?.media ?? []} .pairs=${this.config?.shared?.mediaPairs ?? {}}></hubb-media-panel>` : nothing}
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
              .place=${this.place()}
              .named=${!!this.config?.options?.entities?.[this.editingItem.entityId]?.name}
              .settings=${this.config?.options?.entities?.[this.editingItem.entityId]}
              .extras=${room.climate.find((c) => c.entityId === this.editingItem?.entityId)?.extras ?? []}
              .sensors=${this.editingItem.kind === 'gate' ? gateSensorCandidates(hass, this.config?.options ?? {}, room.areaId, this.editingItem.entityId) : []}
              @hubb-edit=${this.#onEdit}
            ></hubb-item-editor>`
          : nothing}
      </hubb-sheet>
      ${own
        ? html`<hubb-toast></hubb-toast>
            <hubb-nav-bar
              current="home"
              home-label=${this.config?.homeLabel ?? S.home}
              .homeIcon=${this.homeIcon()}
              ?security=${this.config?.shared?.security ?? false}
              .scenes=${this.config?.shared?.scenes ?? true}
              .media=${this.config?.shared?.mediaTab ?? false}
            ></hubb-nav-bar>`
        : nothing}${this.restLayer()}`;
  }

  static styles = [
    tokens,
    HubbScreen.baseStyles,
    layoutStyles,
    gridSpans,
    artStyles,
    css`
      /* Home Assistant already keeps the page below the status bar: no safe-area padding here. */
      .hero {
        position: relative;
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: flex-start;
        max-width: var(--hubb-col, 560px);
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
      .head {
        position: relative;
        display: flex;
        align-items: center;
        gap: 12px;
        width: 100%;
      }
      .under {
        position: relative;
        width: 100%;
      }
      .hero.photo {
        max-width: none;
        min-height: 180px;
        justify-content: flex-end;
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
        flex-wrap: nowrap;
        align-items: center;
        gap: 8px;
        min-height: 44px;
      }
      .actions .primary {
        flex: none;
      }
      /* In sight with every light off: hidden, it left a blank band of its height above the blocks. */
      .primary.idle {
        background: var(--hubb-surface);
        color: var(--hubb-text-2);
        cursor: default;
      }
      .scene-strip {
        flex: 1 1 0;
        min-width: 0;
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
      /* On a phone the last card of a row that is not the last of its grid takes what the row had left
         (rowSpans): a third beside half a row leaves a sixth, a pair of thirds before half a row two. */
      .grid > .span-3 {
        grid-column: span 3;
      }
      .grid > .span-4 {
        grid-column: span 4;
      }
      /* Wide: a tall header with the drawing large, the name, the status and the actions at its top,
         aligned with the clock card of the column; the air conditioner beside the player. */
      :host([screen-layout='wide']) .hero {
        min-height: 160px;
        align-items: flex-start;
        padding-top: 16px;
      }
      :host([screen-layout='wide']) .head,
      :host([screen-layout='wide']) .under {
        max-width: 50%;
      }
      :host([screen-layout='wide']) .hero .actions {
        margin-top: 14px;
      }
      :host([screen-layout='wide']) .hero .art {
        width: 52%;
      }
      /* A gate, a lock or a speaker is half a row on a tablet, not a strip across the pane; beside the air
         conditioner (.pair.both) it is already half of the pane, and fills it. */
      :host([screen-layout='roomy']) .grid > .size-large.tablet-half,
      :host([screen-layout='wide']) .grid > .size-large.tablet-half {
        grid-column: span 6;
      }
      :host([screen-layout='wide']) .pair.both .grid > .size-large.tablet-half {
        grid-column: 1 / -1;
      }
      :host([screen-layout='wide']) .pair.both {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 0 12px;
        align-items: start;
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
