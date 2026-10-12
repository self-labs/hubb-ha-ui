import { LitElement, css, html, nothing, type PropertyValues } from 'lit';
import '../elements/color-panel';
import { define } from '../elements/define';
import '../elements/dimmer-panel';
import '../elements/light-tile';
import '../elements/sheet';
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
    sheetOpen: { state: true },
  };

  declare hass: HomeAssistant | undefined;
  declare config: LightCardConfig | undefined;
  declare theme: 'dark' | 'light';
  /** The card carries its own light sheet, since no Hubb screen is around to open one. */
  declare sheetOpen: boolean;

  /** What the card picker pre-fills: the first light of the house, by id. */
  static getStubConfig(hass: HomeAssistant): Omit<LightCardConfig, 'type'> {
    const light = Object.keys(hass.states)
      .filter((id) => id.startsWith('light.'))
      .sort()[0];
    return { entity: light ?? 'light.exemplo' };
  }

  constructor() {
    super();
    this.hass = undefined;
    this.config = undefined;
    this.theme = 'dark';
    this.sheetOpen = false;
    this.addEventListener('hubb-open-dimmer', () => (this.sheetOpen = true));
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
    return html`<hubb-light-tile .hass=${hass} .item=${item}></hubb-light-tile>
      <hubb-sheet ?open=${this.sheetOpen} heading=${item.name} @hubb-close=${() => (this.sheetOpen = false)}>
        ${this.sheetOpen
          ? html`<hubb-dimmer-panel .hass=${hass} .entityId=${item.entityId}></hubb-dimmer-panel>
              <hubb-color-panel .hass=${hass} .entityId=${item.entityId}></hubb-color-panel>`
          : nothing}
      </hubb-sheet>`;
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
