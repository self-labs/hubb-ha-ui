import { LitElement, css, html, nothing, type PropertyDeclarations, type PropertyValues } from 'lit';
import { keyed } from 'lit/directives/keyed.js';
import { dashboardPath, putBack, putBackTabs, setEntity, setTabs } from '../actions/dashboard-config';
import { haptic } from '../actions/haptic';
import { runScene } from '../actions/light';
import { sceneLights, withUndo, type ServiceCall } from '../actions/undo';
import type { HubbToast } from '../elements/toast';
import type { HomeAssistant } from '../ha/types';
import type { HubbConfig, SceneItem, Shared, TabId } from '../model/types';
import { SCENE_LABEL } from '../model/classify';
import { hiddenForList } from '../model/visibility';
import { onEditingChange } from '../editing';
import { EDIT, REVIEW, sceneRan } from '../strings';
import '../elements/people-picker';
import type { PeopleChange } from '../elements/people-picker';
import '../elements/sheet';
import '../elements/status-strips';
import '../elements/toast';
import { keepSheet, keptSheet } from '../sheets';

/** Whose "Quem vê" sheet is open on a tab screen: the tab itself or one of its items. */
export type PeopleTarget = { kind: 'tab'; tab: TabId; name: string } | { kind: 'entity'; entityId: string; name: string };

/** The newest hass any screen received: the one on screen keeps getting updates, a hidden one does not. */
let latest: HomeAssistant | undefined;

/** What every screen shares: theme from the profile, the undo toast, and running scenes. */
export abstract class HubbScreen extends LitElement {
  // Typed as PropertyDeclarations so screens can declare their own properties; Lit merges them.
  static properties: PropertyDeclarations = {
    hass: { attribute: false },
    theme: { reflect: true },
    offline: { type: Boolean, reflect: true },
    editNotice: { state: true },
    peopleTarget: { state: true },
  };

  declare hass: HomeAssistant | undefined;
  declare theme: 'dark' | 'light';
  /** Home Assistant lost the connection: the strip says so and the controls take no tap. */
  declare offline: boolean;
  /** Said in place of the edit hint when a save failed. */
  declare editNotice: string | null;
  /** The tab or the item whose "Quem vê" sheet is open (Cenas, Segurança). */
  declare peopleTarget: PeopleTarget | null;

  #unwatch: (() => void) | null = null;

  /** The edit mode of a tab screen: the pencil by the title, the hint, and small tool buttons. */
  static editStyles = css`
    .title {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }
    .edit {
      all: unset;
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
    .edit svg {
      width: 20px;
      height: 20px;
      fill: currentColor;
    }
    .hint {
      margin: 0 2px 10px;
      padding: 10px 12px;
      border-radius: 12px;
      background: var(--hubb-surface);
      font-size: 12px;
      font-weight: 600;
      color: var(--hubb-text-2);
    }
    .tools {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px;
      margin: 6px 0 4px;
    }
    .tool {
      all: unset;
      box-sizing: border-box;
      min-height: 40px;
      padding: 0 12px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 12px;
      background: var(--hubb-surface-2);
      color: var(--hubb-text);
      font-family: var(--hubb-font);
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
    }
    .edit:focus-visible,
    .tool:focus-visible {
      outline: 2px solid var(--hubb-focus);
      outline-offset: 2px;
    }
  `;

  static baseStyles = css`
    :host {
      display: block;
      min-height: 100vh;
      min-height: 100dvh;
      background: var(--hubb-bg);
      color: var(--hubb-text);
      font-family: var(--hubb-font);
      -webkit-font-smoothing: antialiased;
    }
    /* Out of reach: nothing on screen would answer, so nothing takes a tap (and inert, set in
       updated(), keeps the keyboard and screen readers out too), an open sheet included. */
    :host([offline]) main,
    :host([offline]) hubb-sheet > * {
      opacity: 0.45;
      pointer-events: none;
    }
    main {
      box-sizing: border-box;
      max-width: 560px;
      margin: 0 auto;
      /* The top is Home Assistant's: its layout already sits below the status bar. Only the
         bottom needs the safe area, because the nav bar is fixed to the viewport. */
      padding: 12px 16px calc(96px + env(safe-area-inset-bottom));
    }
    h2 {
      margin: 22px 2px 10px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--hubb-text-2);
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 8px;
    }
    .primary {
      all: unset;
      box-sizing: border-box;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 44px;
      padding: 0 16px;
      border-radius: 14px;
      background: var(--hubb-primary-bg);
      color: var(--hubb-primary-ink);
      font-family: var(--hubb-font);
      font-weight: 700;
      font-size: 13px;
      cursor: pointer;
    }
    .primary:focus-visible {
      outline: 2px solid var(--hubb-focus);
      outline-offset: 2px;
    }
    .empty {
      margin-top: 48px;
      text-align: center;
      color: var(--hubb-text-2);
      font-size: 13px;
    }
    .empty strong {
      display: block;
      margin-bottom: 6px;
      color: var(--hubb-text);
      font-size: 16px;
    }
  `;

