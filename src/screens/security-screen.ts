import { css, html, nothing } from 'lit';
import '../elements/access-tile';
import '../elements/alarm-card';
import '../elements/camera-tile';
import '../elements/sensor-tile';
import { define } from '../elements/define';
import '../elements/nav-bar';
import type { Security, Shared } from '../model/types';
import { ALARM, S, SECURITY } from '../strings';
import { openNow } from '../summary';
import { tokens } from '../theme/tokens';
import { HubbScreen } from './base';

export interface SecurityScreenConfig {
  type: string;
  security: Security;
  shared?: Shared;
  /** Name of the first tab of the bottom bar; "Casa" when missing. */
  homeLabel?: string;
}

const list = <T>(value: T[] | undefined): T[] => (Array.isArray(value) ? value : []);

/** The security tab: the alarm, what is open in the house, its gates and locks, and the cameras. */
export class HubbSecurityScreen extends HubbScreen {
  static properties = { config: { attribute: false } };

  declare config: SecurityScreenConfig | undefined;

  constructor() {
    super();
    this.config = undefined;
  }

  setConfig(config: SecurityScreenConfig): void {
    if (!config || !config.security) throw new Error('hubb-security-screen: missing security');
    const s = config.security;
    this.config = {
      ...config,
      security: { alarms: list(s.alarms), cameras: list(s.cameras), openings: list(s.openings), access: list(s.access) },
    };
  }

  protected scope(): string[] {
    return [];
  }

  render() {
    const hass = this.hass;
    const security = this.config?.security;
    if (!hass || !security) return nothing;
    const { alarms, cameras, openings, access } = security;
    const open = openNow(hass, openings);
    // One that does not answer may be open: no all-clear while any of them says nothing.
    const unread = openings.filter((o) => !['on', 'off'].includes(hass.states[o.entityId]?.state ?? ''));
    const empty = alarms.length + cameras.length + openings.length + access.length === 0;
    return html`${this.strips(this.config?.shared)}<main>
        <h1>${S.security}</h1>
        ${empty ? html`<p class="empty"><strong>${SECURITY.empty}</strong></p>` : nothing}
        ${alarms.length
          ? html`<h2>${ALARM.title}</h2>
              <div class="stack">${alarms.map((a) => html`<hubb-alarm-card .hass=${hass} .item=${a}></hubb-alarm-card>`)}</div>`
          : nothing}
        ${openings.length
          ? html`<h2>${SECURITY.openNow}</h2>
              ${open.length || unread.length
                ? html`<div class="openings">
                    ${[...open, ...unread].map(
                      (o) => html`<hubb-sensor-tile .hass=${hass} .item=${{ entityId: o.entityId, name: SECURITY.at(o.name, o.roomName), kind: o.kind }}></hubb-sensor-tile>`,
                    )}
                  </div>`
                : html`<p class="all-closed">${SECURITY.allClosed}</p>`}`
          : nothing}
        ${access.length
          ? html`<h2>${SECURITY.access}</h2>
              <div class="stack">
                ${access.map((a) => html`<hubb-access-tile .hass=${hass} .item=${{ ...a, name: SECURITY.at(a.name, a.roomName) }}></hubb-access-tile>`)}
              </div>`
          : nothing}
        ${cameras.length
          ? html`<h2>${SECURITY.cameras}</h2>
              <div class="cameras">${cameras.map((c) => html`<hubb-camera-tile .hass=${hass} .item=${c}></hubb-camera-tile>`)}</div>`
          : nothing}
      </main>
      <hubb-toast></hubb-toast>
      <hubb-nav-bar current="seguranca" security home-label=${this.config?.homeLabel ?? S.home}></hubb-nav-bar>`;
  }

  static styles = [
    tokens,
    HubbScreen.baseStyles,
    css`
      h1 {
        margin: 6px 2px 4px;
        font-size: 22px;
        font-weight: 800;
        letter-spacing: -0.02em;
      }
      .stack {
        display: grid;
        gap: 8px;
      }
      /* What is open, as the cards of a room: a door, a window, the room it is in. */
      .openings {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 8px;
      }
      .all-closed {
        box-sizing: border-box;
        display: flex;
        align-items: center;
        min-height: 48px;
        margin: 0;
        padding: 0 14px;
        border-radius: 14px;
        background: var(--hubb-surface);
        box-shadow: var(--hubb-card-shadow);
        font-size: 13px;
        font-weight: 700;
      }
      .all-closed {
        color: var(--hubb-text-2);
      }
      .cameras {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 8px;
      }
    `,
  ];
}

define('hubb-security-screen', HubbSecurityScreen);
