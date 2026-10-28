import { mdiChevronLeft } from '@mdi/js';
import { css, html, nothing, type PropertyValues } from 'lit';
import { live } from 'lit/directives/live.js';
import { repeat } from 'lit/directives/repeat.js';
import { copyText } from '../actions/clipboard';
import {
  CONFIG_SAVED,
  dashboardPath,
  dropKeys,
  putBack,
  putBackRoot,
  putBackRooms,
  putBackTabs,
  setEntity,
  setRoles,
  setRooms,
  setTabs,
  type ConfigSaved,
} from '../actions/dashboard-config';
import { setEntityArea } from '../actions/entity-area';
import { haptic } from '../actions/haptic';
import { loadUsers, type HaUser } from '../actions/people';
import { goBack } from '../actions/navigate';
import { define } from '../elements/define';
import { icon } from '../elements/icon';
import '../elements/nav-bar';
import type { Role } from '../model/config';
import { REVIEW_GROUPS, reviewItems, roomlessSwitches, suggestedLines, yamlBlock, yamlLine, type ReviewItem } from '../model/review';
import type { HassArea, HomeAssistant } from '../ha/types';
import type { HubbConfig, Shared } from '../model/types';
import { staleEntries, type StaleEntry } from '../model/visibility';
import { EDIT, REVIEW, ROLE_LABELS, S } from '../strings';
import { layoutStyles } from '../theme/layout';
import { tokens } from '../theme/tokens';
import { HubbScreen } from './base';

export interface ReviewScreenConfig {
  type: string;
  /** The dashboard configuration, so the review reads the same roles the panel does. */
  options?: HubbConfig;
  homeLabel?: string;
  /** Alerts and the security tab; missing on dashboards frozen before M4. */
  shared?: Shared;
}

/** How long "Linha copiada" stays. */
const NOTICE_MS = 2000;
/** How long a failure stays: longer, it has to be read. */
const FAILED_NOTICE_MS = 5000;
/** One object for a missing configuration, so the cached review keeps its key. */
const NO_OPTIONS: HubbConfig = {};

const collator = new Intl.Collator('pt-BR', { sensitivity: 'base', numeric: true });

/**
 * What survives the screen: every move changes the registry, Home Assistant regenerates the dashboard
 * and makes a new review screen, and the installer moving a board's channels one by one would find
 * the list closed, the rooms chosen gone and the page back at the top (Gustavo, 16/10). Keyed like
 * the users of people.ts, by the callService of the house.
 */
interface Kept {
  quietOpen: boolean;
  picked: Record<string, string>;
  /**
   * After a move: the id to focus once the moved entity has left the list, in the new screen too, and
   * where that element stood on the screen, to put it back there (the page jumps while Home Assistant
   * swaps the screen, and the moved entity joining a list above pushes the rest down).
   */
  focus: { id: string; moved: string; top: number; at: number; done: WeakSet<object> } | null;
}

/** How long after a move a screen still puts the place back: the rebuild takes well under a second. */
const REFOCUS_MS = 5000;
const kept = new WeakMap<HomeAssistant['callService'], Kept>();

function keptOf(hass: HomeAssistant): Kept {
  let k = kept.get(hass.callService);
  if (!k) kept.set(hass.callService, (k = { quietOpen: false, picked: {}, focus: null }));
  return k;
}

/** "Revisar o painel": what stayed off the panel and why, with the line of YAML to paste. Administrators only. */
export class HubbReviewScreen extends HubbScreen {
  static properties = {
    config: { attribute: false },
    notice: { state: true },
    manual: { state: true },
    users: { state: true },
    picked: { state: true },
    quietOpen: { state: true },
  };

  declare config: ReviewScreenConfig | undefined;
  declare notice: string | null;
  /** The text to copy by hand, when the device copies nothing. */
  declare manual: string | null;
  /** Every user of Home Assistant, to find the ids of `hidden_for` that are gone; null until read. */
  declare users: HaUser[] | null;
  /** The room chosen for each entity, waiting for Mover: choosing alone writes nothing. */
  declare picked: Readonly<Record<string, string>>;
  /** Whether "Interruptores sem cômodo" is open. */
  declare quietOpen: boolean;

