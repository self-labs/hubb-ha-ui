import { mdiCreationOutline, mdiHomeOutline, mdiShieldHomeOutline } from '@mdi/js';
import { LitElement, css, html, nothing } from 'lit';
import { haptic } from '../actions/haptic';
import { basePath, navigate } from '../actions/navigate';
import { S } from '../strings';
import { define } from './define';
import { icon } from './icon';

export type NavCurrent = 'home' | 'scenes' | 'seguranca';

export class HubbNavBar extends LitElement {
  static properties = { current: {}, homeLabel: { attribute: 'home-label' }, security: { type: Boolean }, scenes: { attribute: false } };

  declare current: NavCurrent;
  /** "Casa" for a home, "Início" for the other places. */
  declare homeLabel: string;
  /** Whether the house has an alarm, a camera, a door or window sensor, a gate or a lock: the third tab. */
  declare security: boolean;
  /** Whether Cenas is offered: a resident with no scene to see does not get the tab. */
  declare scenes: boolean;

  constructor() {
    super();
    this.current = 'home';
    this.homeLabel = S.home;
    this.security = false;
    this.scenes = true;
  }

  #go(path: NavCurrent): void {
    haptic('selection');
    navigate(`${basePath()}/${path}`, { replace: true });
  }

  #item(path: NavCurrent, label: string, iconPath: string) {
    const cur = this.current === path;
    return html`<button class=${cur ? 'cur' : ''} aria-current=${cur ? 'page' : 'false'} @click=${() => this.#go(path)}>
      ${icon(iconPath)}<span>${label}</span>
    </button>`;
  }

  render() {
    // The page fades out under and around the bar: cards scrolling past never read as part of it.
    return html`<div class="fade" aria-hidden="true"></div>
      <div class="shield" aria-hidden="true"></div>
      <nav aria-label=${S.navigation}>
      ${this.#item('home', this.homeLabel, mdiHomeOutline)} ${this.scenes ? this.#item('scenes', S.scenes, mdiCreationOutline) : nothing}
      ${this.security ? this.#item('seguranca', S.security, mdiShieldHomeOutline) : nothing}
    </nav>`;
  }

  static styles = css`
    /* Below the docked sidebar of Home Assistant (z-index 6), above the page. */
    .fade {
      position: fixed;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 5;
      height: calc(92px + env(safe-area-inset-bottom));
      pointer-events: none;
      background: linear-gradient(to top, var(--hubb-bg) 72%, color-mix(in srgb, var(--hubb-bg) 0%, transparent));
    }
    /* The solid part, up to the top of the bar: a card hidden under it takes no tap. */
    .shield {
      position: fixed;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 5;
      height: calc(72px + env(safe-area-inset-bottom));
      pointer-events: auto;
    }
    nav {
      position: fixed;
      left: 12px;
      right: 12px;
      bottom: calc(12px + env(safe-area-inset-bottom));
      z-index: 10;
      box-sizing: border-box;
      display: flex;
      justify-content: space-around;
      max-width: 536px;
      height: 60px;
      margin: 0 auto;
      border-radius: 18px;
      border: 1px solid color-mix(in srgb, var(--hubb-text) 10%, transparent);
      background: var(--hubb-surface);
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
      font-family: var(--hubb-font);
    }
    button {
      all: unset;
      box-sizing: border-box;
      flex: 1;
      min-width: 44px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 2px;
      color: var(--hubb-text-2);
      font-size: 10.5px;
      font-weight: 700;
      cursor: pointer;
    }
    button:focus-visible {
      outline: 2px solid var(--hubb-focus);
      outline-offset: 2px;
    }
    button svg {
      width: 22px;
      height: 22px;
      fill: currentColor;
    }
    button.cur {
      color: var(--hubb-text);
    }
  `;
}

define('hubb-nav-bar', HubbNavBar);
