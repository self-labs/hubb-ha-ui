import { css, html, nothing } from 'lit';
import { define } from '../elements/define';
import '../elements/nav-bar';
import '../elements/scene-button';
import type { SceneItem } from '../model/types';
import { S } from '../strings';
import { tokens } from '../theme/tokens';
import { HubbScreen } from './base';

export interface ScenesScreenConfig {
  type: string;
  scenes: SceneItem[];
  lightIds: string[];
  /** Name of the first tab of the bottom bar; "Casa" when missing. */
  homeLabel?: string;
}

export class HubbScenesScreen extends HubbScreen {
  static properties = { config: { attribute: false } };

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

  render() {
    const hass = this.hass;
    const scenes = this.config?.scenes;
    if (!hass || !scenes) return nothing;
    return html`<main>
        <h1>${S.scenes}</h1>
        ${scenes.length
          ? html`<div class="list">${scenes.map((s) => html`<hubb-scene-button variant="row" .scene=${s}></hubb-scene-button>`)}</div>`
          : html`<div class="empty">
              <strong>${S.emptyScenes}</strong>
              ${hass.user?.is_admin ? html`<span>${S.emptyScenesAdmin}</span>` : nothing}
            </div>`}
      </main>
      <hubb-toast></hubb-toast>
      <hubb-nav-bar current="scenes" home-label=${this.config?.homeLabel ?? S.home}></hubb-nav-bar>`;
  }

  static styles = [
    tokens,
    HubbScreen.baseStyles,
    css`
      h1 {
        margin: 6px 2px 14px;
        font-size: 22px;
        font-weight: 800;
      }
      .list {
        display: grid;
        gap: 8px;
      }
    `,
  ];
}

define('hubb-scenes-screen', HubbScenesScreen);