  #loadingUsers = false;
  #restored = false;

  #timer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    super();
    this.config = undefined;
    this.notice = null;
    this.manual = null;
    this.users = null;
    this.picked = {};
    this.quietOpen = false;
  }

  setConfig(config: ReviewScreenConfig): void {
    if (!config) throw new Error('hubb-review-screen: missing config');
    this.config = config;
  }

  protected scope(): string[] {
    return [];
  }

  protected willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed);
    if (this.hass && !this.#restored) {
      this.#restored = true;
      const k = keptOf(this.hass);
      this.quietOpen = k.quietOpen;
      this.picked = k.picked;
    }
    if (this.hass?.user?.is_admin && this.users === null && !this.#loadingUsers) {
      this.#loadingUsers = true;
      void loadUsers(this.hass).then((users) => (this.users = users ?? []));
    }
  }

  async #clean(entry: StaleEntry, name: string): Promise<void> {
    const hiddenFor = entry.keep.length ? entry.keep : undefined;
    await this.saveChange(REVIEW.cleaned(name), async (hass, urlPath) => {
      if (entry.section === 'rooms') {
        const before = await setRooms(hass, urlPath, { [entry.key]: { hidden_for: hiddenFor } });
        return (h) => putBackRooms(h, urlPath, before);
      }
      if (entry.section === 'tabs') {
        const before = await setTabs(hass, urlPath, { [entry.key]: { hidden_for: hiddenFor } });
        return (h) => putBackTabs(h, urlPath, before);
      }
      const before = await setEntity(hass, urlPath, entry.key, { hidden_for: hiddenFor });
      return (h) => putBack(h, urlPath, before);
    });
  }

  #stale(entry: StaleEntry) {
    const hass = this.hass!;
    const name =
      entry.section === 'rooms'
        ? (hass.areas[entry.key]?.name ?? entry.key)
        : entry.section === 'tabs'
          ? REVIEW.tab(entry.key === 'scenes' ? S.scenes : S.security)
          : String(hass.states[entry.key]?.attributes.friendly_name ?? entry.key);
    return html`<li class="item">
      <strong>${name}</strong>
      <span class="why">${REVIEW.staleReason}</span>
      <div class="roles"><button class="role clean" @click=${() => void this.#clean(entry, name)}>${REVIEW.clean}</button></div>
    </li>`;
  }

  /**
   * A save of this dashboard (a role, Desfazer, a room) shows on the list at once. Home Assistant
   * rebuilds the dashboard after a save too, but not on every device: without this the item tapped
   * stayed on the list until the page was reloaded.
   */
  #onSaved = (e: Event): void => {
    const { urlPath, strategy } = (e as CustomEvent<ConfigSaved>).detail;
    if (this.config && urlPath === dashboardPath()) this.config = { ...this.config, options: strategy };
  };

  connectedCallback(): void {
    super.connectedCallback();
    window.addEventListener(CONFIG_SAVED, this.#onSaved);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    window.removeEventListener(CONFIG_SAVED, this.#onSaved);
    if (this.#timer) clearTimeout(this.#timer);
    this.#timer = null;
  }

  /** One notice at a time, for its own time: a newer one never goes with the timer of an older one. */
  #say(text: string, ms: number): void {
    this.notice = text;
    if (this.#timer) clearTimeout(this.#timer);
    this.#timer = setTimeout(() => {
      this.#timer = null;
      this.notice = null;
    }, ms);
  }

  async #copy(text: string, done: string): Promise<void> {
    const ok = await copyText(text);
    haptic(ok ? 'success' : 'warning');
    this.manual = ok ? null : text;
    this.#say(ok ? done : REVIEW.copyFailed, NOTICE_MS);
  }

  /**
   * Saves the roles into the dashboard configuration; Home Assistant rebuilds the dashboard by itself,
   * and Desfazer puts the entries back. When it cannot save (a dashboard frozen with "Take control",
   * an account that is not an administrator, an error), the YAML goes to the clipboard as before.
   */
  async #apply(roles: Readonly<Record<string, Role>>, saved: string, text: string, copied: string): Promise<void> {
    // `saved` says what changed, in the words of the screen ("Jet mode não aparece mais no painel.").
    const ok = await this.saveChange(saved, async (hass, urlPath) => {
      const before = await setRoles(hass, urlPath, roles);
      return (h) => putBack(h, urlPath, before);
    });
    if (ok) {
      this.manual = null;
      this.notice = null;
    } else await this.#copy(text, copied);
  }

  /**
   * Remover: takes the wrong lines of the YAML out of the dashboard, with Desfazer. The panel already
   * ignores them, so nothing on it changes; the list just stops naming them.
   */
  async #drop(items: readonly ReviewItem[]): Promise<void> {
    const paths = items.flatMap((i) => (i.drop ? [i.drop] : []));
    if (!paths.length) return;
    const message = items.length === 1 ? REVIEW.dropped(items[0]!.name) : REVIEW.droppedAll(items.length);
    const ok = await this.saveChange(message, async (hass, urlPath) => {
      const before = await dropKeys(hass, urlPath, paths);
      return (h) => putBackRoot(h, urlPath, before);
    });
    if (ok) this.notice = null;
    else this.#say(REVIEW.dropFailed(items.map((i) => i.name).join(', ')), FAILED_NOTICE_MS);
  }

  #setQuiet(open: boolean): void {
    this.quietOpen = open;
    if (this.hass) keptOf(this.hass).quietOpen = open;
  }

  #setPicked(picked: Record<string, string>): void {
    this.picked = picked;
    if (this.hass) keptOf(this.hass).picked = picked;
  }

  protected updated(changed: PropertyValues<this>): void {
    super.updated(changed);
    // The new screen after the rebuild: once the moved entity is gone, the focus is where it was.
    // The old screen gets the new registry first and the new screen comes 200 ms later, so each screen
    // puts it back once, and only right after the move: never on a later update, never days later.
    const k = this.hass ? keptOf(this.hass) : null;
    const root = this.shadowRoot;
    const f = k?.focus;
    if (!k || !f || !root || f.done.has(this) || root.getElementById(`room-${f.moved}`)) return;
    if (Date.now() - f.at > REFOCUS_MS) {
      k.focus = null;
      return;
    }
    f.done.add(this);
    const target = root.getElementById(f.id);
    if (!target) return;
    target.focus({ preventScroll: true });
    const shift = target.getBoundingClientRect().top - f.top;
    // The screen is what scrolls (src/screens/base.ts), not the page of Home Assistant.
    if (shift) this.scrollBy({ top: shift, behavior: 'auto' });
  }

  /**
   * The room of an entity with none, in Home Assistant itself and with Desfazer: the area of the
   * entity, so the other channels of its board stay where they are. Home Assistant rebuilds the panel
   * when the registry changes, and the item leaves this list. The focus goes down to the next room
   * list, or to `fallback` at the end, without scrolling: the button that had it is about to go.
   */
  async #placeIn(entityId: string, name: string, areaId: string, fallback: string): Promise<void> {
    const hass = this.hass;
    const room = hass?.areas[areaId]?.name;
    if (!hass || !room) return;
    const before = hass.entities[entityId]?.area_id ?? null;
    const ok = await this.saveChange(EDIT.movedTo(name, room), async (h) => {
      await setEntityArea(h, entityId, areaId);
      return (u) => setEntityArea(u, entityId, before);
    });
    if (!ok) return this.#say(REVIEW.areaFailed, FAILED_NOTICE_MS);
    const { [entityId]: _done, ...rest } = this.picked;
    this.#setPicked(rest);
    const lists = [...(this.shadowRoot?.querySelectorAll('select.room') ?? [])];
    const at = lists.findIndex((s) => s.id === `room-${entityId}`);
    const next = lists[at + 1]?.id ?? fallback;
    const target = this.shadowRoot?.getElementById(next) ?? null;
    keptOf(hass).focus = { id: next, moved: entityId, top: target?.getBoundingClientRect().top ?? 0, at: Date.now(), done: new WeakSet() };
    target?.focus({ preventScroll: true });
  }

  /** The rooms of the house, by name, without those the panel hides: a choice there would vanish. */
  #rooms(): HassArea[] {
    const rooms = this.config?.options?.rooms ?? {};
    return Object.values(this.hass?.areas ?? {})
      .filter((a) => !rooms[a.area_id]?.hidden)
      .sort((a, b) => collator.compare(a.name, b.name));
  }

  /**
   * "Cômodo" and Mover. Choosing writes nothing: the arrows of a keyboard change a closed list and fire
   * its change event at once, and each would move the entity.
   */
  #roomPicker(entityId: string, name: string, areas: readonly HassArea[], focus: string) {
    if (!areas.length) return html`<div class="place"><p class="none">${REVIEW.noRooms}</p></div>`;
    const id = `room-${entityId}`;
    const chosen = this.picked[entityId] ?? '';
    return html`<div class="place">
      <label for=${id}>${REVIEW.room}</label>
      <div class="pick">
        <select
          id=${id}
          class="room"
          .value=${live(chosen)}
          @change=${(e: Event) => this.#setPicked({ ...this.picked, [entityId]: (e.target as HTMLSelectElement).value })}
        >
          <option value="" disabled ?selected=${!chosen}>${REVIEW.pickRoom}</option>
          ${areas.map((a) => html`<option value=${a.area_id} ?selected=${a.area_id === chosen}>${a.name}</option>`)}
        </select>
        <button class="role move" ?disabled=${!chosen} @click=${() => void this.#placeIn(entityId, name, chosen, focus)}>${REVIEW.move}</button>
      </div>
    </div>`;
  }

  /** "Interruptores sem cômodo", behind a button: out of the count, but where the channels of a board are. */
  #quiet(areas: readonly HassArea[]) {
    const groups = roomlessSwitches(this.hass!, this.config?.options ?? NO_OPTIONS);
    const count = groups.reduce((n, g) => n + g.switches.length, 0);
    if (!count) return nothing;
    return html`<button id="quiet-toggle" class="role quiet" aria-expanded=${this.quietOpen ? 'true' : 'false'} @click=${() => this.#setQuiet(!this.quietOpen)}>
        ${this.quietOpen ? REVIEW.hideQuiet : REVIEW.showQuiet(count)}
      </button>
      ${this.quietOpen
        ? html`<div class="quiet-list">
            <p class="hint">${REVIEW.quietHint}</p>
            ${groups.map(
              (g) => html`<h3>${g.name}</h3>
                <ul>
                  ${repeat(
                    g.switches,
                    (s) => s.entityId,
                    (s) => html`<li class="item">
                      <strong>${s.name}</strong>
                      <span class="where">${s.entityId}</span>
                      ${this.#roomPicker(s.entityId, s.name, areas, 'quiet-toggle')}
                    </li>`,
                  )}
                </ul>`,
            )}
          </div>`
        : nothing}`;
  }

  #item(item: ReviewItem, areas: readonly HassArea[]) {
    const where = [item.areaName, item.group === 'config' ? null : item.entityId].filter(Boolean).join(' · ');
    const entityId = item.entityId;
    return html`<li class="item">
      <strong>${item.name}</strong>
      ${where ? html`<span class="where">${where}</span>` : nothing}
      <span class="why">${item.reason}</span>
      ${entityId && item.group === 'area' ? this.#roomPicker(entityId, item.name, areas, 'group-area') : nothing}
      ${item.drop ? html`<div class="roles"><button class="role drop" @click=${() => void this.#drop([item])}>${REVIEW.drop}</button></div>` : nothing}
      ${entityId && item.roles.length
        ? html`<div class="roles">
            ${item.roles.map(
              (role) =>
                html`<button class="role ${role === item.suggested ? 'suggested' : ''}" @click=${() =>
                    void this.#apply(
                      { [entityId]: role },
                      role === 'hidden' ? REVIEW.savedHidden(item.name) : REVIEW.savedAs(item.name, ROLE_LABELS[role]),
                      yamlLine(entityId, role),
                      REVIEW.copiedInstead,
                    )}>
                  ${ROLE_LABELS[role]}
                </button>`,
            )}
          </div>`
        : nothing}
    </li>`;
  }

  render() {
    const hass = this.hass;
    if (!hass) return nothing;
    const admin = !!hass.user?.is_admin;
    const items = admin ? reviewItems(hass, this.config?.options ?? NO_OPTIONS) : [];
    // An empty list means the users could not be read (an administrator always exists): nothing is stale then.
    const stale = admin && this.users?.length ? staleEntries(this.config?.options ?? NO_OPTIONS, new Set(this.users.map((u) => u.id))) : [];
    const lines = suggestedLines(items);
    const areas = admin ? this.#rooms() : [];
    const suggested: Record<string, Role> = Object.fromEntries(
      items
        .filter((i) => (i.group === 'role' || i.group === 'appliance') && i.entityId !== null && i.suggested !== null)
        .map((i) => [i.entityId!, i.suggested!]),
    );
    return html`${this.strips(this.config?.shared)}<header class="hero">
        <button class="back" aria-label=${S.back} @click=${() => goBack()}>${icon(mdiChevronLeft)}</button>
        <div>
          <h1>${REVIEW.title}</h1>
          <p>${admin ? REVIEW.onlyYou : REVIEW.adminOnly}</p>
        </div>
      </header>
      <main>
        <p class="notice" role="status">${this.notice ?? ''}</p>
        ${this.manual ? html`<pre class="manual">${this.manual}</pre>` : nothing}
        ${admin && items.length === 0 && stale.length === 0 ? html`<div class="empty"><strong>${REVIEW.nothing}</strong></div>` : nothing}
        ${lines.length
          ? html`<button class="primary wide" @click=${() => void this.#apply(suggested, REVIEW.savedAll(Object.keys(suggested).length), yamlBlock(lines), REVIEW.copiedAllInstead)}>
              ${REVIEW.applyAll}
            </button>`
          : nothing}
        ${REVIEW_GROUPS.map((group) => {
          const mine = items.filter((i) => i.group === group);
          const droppable = mine.filter((i) => i.drop);
          return mine.length
            ? html`<h2 id=${`group-${group}`} tabindex="-1">${REVIEW.groups[group]} (${mine.length})</h2>
                ${droppable.length > 1
                  ? html`<button class="role drop-all" @click=${() => void this.#drop(droppable)}>${REVIEW.dropAll(droppable.length)}</button>`
                  : nothing}
                <ul>
                  ${repeat(
                    mine,
                    (i) => `${i.entityId ?? ''}|${i.name}|${i.reason}`,
                    (i) => this.#item(i, areas),
                  )}
                </ul>`
            : nothing;
        })}
        ${admin ? this.#quiet(areas) : nothing}
        ${stale.length
          ? html`<h2>${REVIEW.stalePeople} (${stale.length})</h2>
              <ul>
                ${stale.map((s) => this.#stale(s))}
              </ul>`
          : nothing}
      </main>
      <hubb-toast></hubb-toast>
      <hubb-nav-bar
        current="home"
        home-label=${this.config?.homeLabel ?? S.home}
        .homeIcon=${this.homeIcon()}
        ?security=${this.config?.shared?.security ?? false}
        .scenes=${this.config?.shared?.scenes ?? true}
        .media=${this.config?.shared?.mediaTab ?? false}
      ></hubb-nav-bar>${this.restLayer()}`;
  }

  static styles = [
    tokens,
    HubbScreen.baseStyles,
    layoutStyles,
    css`
      .hero {
        box-sizing: border-box;
        display: flex;
        align-items: center;
        gap: 12px;
        max-width: var(--hubb-col, 560px);
        min-height: 76px;
        margin: 0 auto;
        padding: 12px 16px 4px;
      }
      .back {
        all: unset;
        flex: none;
        width: 44px;
        height: 44px;
        display: grid;
        place-items: center;
        border-radius: 50%;
        background: var(--hubb-surface);
        color: var(--hubb-text);
        cursor: pointer;
      }
      .back:focus-visible {
        outline: 2px solid var(--hubb-focus);
        outline-offset: 2px;
      }
      .back svg {
        width: 24px;
        height: 24px;
        fill: currentColor;
      }
      h1 {
        margin: 0;
        font-size: 22px;
        font-weight: 800;
        letter-spacing: -0.02em;
      }
      .hero p {
        margin: 2px 0 0;
        font-size: 12px;
        font-weight: 600;
        color: var(--hubb-text-2);
      }
      /* Reserved height: the list does not jump when the notice comes and goes. */
      .notice {
        min-height: 18px;
        margin: 0 2px 8px;
        font-size: 12px;
        font-weight: 700;
        color: var(--hubb-amber-text);
      }
      .manual {
        margin: 0 0 12px;
        padding: 10px 12px;
        border-radius: 12px;
        background: var(--hubb-surface);
        font-size: 12px;
        white-space: pre-wrap;
        user-select: all;
        -webkit-user-select: all;
      }
      .wide {
        width: 100%;
      }
      ul {
        display: grid;
        gap: 8px;
        margin: 0;
        padding: 0;
        list-style: none;
      }
      .item {
        display: grid;
        gap: 2px;
        padding: 12px;
        border-radius: var(--hubb-radius, 16px);
        background: var(--hubb-surface);
        box-shadow: var(--hubb-card-shadow);
        font-size: 12px;
      }
      .item strong {
        font-size: 13px;
      }
      .where {
        color: var(--hubb-text-2);
        font-weight: 600;
        overflow-wrap: anywhere;
      }
      .why {
        color: var(--hubb-text-2);
      }
      .roles {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-top: 8px;
      }
      .role {
        all: unset;
        box-sizing: border-box;
        min-height: 44px;
        padding: 0 12px;
        display: inline-flex;
        align-items: center;
        border-radius: 12px;
        background: var(--hubb-surface-2);
        color: var(--hubb-text);
        font-size: 12px;
        font-weight: 700;
        cursor: pointer;
      }
      .role:focus-visible {
        outline: 2px solid var(--hubb-focus);
        outline-offset: 2px;
      }
      .role.suggested {
        background: var(--hubb-primary-bg);
        color: var(--hubb-primary-ink);
      }
      .place {
        display: grid;
        gap: 4px;
        margin-top: 8px;
      }
      .pick {
        display: flex;
        gap: 6px;
      }
      .pick .room {
        flex: 1;
        min-width: 0;
      }
      .role[disabled] {
        cursor: default;
        opacity: 0.45;
      }
      .none,
      .hint {
        margin: 0;
        color: var(--hubb-text-2);
      }
      .quiet {
        width: 100%;
        justify-content: center;
        margin-top: 16px;
      }
      .drop-all {
        width: 100%;
        justify-content: center;
        margin-bottom: 8px;
      }
      .quiet-list .hint {
        margin: 10px 2px;
        font-size: 12px;
      }
      h2:focus,
      h3:focus {
        outline: none;
      }
      h3 {
        margin: 14px 2px 8px;
        font-size: 13px;
        font-weight: 800;
      }
      .place label {
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--hubb-text-2);
      }
      .room {
        box-sizing: border-box;
        width: 100%;
        min-height: 44px;
        padding: 0 12px;
        border: 1.5px solid color-mix(in srgb, var(--hubb-text-2) 35%, transparent);
        border-radius: 12px;
        background: var(--hubb-surface-2);
        color: var(--hubb-text);
        font-family: var(--hubb-font);
        font-size: 16px;
      }
      .room:focus-visible {
        outline: 2px solid var(--hubb-focus);
        outline-offset: 1px;
      }
    `,
  ];
}

define('hubb-review-screen', HubbReviewScreen);
