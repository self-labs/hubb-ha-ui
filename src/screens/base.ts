import { LitElement, css, type PropertyDeclarations, type PropertyValues } from 'lit';
import { runScene } from '../actions/light';
import { withUndo } from '../actions/undo';
import type { HubbToast } from '../elements/toast';
import type { HomeAssistant } from '../ha/types';
import type { SceneItem } from '../model/types';
import { sceneRan } from '../strings';
import '../elements/toast';

/** What every screen shares: theme from the profile, the undo toast, and running scenes. */
export abstract class HubbScreen extends LitElement {
  // Typed as PropertyDeclarations so screens can declare their own properties; Lit merges them.
  static properties: PropertyDeclarations = {
    hass: { attribute: false },
    theme: { reflect: true },
  };

  declare hass: HomeAssistant | undefined;
  declare theme: 'dark' | 'light';

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
    main {
      box-sizing: border-box;
      max-width: 560px;
      margin: 0 auto;
      padding: calc(16px + env(safe-area-inset-top)) 16px calc(96px + env(safe-area-inset-bottom));
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
    this.undoable(this.scope(), sceneRan(scene.name), () => runScene(hass, scene.entityId));
  };

  constructor() {
    super();
    this.hass = undefined;
    this.theme = 'dark';
    this.addEventListener('hubb-run-scene', this.#onRunScene);
  }

  /** Light ids whose state an action on this screen may change, for the undo snapshot. */
  protected abstract scope(): string[];

  protected willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('hass') && this.hass) this.theme = this.hass.themes.darkMode ? 'dark' : 'light';
  }

  protected toast(): HubbToast | null {
    return this.renderRoot.querySelector('hubb-toast');
  }

  protected undoable(ids: string[], message: string, action: () => Promise<unknown>): void {
    const hass = this.hass;
    if (!hass) return;
    void withUndo(hass, ids, action, (undo) => this.toast()?.show(message, undo));
  }

  getCardSize(): number {
    return 12;
  }
}
