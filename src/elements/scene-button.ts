import { LitElement, css, html, nothing } from 'lit';
import { haptic } from '../actions/haptic';
import { sceneIconPath } from '../model/scene-icon';
import type { SceneItem } from '../model/types';
import { define } from './define';
import { icon } from './icon';

export class HubbSceneButton extends LitElement {
  static properties = {
    scene: { attribute: false },
    variant: { reflect: true },
  };

  declare scene: SceneItem | undefined;
  declare variant: 'tile' | 'row' | 'chip';

  constructor() {
    super();
    this.scene = undefined;
    this.variant = 'tile';
  }

  #run = (): void => {
    if (!this.scene) return;
    haptic('light');
    this.dispatchEvent(new CustomEvent('hubb-run-scene', { detail: { scene: this.scene }, bubbles: true, composed: true }));
  };

  render() {
    const scene = this.scene;
    if (!scene) return nothing;
    // The icon Home Assistant gives the scene (drawn by its own ha-icon), else one read from its name.
    return html`<button class=${this.variant} @click=${this.#run}>
      ${scene.icon ? html`<ha-icon .icon=${scene.icon}></ha-icon>` : icon(sceneIconPath(scene.name))}
      <span class="label"><span class="name">${scene.name}</span>${this.variant === 'row' && scene.description
          ? html`<span class="desc">${scene.description}</span>`
          : nothing}</span>
    </button>`;
  }

  static styles = css`
    :host {
      display: block;
    }
    button {
      all: unset;
      box-sizing: border-box;
      display: flex;
      gap: 8px;
      width: 100%;
      background: var(--hubb-surface);
      color: var(--hubb-text);
      font-family: var(--hubb-font);
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;
    }
    button:focus-visible {
      outline: 2px solid var(--hubb-focus);
      outline-offset: 2px;
    }
    svg {
      width: 18px;
      height: 18px;
      flex: none;
      fill: var(--hubb-amber);
    }
    ha-icon {
      --mdc-icon-size: 18px;
      flex: none;
      color: var(--hubb-amber);
    }
    .name {
      display: block;
      font-weight: 700;
      font-size: 12px;
      overflow-wrap: anywhere;
    }
    /* Two scenes side by side take one height, whatever their names. */
    .tile,
    .row {
      height: 100%;
    }
    .desc {
      display: block;
      margin-top: 2px;
      font-size: 11px;
      color: var(--hubb-text-2);
    }
    .tile {
      flex-direction: column;
      justify-content: space-between;
      min-height: 64px;
      padding: 10px;
      border-radius: 14px;
    }
    .row {
      align-items: center;
      min-height: 64px;
      padding: 12px 14px;
      border-radius: var(--hubb-radius, 16px);
    }
    .chip {
      align-items: center;
      min-height: 44px;
      padding: 0 14px;
      border-radius: 14px;
    }
  `;
}

define('hubb-scene-button', HubbSceneButton);
