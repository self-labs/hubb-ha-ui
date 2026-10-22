import { mdiCheck, mdiPencilOutline } from '@mdi/js';
import { css, html, nothing } from 'lit';
import { isEditing, setEditing } from '../editing';
import '../elements/access-tile';
import '../elements/alarm-card';
import '../elements/camera-tile';
import '../elements/sensor-tile';
import { define } from '../elements/define';
import { icon } from '../elements/icon';
import '../elements/nav-bar';
import { alertActive } from '../elements/status-strips';
import type { AlertItem, DangerKind, HubbConfig, Security, Shared } from '../model/types';
import { hiddenForList } from '../model/visibility';
import { ALARM, EDIT, S, SECURITY, STRIP } from '../strings';
import { openNow } from '../summary';
import { tokens } from '../theme/tokens';
import { HubbScreen } from './base';

export interface SecurityScreenConfig {
  type: string;
  security: Security;
  shared?: Shared;
  /** Name of the first tab of the bottom bar; "Casa" when missing. */
  homeLabel?: string;
  /** The dashboard configuration, for the edit mode; missing on dashboards frozen before it. */
  options?: HubbConfig;
}

const list = <T>(value: T[] | undefined): T[] => (Array.isArray(value) ? value : []);

/** The security tab: the alerts on now, the alarm, what is open in the house, its gates and locks, and the cameras. */
export class HubbSecurityScreen extends HubbScreen {
  static properties = { config: { attribute: false } };

  static keptSheets = ['peopleTarget'];

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

  /**
   * The alarm or a camera in the edit mode: a row with its name, Quem vê and who it is hidden for.
   * Nothing switches by accident: the card itself comes back when the edit mode ends.
   */
  #inEdit(cls: string, entityId: string, name: string) {
    return html`<div class="item-edit">
      <strong>${name}</strong>
      <div class="tools ${cls}">
        <button class="tool people" aria-label=${`${name}: ${EDIT.whoSees}`} @click=${() => (this.peopleTarget = { kind: 'entity', entityId, name })}>
          ${EDIT.whoSees}
        </button>
        <hubb-hidden-tag .hass=${this.hass} .ids=${hiddenForList(this.config?.options?.entities?.[entityId]?.hidden_for)}></hubb-hidden-tag>
      </div>
    </div>`;
  }

  render() {
    const hass = this.hass;
    const security = this.config?.security;
    if (!hass || !security) return nothing;
    const { alarms, cameras, openings, access } = security;
    const open = openNow(hass, openings);
    // One that does not answer may be open: no all-clear while any of them says nothing.
    const unread = openings.filter((o) => !['on', 'off'].includes(hass.states[o.entityId]?.state ?? ''));
    // The smoke, gas and leaks that are on: the strip of one with no room leads here. The alarm has its card.
    const alerts = (this.config?.shared?.alerts ?? []).filter(
      (a): a is AlertItem & { kind: DangerKind } => a.kind !== 'alarm' && alertActive(hass, a),
    );
    const empty = alarms.length + cameras.length + openings.length + access.length + alerts.length === 0;
    const options = this.config?.options;
    const editable = this.canEdit(options);
    const editing = editable && isEditing();
    return html`${this.strips(this.config?.shared)}<main>
        <div class="title">
          <h1>${S.security}</h1>
          ${editable
            ? html`<button class="edit ${editing ? 'on' : ''}" aria-label=${editing ? EDIT.done : EDIT.edit} @click=${() => setEditing(!editing)}>
                ${icon(editing ? mdiCheck : mdiPencilOutline)}
              </button>`
            : nothing}
        </div>
        ${editing
          ? html`<p class="hint" role="status">${this.editNotice ?? EDIT.hintSecurity}</p>
              <div class="tools">
                <button class="tool tab-people" @click=${() => (this.peopleTarget = { kind: 'tab', tab: 'security', name: S.security })}>
                  ${EDIT.whoSeesTab}
                </button>
                <hubb-hidden-tag .hass=${hass} .ids=${hiddenForList(options?.tabs?.security?.hidden_for)}></hubb-hidden-tag>
              </div>`
          : nothing}
        ${empty ? html`<p class="empty"><strong>${SECURITY.empty}</strong></p>` : nothing}
        ${alerts.length && !editing
          ? html`<h2>${SECURITY.alerts}</h2>
              <div class="openings alerts">
                ${alerts.map(
                  (a) =>
                    html`<hubb-sensor-tile
                      .hass=${hass}
                      .item=${{ entityId: a.entityId, name: SECURITY.at(a.name ?? STRIP.kind[a.kind] ?? a.kind, a.roomName), kind: a.kind }}
                    ></hubb-sensor-tile>`,
                )}
              </div>`
          : nothing}
        ${alarms.length
          ? html`<h2>${ALARM.title}</h2>
              <div class="stack">
                ${alarms.map((a) =>
                  editing ? this.#inEdit('alarm-tools', a.entityId, a.name) : html`<hubb-alarm-card .hass=${hass} .item=${a}></hubb-alarm-card>`,
                )}
              </div>`
          : nothing}
        ${openings.length && !editing
          ? html`<h2>${SECURITY.openNow}</h2>
              ${open.length || unread.length
                ? html`<div class="openings">
                    ${[...open, ...unread].map(
                      (o) => html`<hubb-sensor-tile .hass=${hass} .item=${{ entityId: o.entityId, name: SECURITY.at(o.name, o.roomName), kind: o.kind }}></hubb-sensor-tile>`,
                    )}
                  </div>`
                : html`<p class="all-closed">${SECURITY.allClosed}</p>`}`
          : nothing}
        ${access.length && !editing
          ? html`<h2>${SECURITY.access}</h2>
              <div class="stack">
                ${access.map((a) => html`<hubb-access-tile .hass=${hass} .item=${{ ...a, name: SECURITY.at(a.name, a.roomName) }}></hubb-access-tile>`)}
              </div>`
          : nothing}
        ${cameras.length
          ? html`<h2>${SECURITY.cameras}</h2>
              <div class="cameras">
                ${cameras.map((c) =>
                  editing ? this.#inEdit('camera-tools', c.entityId, c.name) : html`<hubb-camera-tile .hass=${hass} .item=${c}></hubb-camera-tile>`,
                )}
              </div>`
          : nothing}
      </main>
      ${editing ? this.peopleSheet(options) : nothing}
      <hubb-toast></hubb-toast>
      <hubb-nav-bar
        current="seguranca"
        security
        home-label=${this.config?.homeLabel ?? S.home}
        .scenes=${this.config?.shared?.scenes ?? true}
      ></hubb-nav-bar>`;
  }

  static styles = [
    tokens,
    HubbScreen.baseStyles,
    HubbScreen.editStyles,
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
      .item-edit {
        padding: 12px 14px 8px;
        border-radius: 16px;
        background: var(--hubb-surface);
        box-shadow: var(--hubb-card-shadow);
      }
      .item-edit strong {
        font-size: 14px;
        font-weight: 700;
      }
    `,
  ];
}

define('hubb-security-screen', HubbSecurityScreen);
