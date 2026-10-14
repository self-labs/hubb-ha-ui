import { LitElement, css, html, type PropertyDeclarations, type PropertyValues } from 'lit';
import { dashboardPath } from '../actions/dashboard-config';
import { haptic } from '../actions/haptic';
import { runScene } from '../actions/light';
import { sceneLights, withUndo, type ServiceCall } from '../actions/undo';
import type { HubbToast } from '../elements/toast';
import type { HomeAssistant } from '../ha/types';
import type { SceneItem, Shared } from '../model/types';
import { onEditingChange } from '../editing';
import { EDIT, sceneRan } from '../strings';
import '../elements/status-strips';
import '../elements/toast';

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
  };

  declare hass: HomeAssistant | undefined;
  declare theme: 'dark' | 'light';
  /** Home Assistant lost the connection: the strip says so and the controls take no tap. */
  declare offline: boolean;
  /** Said in place of the edit hint when a save failed. */
  declare editNotice: string | null;

  #unwatch: (() => void) | null = null;

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
    /* Out of reach: nothing on screen would answer, so nothing takes a tap. */
    :host([offline]) main {
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

  protected willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('hass') && this.hass) {
      this.theme = this.hass.themes.darkMode ? 'dark' : 'light';
      this.offline = this.hass.connected === false;
      latest = this.hass;
    }
  }

  /** The strips of every screen (alerts, the house out of reach), from the slice the strategy shares. */
  protected strips(shared: Shared | undefined) {
    return html`<hubb-status-strips .hass=${this.hass} .alerts=${shared?.alerts ?? []}></hubb-status-strips>`;
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
