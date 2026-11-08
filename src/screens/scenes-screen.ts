import { mdiCheck, mdiPencilOutline } from '@mdi/js';
import { css, html, nothing } from 'lit';
import { putBack, setEntity } from '../actions/dashboard-config';
import { isEditing, setEditing } from '../editing';
import { define } from '../elements/define';
import { icon } from '../elements/icon';
import '../elements/nav-bar';
import '../elements/people-picker';
import '../elements/scene-button';
import { unlisted } from '../elements/unlisted';
import type { HomeAssistant } from '../ha/types';
import { HOME_SCENES } from '../model/build-house';
import { areaOf, NO_ROOM } from '../model/classify';
import { displayName } from '../model/names';
import { sceneIsOn } from '../model/scene-state';
import type { EntityConfig, HubbConfig, SceneCandidate, SceneItem, Shared } from '../model/types';
import { sizeOf, sizesFor, type Size } from '../model/sizes';
import { hiddenForList } from '../model/visibility';
import { EDIT, ROLE_LABELS, S, SIZE_LABELS } from '../strings';
import { gridSpans, layoutStyles } from '../theme/layout';
import { tokens } from '../theme/tokens';
import { HubbScreen } from './base';

export interface ScenesScreenConfig {
  type: string;
  scenes: SceneItem[];
  lightIds: string[];
  /** Name of the first tab of the bottom bar; "Casa" when missing. */
  homeLabel?: string;
  /** Alerts and the security tab; missing on dashboards frozen before M4. */
  shared?: Shared;
  /** The dashboard configuration, for the edit mode; missing on dashboards frozen before it. */
  options?: HubbConfig;
  /** Scenes and scripts not in Cenas yet, for "Adicionar cena" (administrators only). */
  candidates?: SceneCandidate[];
}

/** What the settings of a scene offer in the edit mode, worked out once for the whole list. */
interface SceneChoices {
  areas: { areaId: string; name: string }[];
  /** `label` adds the room to the name, for the list. */
  lights: { entityId: string; name: string; label: string }[];
  /** How many scenes of Cenas are pinned to the home. */
  pinned: number;
}

const collator = new Intl.Collator('pt-BR', { sensitivity: 'base', numeric: true });

export class HubbScenesScreen extends HubbScreen {
  static properties = { config: { attribute: false } };

  static keptSheets = ['peopleTarget'];

  declare config: ScenesScreenConfig | undefined;

  constructor() {
    super();
    this.config = undefined;
  }

  setConfig(config: ScenesScreenConfig): void {
    if (!config || !Array.isArray(config.scenes)) throw new Error('hubb-scenes-screen: missing scenes');
    this.config = config;
  }

  protected scope(): string[] {
    return this.config?.lightIds ?? [];
  }