  #onRunScene = (e: Event): void => {
    const hass = this.hass;
    if (!hass) return;
    const scene = (e as CustomEvent<{ scene: SceneItem }>).detail.scene;
    // A scene says which lights it sets, on the panel or not: those, and only those, go back. A script
    // does not say, so the whole panel is the scope, and a still running script is stopped first.
    const members = sceneLights(hass, scene.entityId, this.scope());
    const stop: ServiceCall[] = scene.entityId.startsWith('script.')
      ? [{ domain: 'script', service: 'turn_off', target: { entity_id: scene.entityId } }]
      : [];
    this.undoable(members.length ? members : this.scope(), sceneRan(scene.name), () => runScene(hass, scene.entityId), {
      stop,
      targets: members,
    });
  };

  constructor() {
    super();
    this.hass = undefined;
    this.theme = 'dark';
    this.offline = false;
    this.editNotice = null;
    this.peopleTarget = null;
    this.addEventListener('hubb-run-scene', this.#onRunScene);
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.#unwatch = onEditingChange(() => this.requestUpdate());
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#unwatch?.();
    this.#unwatch = null;
  }

  /**
   * Whether this person may edit this dashboard: an administrator, on a dashboard whose strategy
   * handed its configuration over (one frozen with "Take control" has none).
   */
  protected canEdit(options: unknown): boolean {
    return !!this.hass?.user?.is_admin && options !== undefined;
  }

  /**
   * Saves a change of the dashboard configuration; Home Assistant rebuilds the dashboard by itself.
   * `change` returns its undo, offered as Desfazer. False when it could not save.
   */
  protected async saveChange(
    message: string,
    change: (hass: HomeAssistant, urlPath: string | null) => Promise<(hass: HomeAssistant) => Promise<unknown>>,
  ): Promise<boolean> {
    const hass = this.hass;
    if (!hass) return false;
    const urlPath = dashboardPath();
    try {
      const undo = await change(hass, urlPath);
      haptic('success');
      this.editNotice = null;
      this.toast()?.show(message, () => void undo(latest ?? hass).catch(() => haptic('failure')));
      return true;
    } catch {
      haptic('failure');
      this.editNotice = EDIT.failed;
      return false;
    }
  }

  /** Light ids whose state an action on this screen may change, for the undo snapshot. */
  protected abstract scope(): string[];

  #reopened = false;

  protected willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('hass') && this.hass) {
      this.theme = this.hass.themes.darkMode ? 'dark' : 'light';
      this.offline = this.hass.connected === false;
      latest = this.hass;
    }
    // The "Quem vê" sheet survives the rebuild after a save: the new screen opens it again.
    if (!this.#reopened) {
      this.#reopened = true;
      this.peopleTarget ??= keptSheet<PeopleTarget>(this.localName);
    } else if (changed.has('peopleTarget')) keepSheet(this.localName, this.peopleTarget);
  }

  protected updated(changed: PropertyValues<this>): void {
    super.updated(changed);
    // Out of reach, the page and what an open sheet holds take no key and reach no screen reader
    // either; the strips that say so, the bar and closing a sheet still work.
    for (const el of this.renderRoot.querySelectorAll('main, hubb-sheet > *')) el.toggleAttribute('inert', this.offline);
  }

  /** The strips of every screen (alerts, the house out of reach), from the slice the strategy shares. */
  protected strips(shared: Shared | undefined) {
    return html`<hubb-status-strips .hass=${this.hass} .alerts=${shared?.alerts ?? []} .security=${shared?.security ?? true}></hubb-status-strips>`;
  }

  /** The ids `hidden_for` holds for a tab or an item, from the configuration of the dashboard. */
  protected hiddenForOf(options: HubbConfig | undefined, target: PeopleTarget): string[] {
    return hiddenForList(target.kind === 'tab' ? options?.tabs?.[target.tab]?.hidden_for : options?.entities?.[target.entityId]?.hidden_for);
  }

  /** The "Quem vê" sheet of a tab or of one of its items; open while `peopleTarget` is set. */
  protected peopleSheet(options: HubbConfig | undefined) {
    const target = this.peopleTarget;
    return html`<hubb-sheet
      class="people"
      ?open=${target !== null}
      heading=${target?.kind === 'tab' ? EDIT.whoSeesTab : EDIT.whoSeesItem}
      subheading=${target?.name ?? ''}
      @hubb-close=${() => (this.peopleTarget = null)}
    >
      ${target
        ? // One picker per tab or item: the taps on one never carry over to the next one opened.
          keyed(
            target.kind === 'tab' ? `tab:${target.tab}` : target.entityId,
            html`<hubb-people-picker
              .hass=${this.hass}
              .hiddenFor=${this.hiddenForOf(options, target)}
              @hubb-people=${(e: CustomEvent<PeopleChange>) => void this.#savePeople(target, e.detail)}
            ></hubb-people-picker>`,
          )
        : nothing}
    </hubb-sheet>`;
  }

  async #savePeople(target: PeopleTarget, change: PeopleChange): Promise<void> {
    const hiddenFor = change.hiddenFor.length ? change.hiddenFor : undefined;
    const what = target.kind === 'tab' ? EDIT.tabName(target.name) : target.name;
    const message = change.sees ? EDIT.nowShownFor(what, change.person) : EDIT.nowHiddenFor(what, change.person);
    const saved = await this.saveChange(message, async (hass, urlPath) => {
      if (target.kind === 'tab') {
        const before = await setTabs(hass, urlPath, { [target.tab]: { hidden_for: hiddenFor } });
        return (h) => putBackTabs(h, urlPath, before);
      }
      const before = await setEntity(hass, urlPath, target.entityId, { hidden_for: hiddenFor });
      return (h) => putBack(h, urlPath, before);
    });
    // Not saved: the sheet closes, so the notice behind it can be read and the buttons start over.
    if (!saved) this.peopleTarget = null;
  }

  /**
   * "Não mostrar" for a scene, with Desfazer. One added from the panel (role scene, no hubb_cena
   * label) just leaves Cenas and goes back to "Adicionar cena": hidden, Mostrar in its room would drop
   * the role and lose it.
   */
  protected hideItem(entityId: string, name: string, options: HubbConfig | undefined): void {
    const added = options?.entities?.[entityId]?.role === 'scene' && !this.hass?.entities[entityId]?.labels.includes(SCENE_LABEL);
    void this.saveChange(added ? EDIT.sceneRemoved(name) : REVIEW.savedHidden(name), async (hass, urlPath) => {
      const before = await setEntity(hass, urlPath, entityId, { role: added ? undefined : 'hidden' });
      return (h) => putBack(h, urlPath, before);
    });
  }

  protected toast(): HubbToast | null {
    return this.renderRoot.querySelector('hubb-toast');
  }

  protected undoable(
    ids: string[],
    message: string,
    action: () => Promise<unknown>,
    extra: { stop?: readonly ServiceCall[]; targets?: readonly string[] } = {},
  ): void {
    const hass = this.hass;
    if (!hass) return;
    let mine: (() => void) | null = null;
    void withUndo(
      hass,
      ids,
      action,
      (undo) => {
        mine = undo;
        this.toast()?.show(message, undo);
      },
      {
        // Desfazer may be tapped on another screen; Home Assistant stops updating a hidden view.
        current: () => latest ?? this.hass,
        stop: extra.stop,
        targets: extra.targets,
        // Withdraw this action's offer only: a later action may already have its own.
        failed: () => {
          if (mine) this.toast()?.hide(mine);
        },
      },
    );
  }

  getCardSize(): number {
    return 12;
  }
}
