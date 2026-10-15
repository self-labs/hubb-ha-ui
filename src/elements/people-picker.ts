import { LitElement, css, html, nothing, type PropertyValues } from 'lit';
import { haptic } from '../actions/haptic';
import { loadUsers, residents, type HaUser } from '../actions/people';
import type { HomeAssistant } from '../ha/types';
import { hiddenForList } from '../model/visibility';
import { EDIT } from '../strings';
import { define } from './define';

/** What the picker asks the screen to save: the new `hidden_for`, and who changed, for the notice. */
export interface PeopleChange {
  hiddenFor: string[];
  person: string;
  sees: boolean;
}

/**
 * One button per resident, pressed while they see the room or the item. A tap asks the screen to save
 * the new `hidden_for` (`hubb-people`); ids of users that no longer exist stay, the review cleans them.
 */
export class HubbPeoplePicker extends LitElement {
  static properties = {
    hass: { attribute: false },
    // Screens build the list on every render: only another list of people counts as a change, so a
    // new state of Home Assistant between two taps does not undo the first one.
    hiddenFor: { attribute: false, hasChanged: (a: unknown, b: unknown) => hiddenForList(a).join() !== hiddenForList(b).join() },
    users: { state: true },
    failed: { state: true },
    chosen: { state: true },
  };

  declare hass: HomeAssistant | undefined;
  declare hiddenFor: string[];
  declare users: HaUser[] | null;
  /** Home Assistant did not give the users (a dropped connection): the picker says so. */
  declare failed: boolean;
  /** The list after the last tap, until the saved configuration comes back. */
  declare chosen: string[] | null;

  #loading = false;

  constructor() {
    super();
    this.hass = undefined;
    this.hiddenFor = [];
    this.users = null;
    this.failed = false;
    this.chosen = null;
  }

  protected willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('hiddenFor')) this.chosen = null;
    if (this.hass && this.users === null && !this.#loading) {
      this.#loading = true;
      void loadUsers(this.hass).then((users) => {
        if (users) this.users = users;
        else this.failed = true;
      });
    }
  }

  #toggle(user: HaUser, hidden: string[]): void {
    const seeing = !hidden.includes(user.id);
    const next = seeing ? [...hidden, user.id] : hidden.filter((id) => id !== user.id);
    this.chosen = next;
    haptic('selection');
    this.dispatchEvent(
      new CustomEvent<PeopleChange>('hubb-people', { detail: { hiddenFor: next, person: user.name, sees: !seeing }, bubbles: true, composed: true }),
    );
  }

  render() {
    if (this.failed) return html`<p class="hint">${EDIT.usersFailed}</p>`;
    if (this.users === null) return nothing;
    const people = residents(this.users);
    if (!people.length) return html`<p class="hint">${EDIT.onlyAdmins}</p>`;
    // A hidden_for written by hand as text reads as no list: it never breaks the buttons.
    const hidden = this.chosen ?? hiddenForList(this.hiddenFor);
    return html`<div class="people">
      ${people.map((u) => {
        const sees = !hidden.includes(u.id);
        return html`<button class="person ${sees ? 'current' : ''}" aria-pressed=${sees ? 'true' : 'false'} @click=${() => this.#toggle(u, hidden)}>
          ${u.name}
        </button>`;
      })}
    </div>`;
  }

  static styles = css`
    :host {
      display: block;
      font-family: var(--hubb-font);
    }
    .people {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .person {
      all: unset;
      box-sizing: border-box;
      min-height: 44px;
      padding: 0 14px;
      display: inline-flex;
      align-items: center;
      border-radius: 12px;
      background: var(--hubb-surface-2);
      color: var(--hubb-text);
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
    }
    .person.current {
      background: var(--hubb-primary-bg);
      color: var(--hubb-primary-ink);
    }
    .person:focus-visible {
      outline: 2px solid var(--hubb-focus);
      outline-offset: 2px;
    }
    .hint {
      margin: 0;
      font-size: 12px;
      color: var(--hubb-text-2);
    }
  `;
}

/** "Oculto para Lia", "Oculto para 2 pessoas": what the edit mode says of a room or an item (decision A). */
export class HubbHiddenTag extends LitElement {
  static properties = {
    hass: { attribute: false },
    ids: { attribute: false },
    users: { state: true },
  };

  declare hass: HomeAssistant | undefined;
  declare ids: string[];
  declare users: HaUser[] | null;

  #loading = false;

  constructor() {
    super();
    this.hass = undefined;
    this.ids = [];
    this.users = null;
  }

  protected willUpdate(): void {
    if (this.hass && this.ids.length && this.users === null && !this.#loading) {
      this.#loading = true;
      void loadUsers(this.hass).then((users) => (this.users = users ?? []));
    }
  }

  render() {
    // An administrator listed sees everything anyway: the tag counts the people it applies to.
    const ids = hiddenForList(this.ids).filter((id) => !this.users?.find((u) => u.id === id)?.isAdmin);
    if (!ids.length) return nothing;
    const one = ids.length === 1 ? this.users?.find((u) => u.id === ids[0]) : undefined;
    return html`<span class="tag">${one ? EDIT.hiddenForOne(one.name) : EDIT.hiddenForMany(ids.length)}</span>`;
  }

  static styles = css`
    .tag {
      display: inline-block;
      margin-top: 4px;
      padding: 2px 8px;
      border-radius: 8px;
      background: var(--hubb-surface-2);
      color: var(--hubb-amber-text);
      font-family: var(--hubb-font);
      font-size: 11px;
      font-weight: 700;
    }
  `;
}

define('hubb-people-picker', HubbPeoplePicker);
define('hubb-hidden-tag', HubbHiddenTag);