  /** One setting of a scene saved in the dashboard, with Desfazer. */
  #saveScene(scene: SceneItem, patch: Partial<EntityConfig>, message: string): void {
    void this.saveChange(message, async (hass, urlPath) => {
      const before = await setEntity(hass, urlPath, scene.entityId, patch);
      return (h) => putBack(h, urlPath, before);
    });
  }

  /** The room of a scene: '' for Padrão (its room in Home Assistant), `none` for only on Cenas, or an area. */
  #moveScene(scene: SceneItem, value: string): void {
    const hass = this.hass;
    if (!hass) return;
    if (!value) return this.#saveScene(scene, { area: undefined }, EDIT.sceneRoomBack(scene.name));
    if (value === NO_ROOM) return this.#saveScene(scene, { area: NO_ROOM }, EDIT.sceneRoomOff(scene.name));
    const room = hass.areas[value]?.name ?? value;
    // A room hidden for someone takes its scenes from them too (build-house.ts): the installer is told.
    const hiddenFor = hiddenForList(this.config?.options?.rooms?.[value]?.hidden_for);
    const message = hiddenFor.length ? `${EDIT.movedTo(scene.name, room)} ${EDIT.sceneRoomHiddenFor(room)}` : EDIT.movedTo(scene.name, room);
    this.#saveScene(scene, { area: value }, message);
  }

  /** The light or switch a scene's button follows; '' for none. */
  #follow(scene: SceneItem, value: string): void {
    const hass = this.hass;
    if (!hass) return;
    if (!value) return this.#saveScene(scene, { follows: undefined }, EDIT.followsCleared(scene.name));
    this.#saveScene(scene, { follows: value }, EDIT.followsSaved(scene.name, this.#lightName(hass, value)));
  }

  /** The room a scene has in Home Assistant, whatever the panel picked. */
  #haRoom(scene: SceneItem): string | null {
    const hass = this.hass;
    const areaId = hass ? areaOf(hass, scene.entityId) : null;
    return areaId ? (hass?.areas[areaId]?.name ?? null) : null;
  }

  /** A light as the panel names it: the name given in the editor, else the one of Home Assistant. */
  #lightName(hass: HomeAssistant, entityId: string): string {
    return this.config?.options?.entities?.[entityId]?.name ?? displayName(hass, entityId, null);
  }

  /** Puts a scene or a script in Cenas (the `scene` role), with Desfazer. */
  #add(candidate: SceneCandidate): void {
    void this.saveChange(EDIT.sceneAdded(candidate.name), async (hass, urlPath) => {
      const before = await setEntity(hass, urlPath, candidate.entityId, { role: 'scene' });
      return (h) => putBack(h, urlPath, before);
    });
  }

  /**
   * How wide a scene is on Cenas, with Desfazer. Always written: with no size a scene is half a row
   * on a phone and a quarter on a tablet, so the size picked here would be lost on one of them.
   */
  #resize(scene: SceneItem, size: Size): void {
    void this.saveChange(EDIT.sizeSaved(scene.name, SIZE_LABELS[size]), async (hass, urlPath) => {
      const before = await setEntity(hass, urlPath, scene.entityId, { size });
      return (h) => putBack(h, urlPath, before);
    });
  }

  /**
   * Its room, the light it follows and the home (spec Cenas no cômodo): two lists and a toggle. The
   * home takes four; a fifth waits until one of them leaves.
   */
  #sceneSettings(scene: SceneItem, choices: SceneChoices) {
    const entry = this.config?.options?.entities?.[scene.entityId];
    const room = entry?.area ?? '';
    const follows = entry?.follows ?? '';
    const pinned = entry?.pinned === true;
    const full = !pinned && choices.pinned >= HOME_SCENES;
    const roomId = `room-${scene.entityId}`;
    const followsId = `follows-${scene.entityId}`;
    return html`<div class="scene-settings">
      <div class="field">
        <label for=${roomId}>${EDIT.room}</label>
        <select id=${roomId} class="scene-room" @change=${(e: Event) => this.#moveScene(scene, (e.target as HTMLSelectElement).value)}>
          ${unlisted(room, ['', NO_ROOM, ...choices.areas.map((a) => a.areaId)], (x) => x)}
          <option value="" ?selected=${room === ''}>${EDIT.sceneRoomDefault(this.#haRoom(scene))}</option>
          <option value=${NO_ROOM} ?selected=${room === NO_ROOM}>${EDIT.sceneRoomNone}</option>
          ${choices.areas.map((a) => html`<option value=${a.areaId} ?selected=${room === a.areaId}>${a.name}</option>`)}
        </select>
      </div>
      <div class="field">
        <label for=${followsId}>${EDIT.follows}</label>
        <select id=${followsId} class="scene-follows" @change=${(e: Event) => this.#follow(scene, (e.target as HTMLSelectElement).value)}>
          ${unlisted(follows, ['', ...choices.lights.map((l) => l.entityId)], (x) => x)}
          <option value="" ?selected=${follows === ''}>${EDIT.followsNone}</option>
          ${choices.lights.map((l) => html`<option value=${l.entityId} ?selected=${follows === l.entityId}>${l.label}</option>`)}
        </select>
      </div>
      <div class="tools">
        <button
          class="tool pin"
          aria-pressed=${pinned ? 'true' : 'false'}
          ?disabled=${full}
          @click=${() => this.#saveScene(scene, { pinned: pinned ? undefined : true }, pinned ? EDIT.pinnedOff(scene.name) : EDIT.pinnedOn(scene.name))}
        >
          ${EDIT.pin}
        </button>
        ${full ? html`<span class="pin-full">${EDIT.pinFull}</span>` : nothing}
      </div>
    </div>`;
  }

  /** What the settings of every scene offer: the rooms and the lights by name, and how many are pinned. */
  #sceneChoices(hass: HomeAssistant, scenes: SceneItem[]): SceneChoices {
    const byName = (a: { name: string }, b: { name: string }): number => collator.compare(a.name, b.name);
    const entities = this.config?.options?.entities ?? {};
    return {
      areas: Object.values(hass.areas)
        .map((a) => ({ areaId: a.area_id, name: a.name }))
        .sort(byName),
      // A light or a switch the panel can show: not hidden in Home Assistant, not a setting of a device.
      // A house of many rooms repeats "Spot" and "Teto": each line says its room too.
      lights: Object.values(hass.entities)
        .filter((e) => /^(light|switch)\./.test(e.entity_id) && !e.hidden && !e.entity_category)
        .map((e) => {
          const name = this.#lightName(hass, e.entity_id);
          const room = hass.areas[areaOf(hass, e.entity_id, entities[e.entity_id]?.area) ?? '']?.name;
          return { entityId: e.entity_id, name, label: room ? `${name} · ${room}` : name };
        })
        .sort((a, b) => collator.compare(a.label, b.label)),
      pinned: scenes.filter((s) => entities[s.entityId]?.pinned === true).length,
    };
  }

  /** A scene in the edit mode: its name, what it is, Quem vê, Não mostrar and who it is hidden for. */
  #sceneInEdit(scene: SceneItem, twin: boolean, choices: SceneChoices) {
    const options = this.config?.options;
    const kind = scene.entityId.startsWith('scene.') ? EDIT.fromScene : EDIT.fromScript;
    // A scene and a script often share a name ("Desligar Kitnet"): the sheet says which one.
    const name = twin ? `${scene.name} · ${kind}` : scene.name;
    const size = sizeOf(options, scene.entityId, 'scene', this.screenLayout);
    // In the edit mode every scene takes the row, so its tools fit; its size shows on the buttons.
    return html`<div class="scene-edit">
      <strong>${scene.name}</strong>
      <span class="kind">${kind}</span>
      <div class="tools scene-tools">
        <button
          class="tool people"
          aria-label=${`${scene.name}: ${EDIT.whoSees}`}
          @click=${() => (this.peopleTarget = { kind: 'entity', entityId: scene.entityId, name })}
        >
          ${EDIT.whoSees}
        </button>
        <button class="tool hide" aria-label=${`${scene.name}: ${ROLE_LABELS.hidden}`} @click=${() => this.hideItem(scene.entityId, scene.name, options)}>
          ${ROLE_LABELS.hidden}
        </button>
        <hubb-hidden-tag .hass=${this.hass} .ids=${hiddenForList(options?.entities?.[scene.entityId]?.hidden_for)}></hubb-hidden-tag>
      </div>
      <div class="tools sizes" role="group" aria-label=${`${scene.name}: ${EDIT.size}`}>
        <span class="label">${EDIT.size}</span>
        ${sizesFor('scene').map(
          (s) =>
            html`<button
              class="tool size ${s === size ? 'current' : ''}"
              aria-pressed=${s === size ? 'true' : 'false'}
              ?disabled=${s === size}
              @click=${() => this.#resize(scene, s)}
            >
              ${SIZE_LABELS[s]}
            </button>`,
        )}
      </div>
      ${this.#sceneSettings(scene, choices)}
    </div>`;
  }

  /** A scene off the edit mode: a tile when small (like the home), a row otherwise. */
  #scene(scene: SceneItem) {
    const size = sizeOf(this.config?.options, scene.entityId, 'scene', this.screenLayout);
    return html`<hubb-scene-button class="size-${size}" variant=${size === 'small' ? 'tile' : 'row'} .scene=${scene} .on=${!!this.hass && sceneIsOn(this.hass, scene)}></hubb-scene-button>`;
  }

  render() {
    const hass = this.hass;
    const scenes = this.config?.scenes;
    if (!hass || !scenes) return nothing;
    const options = this.config?.options;
    const editable = this.canEdit(options);
    const editing = editable && isEditing();
    const candidates = editing ? (this.config?.candidates ?? []) : [];
    const choices = editing ? this.#sceneChoices(hass, scenes) : null;
    return html`${this.strips(this.config?.shared)}<main>
        <div class="title">
          <h1>${S.scenes}</h1>
          ${editable
            ? html`<button class="edit ${editing ? 'on' : ''}" aria-label=${editing ? EDIT.done : EDIT.edit} @click=${() => setEditing(!editing)}>
                ${icon(editing ? mdiCheck : mdiPencilOutline)}
              </button>`
            : nothing}
        </div>
        ${editing
          ? html`<p class="hint" role="status">${this.editNotice ?? EDIT.hintScenes}</p>
              <div class="tools">
                <button class="tool tab-people" @click=${() => (this.peopleTarget = { kind: 'tab', tab: 'scenes', name: S.scenes })}>
                  ${EDIT.whoSeesTab}
                </button>
                <hubb-hidden-tag .hass=${hass} .ids=${hiddenForList(options?.tabs?.scenes?.hidden_for)}></hubb-hidden-tag>
              </div>`
          : nothing}
        ${scenes.length
          ? html`<div class="list">
              ${scenes.map((s) =>
                choices
                  ? this.#sceneInEdit(s, scenes.filter((o) => o.name === s.name).length > 1, choices)
                  : this.#scene(s),
              )}
            </div>`
          : html`<div class="empty">
              <strong>${S.emptyScenes}</strong>
              ${hass.user?.is_admin ? html`<span>${S.emptyScenesAdmin}</span>` : nothing}
            </div>`}
        ${candidates.length
          ? html`<h2>${EDIT.addScene}</h2>
              <ul class="candidates">
                ${candidates.map(
                  (c) => html`<li>
                    <span class="what"
                      ><strong>${c.name}</strong
                      ><span>${c.entityId.startsWith('scene.') ? EDIT.fromScene : EDIT.fromScript}</span></span
                    >
                    <button class="tool add" aria-label=${`${c.name}: ${EDIT.add}`} @click=${() => this.#add(c)}>${EDIT.add}</button>
                  </li>`,
                )}
              </ul>`
          : nothing}
      </main>
      ${editing ? this.peopleSheet(options) : nothing}
      <hubb-toast></hubb-toast>
      <hubb-nav-bar
        current="scenes"
        home-label=${this.config?.homeLabel ?? S.home}
        .homeIcon=${this.homeIcon()}
        ?security=${this.config?.shared?.security ?? false}
        .scenes=${this.config?.shared?.scenes ?? true}
        .media=${this.config?.shared?.mediaTab ?? false}
      ></hubb-nav-bar>${this.restLayer()}`;
  }

  static styles = [
    tokens,
    HubbScreen.baseStyles,
    layoutStyles,
    gridSpans,
    HubbScreen.editStyles,
    css`
      h1 {
        margin: 6px 2px 14px;
        font-size: 22px;
        font-weight: 800;
      }
      /* Six columns: a scene takes a third (small), half (medium, the default) or the whole row. */
      .list {
        display: grid;
        grid-template-columns: repeat(6, minmax(0, 1fr));
        gap: 8px;
      }
      .list > .size-small {
        grid-column: span 2;
      }
      .list > .size-medium {
        grid-column: span 3;
      }
      .list > .size-large {
        grid-column: 1 / -1;
      }
      .size.current {
        background: var(--hubb-primary-bg);
        color: var(--hubb-primary-ink);
        cursor: default;
      }
      .sizes .label {
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--hubb-text-2);
      }
      .scene-edit {
        grid-column: 1 / -1;
        padding: 12px 14px 8px;
        border-radius: 16px;
        background: var(--hubb-surface);
        box-shadow: var(--hubb-card-shadow);
      }
      .scene-edit strong {
        display: block;
        font-size: 14px;
        font-weight: 700;
      }
      .scene-edit .kind {
        font-size: 11px;
        font-weight: 600;
        color: var(--hubb-text-2);
      }
      /* Room, light and home of a scene: the same fields as the editor of an item. */
      .scene-settings {
        display: grid;
        gap: 10px;
        margin-top: 10px;
      }
      .scene-settings .field {
        display: grid;
        gap: 4px;
      }
      .scene-settings label {
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--hubb-text-2);
      }
      .scene-settings select {
        box-sizing: border-box;
        width: 100%;
        min-height: 48px;
        padding: 0 12px;
        border: 1.5px solid color-mix(in srgb, var(--hubb-text-2) 35%, transparent);
        border-radius: 12px;
        background: var(--hubb-surface);
        color: var(--hubb-text);
        font-family: var(--hubb-font);
        font-size: 16px;
      }
      .scene-settings select:focus-visible {
        outline: 2px solid var(--hubb-focus);
        outline-offset: 1px;
      }
      .pin[aria-pressed='true'] {
        background: var(--hubb-primary-bg);
        color: var(--hubb-primary-ink);
      }
      .pin-full {
        font-size: 12px;
        font-weight: 600;
        color: var(--hubb-text-2);
      }
      .candidates {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        gap: 6px;
      }
      .candidates li {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        padding: 6px 6px 6px 14px;
        border-radius: 14px;
        background: var(--hubb-surface);
      }
      .candidates .what {
        min-width: 0;
        display: grid;
      }
      .candidates strong {
        font-size: 13px;
        font-weight: 700;
      }
      /* A scene and a script often share a name ("Desligar Kitnet"): this line tells them apart. */
      .candidates .what span {
        font-size: 11px;
        font-weight: 600;
        color: var(--hubb-text-2);
      }
    `,
  ];
}

define('hubb-scenes-screen', HubbScenesScreen);
