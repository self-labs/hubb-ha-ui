import { LitElement, css, html } from 'lit';
import { define } from '../elements/define';
import '../elements/place-picker';
import type { HomeAssistant } from '../ha/types';
import { isProfileId, type ProfileId } from '../model/profiles';
import type { HubbConfig } from '../model/types';
import { PLACE } from '../strings';

/**
 * What Home Assistant asks before it creates the dashboard (`configRequired`): the kind of place and
 * its name. Home Assistant's contract for a strategy editor: `setConfig`, `hass`, and `config-changed`
 * with the whole configuration, every other key kept as it came.
 */
export class HubbPlaceEditor extends LitElement {
  static properties = { hass: { attribute: false }, config: { state: true } };

  declare hass: HomeAssistant | undefined;
  declare config: HubbConfig;

  constructor() {
    super();
    this.hass = undefined;
    this.config = {};
  }

  setConfig(config: HubbConfig): void {
    this.config = config;
  }

  #change(key: 'profile' | 'name', value: string | undefined): void {
    const next: HubbConfig = { ...this.config, [key]: value };
    if (value === undefined) delete next[key];
    this.config = next;
    this.dispatchEvent(new CustomEvent('config-changed', { detail: { config: next }, bubbles: true, composed: true }));
  }

  render() {
    const profile: ProfileId = isProfileId(this.config.profile) ? this.config.profile : 'home';
    return html`<h3>${PLACE.title}</h3>
      <hubb-place-picker .value=${profile} @hubb-place=${(e: CustomEvent<{ profile: ProfileId }>) => this.#change('profile', e.detail.profile)}></hubb-place-picker>
      <label>
        <span>${PLACE.name}</span>
        <input
          class="name"
          .value=${this.config.name ?? ''}
          placeholder=${this.hass?.config.location_name ?? ''}
          @change=${(e: Event) => this.#change('name', (e.target as HTMLInputElement).value.trim() || undefined)}
        />
        <small>${PLACE.nameHint}</small>
      </label>`;
  }

  static styles = css`
    :host {
      display: block;
      color: var(--primary-text-color);
    }
    h3 {
      margin: 0 0 8px;
      font-size: 14px;
      font-weight: 500;
    }
    label {
      display: grid;
      gap: 4px;
      margin-top: 18px;
      font-size: 14px;
    }
    input {
      box-sizing: border-box;
      min-height: 44px;
      padding: 0 12px;
      border: 1px solid var(--divider-color, #ccc);
      border-radius: 8px;
      background: var(--card-background-color, #fff);
      color: inherit;
      font: inherit;
      font-size: 16px;
    }
    small {
      color: var(--secondary-text-color);
    }
  `;
}

define('hubb-place-editor', HubbPlaceEditor);
