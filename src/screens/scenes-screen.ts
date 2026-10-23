import { mdiCheck, mdiPencilOutline } from '@mdi/js';
import { css, html, nothing } from 'lit';
import { putBack, setEntity } from '../actions/dashboard-config';
import { isEditing, setEditing } from '../editing';
import { define } from '../elements/define';
import { icon } from '../elements/icon';
import '../elements/nav-bar';
import '../elements/people-picker';
import '../elements/scene-button';
import type { HubbConfig, SceneCandidate, SceneItem, Shared } from '../model/types';
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

  /** A scene in the edit mode: its name, what it is, Quem vê, Não mostrar and who it is hidden for. */
  #sceneInEdit(scene: SceneItem, twin: boolean) {
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
    </div>`;
  }

  /** A scene off the edit mode: a tile when small (like the home), a row otherwise. */
  #scene(scene: SceneItem) {
    const size = sizeOf(this.config?.options, scene.entityId, 'scene', this.screenLayout);
    return html`<hubb-scene-button class="size-${size}" variant=${size === 'small' ? 'tile' : 'row'} .scene=${scene}></hubb-scene-button>`;
  }

  render() {
    const hass = this.hass;
    const scenes = this.config?.scenes;
    if (!hass || !scenes) return nothing;
    const options = this.config?.options;
    const editable = this.canEdit(options);
    const editing = editable && isEditing();
    const candidates = editing ? (this.config?.candidates ?? []) : [];
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
                editing
                  ? this.#sceneInEdit(s, scenes.filter((o) => o.name === s.name).length > 1)
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
