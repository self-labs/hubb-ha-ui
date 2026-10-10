import { LitElement, css, html, nothing, type PropertyValues } from 'lit';
import { define } from '../elements/define';
import '../elements/light-tile';
import type { HomeAssistant } from '../ha/types';
import { isDimmable } from '../model/build-house';
import { displayName } from '../model/names';
import type { LightItem } from '../model/types';
import { tokens } from '../theme/tokens';

export interface LightCardConfig {
  type: string;
  entity: string;
  name?: string;
}

/** One Hubb light tile, for a client who wants it placed by hand in another dashboard. */
export class HubbLightCard extends LitElement {
  static properties = {
    hass: { attribute: false },
    config: { attribute: false },
    theme: { reflect: true },
  };

  declare hass: HomeAssistant | undefined;
  declare config: LightCardConfig | undefined;
  declare theme: 'dark' | 'light';

  constructor() {
    super();
    this.hass = undefined;
    this.config = undefined;
    this.theme = 'dark';
  }

  setConfig(config: LightCardConfig): void {
    if (!config || !config.entity) throw new Error('hubb-light-card: missing entity');
    this.config = config;
  }

  getCardSize(): number {
    return 2;
  }

  protected willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('hass') && this.hass) this.theme = this.hass.themes.darkMode ? 'dark' : 'light';
  }

  render() {
    const { hass, config } = this;
    if (!hass || !config) return nothing;
    const item: LightItem = {
      entityId: config.entity,
      name: config.name ?? displayName(hass, config.entity, null),
      dimmable: isDimmable(hass, config.entity),
    };
    return html`<hubb-light-tile .hass=${hass} .item=${item}></hubb-light-tile>`;
  }

  static styles = [
    tokens,
    css`
      :host {
        display: block;
        font-family: var(--hubb-font);
      }
    `,
  ];
}

define('hubb-light-card', HubbLightCard);
