import { mdiChevronDoubleLeft, mdiChevronDoubleRight, mdiCreationOutline, mdiHomeOutline, mdiShieldHomeOutline } from '@mdi/js';
import { LitElement, css, html, nothing } from 'lit';
import { haptic } from '../actions/haptic';
import { basePath, navigate } from '../actions/navigate';
import { LayoutWatcher, onLayoutChange, railHidden, setRailHidden } from '../layout';
import type { Layout } from '../model/layout';
import { S } from '../strings';
import { define } from './define';
import { icon } from './icon';

export type NavCurrent = 'home' | 'scenes' | 'seguranca';

export class HubbNavBar extends LitElement {
  static properties = {
    current: {},
    homeLabel: { attribute: 'home-label' },
    homeIcon: { attribute: false },
    security: { type: Boolean },
    scenes: { attribute: false },
    railAway: { state: true },
    screenLayout: { reflect: true, attribute: 'screen-layout' },
  };

  declare current: NavCurrent;
  /** "Casa" for a home, "Início" for the other places. */
  declare homeLabel: string;
  /** The icon of the first tab (a path of @mdi/js): a house, or a building for a business. */
  declare homeIcon: string;
  /** Whether the house has an alarm, a camera, a door or window sensor, a gate or a lock: the third tab. */
  declare security: boolean;
  /** Whether Cenas is offered: a resident with no scene to see does not get the tab. */
  declare scenes: boolean;
  /** Wide: the rail put away (src/layout.ts); a handle on the left edge brings it back. */
  declare railAway: boolean;
  /** Wide: a rail down the left side instead of a bar at the bottom. */
  declare screenLayout: Layout;

  constructor() {
    super();
    this.current = 'home';
    this.homeLabel = S.home;
    this.homeIcon = mdiHomeOutline;
    this.security = false;
    this.scenes = true;
    this.railAway = false;
    this.screenLayout = 'phone';
    new LayoutWatcher(this);
  }

  #off: (() => void) | null = null;

  connectedCallback(): void {
    super.connectedCallback();
    this.railAway = railHidden();
    this.#off = onLayoutChange(() => (this.railAway = railHidden()));
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#off?.();
    this.#off = null;
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

  #rail(hidden: boolean): void {
    haptic('selection');
    setRailHidden(hidden);
  }

  render() {
    const wide = this.screenLayout === 'wide';
    // Wide and put away: only the handle on the left edge that brings the rail back.
    if (wide && this.railAway) {
      return html`<button class="rail-show" aria-label=${S.railShowLabel} @click=${() => this.#rail(false)}>${icon(mdiChevronDoubleRight)}</button>`;
    }
    // The page fades out under and around the bar: cards scrolling past never read as part of it.
    return html`<div class="fade" aria-hidden="true"></div>
      <div class="shield" aria-hidden="true"></div>
      <nav aria-label=${S.navigation}>
      ${this.#item('home', this.homeLabel, this.homeIcon)} ${this.scenes ? this.#item('scenes', S.scenes, mdiCreationOutline) : nothing}
      ${this.security ? this.#item('seguranca', S.security, mdiShieldHomeOutline) : nothing}
      ${wide
        ? html`<button class="rail-hide" aria-label=${S.railHideLabel} @click=${() => this.#rail(true)}>
            ${icon(mdiChevronDoubleLeft)}<span>${S.railHide}</span>
          </button>`
        : nothing}
    </nav>`;
  }

  static styles = css`
    /* Below the docked sidebar of Home Assistant (z-index 6), above the page. The fixed layers span
       the area of the panel (set on the screen, src/theme/layout.ts), not the window. */
    .fade {
      position: fixed;
      left: var(--hubb-area-left, 0px);
      width: var(--hubb-area-width, 100vw);
      bottom: 0;
      z-index: 5;
      height: calc(92px + env(safe-area-inset-bottom));
      pointer-events: none;
      background: linear-gradient(to top, var(--hubb-bg) 72%, color-mix(in srgb, var(--hubb-bg) 0%, transparent));
    }
    /* The solid part, up to the top of the bar: a card hidden under it takes no tap. */
    .shield {
      position: fixed;
      left: var(--hubb-area-left, 0px);
      width: var(--hubb-area-width, 100vw);
      bottom: 0;
      z-index: 5;
      height: calc(72px + env(safe-area-inset-bottom));
      pointer-events: auto;
    }
    /* In the middle of the area, 12 px in from each side of it, never wider than the column. */
    nav {
      position: fixed;
      left: calc(var(--hubb-area-left, 0px) + var(--hubb-area-width, 100vw) / 2);
      bottom: calc(12px + env(safe-area-inset-bottom));
      z-index: 10;
      box-sizing: border-box;
      display: flex;
      justify-content: space-around;
      width: min(calc(var(--hubb-area-width, 100vw) - 24px), calc(var(--hubb-col, 560px) - 24px));
      height: 60px;
      transform: translateX(-50%);
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
    /* Wide: a rail down the left side of the area, under the header Home Assistant may show. The
       screens leave it 84 px (src/theme/layout.ts); nothing scrolls under it, so no fade. */
    :host([screen-layout='wide']) .fade,
    :host([screen-layout='wide']) .shield {
      display: none;
    }
    :host([screen-layout='wide']) nav {
      left: var(--hubb-area-left, 0px);
      top: var(--hubb-area-top, 0px);
      bottom: 0;
      width: 84px;
      height: auto;
      transform: none;
      flex-direction: column;
      justify-content: flex-start;
      gap: 10px;
      padding: 20px 10px;
      border: 0;
      border-right: 1px solid color-mix(in srgb, var(--hubb-text) 8%, transparent);
      border-radius: 0;
      box-shadow: none;
    }
    :host([screen-layout='wide']) button {
      flex: none;
      height: 60px;
      border-radius: 16px;
      font-size: 11px;
    }
    :host([screen-layout='wide']) button.cur {
      background: var(--hubb-surface-2);
      color: var(--hubb-amber-text);
    }
    /* At the foot of the rail, away from the tabs: it changes the page, it does not go anywhere. */
    .rail-hide {
      margin-top: auto;
    }
    /* The rail put away: a handle on the left edge of the area, in the middle of its height. */
    .rail-show {
      position: fixed;
      left: var(--hubb-area-left, 0px);
      top: calc(var(--hubb-area-top, 0px) + (100dvh - var(--hubb-area-top, 0px)) / 2);
      z-index: 10;
      width: 28px;
      min-width: 0;
      height: 72px;
      transform: translateY(-50%);
      flex: none;
      border-radius: 0 14px 14px 0;
      background: var(--hubb-surface-2);
      color: var(--hubb-text-2);
      box-shadow: var(--hubb-card-shadow);
    }
    .rail-show svg {
      width: 20px;
      height: 20px;
    }
  `;
}

define('hubb-nav-bar', HubbNavBar);
