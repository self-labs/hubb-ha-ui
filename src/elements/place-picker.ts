import { LitElement, css, html } from 'lit';
import { haptic } from '../actions/haptic';
import { PROFILE_IDS, type ProfileId } from '../model/profiles';
import { PLACE } from '../strings';
import { define } from './define';

/**
 * The eight kinds of place, one button each, the current one pressed. A tap asks for the new one
 * (`hubb-place`); whoever holds the configuration saves it. Used by Ajustes and by the editor Home
 * Assistant opens when the dashboard is created, which has none of the panel's colours: every colour
 * falls back to the theme of Home Assistant.
 */
export class HubbPlacePicker extends LitElement {
  static properties = { value: { attribute: false } };

  declare value: ProfileId;

  constructor() {
    super();
    this.value = 'home';
  }

  #pick(profile: ProfileId): void {
    if (profile === this.value) return;
    haptic('selection');
    this.value = profile;
    this.dispatchEvent(new CustomEvent('hubb-place', { detail: { profile }, bubbles: true, composed: true }));
  }

  render() {
    return html`<div class="places" role="group" aria-label=${PLACE.title}>
      ${PROFILE_IDS.map(
        (id) => html`<button class=${id === this.value ? 'current' : ''} aria-pressed=${id === this.value ? 'true' : 'false'} @click=${() => this.#pick(id)}>
          ${PLACE.names[id]}
        </button>`,
      )}
    </div>`;
  }

  static styles = css`
    :host {
      display: block;
    }
    .places {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(118px, 1fr));
      gap: 6px;
    }
    button {
      all: unset;
      box-sizing: border-box;
      min-height: 44px;
      padding: 0 10px;
      display: grid;
      place-items: center;
      text-align: center;
      border-radius: 12px;
      background: var(--hubb-surface, var(--secondary-background-color, #f0f0f0));
      color: var(--hubb-text, var(--primary-text-color, #1c1c1c));
      font-family: var(--hubb-font, inherit);
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;
    }
    button:focus-visible {
      outline: 2px solid var(--hubb-focus, var(--primary-color, #03a9f4));
      outline-offset: 2px;
    }
    button.current {
      background: var(--hubb-primary-bg, var(--primary-color, #03a9f4));
      color: var(--hubb-primary-ink, var(--text-primary-color, #fff));
    }
  `;
}

define('hubb-place-picker', HubbPlacePicker);
