import { LitElement, css, html, nothing, type PropertyDeclarations, type PropertyValues } from 'lit';
import { keyed } from 'lit/directives/keyed.js';
import { dashboardPath, putBack, putBackTabs, setEntity, setTabs } from '../actions/dashboard-config';
import { haptic } from '../actions/haptic';
import { runScene } from '../actions/light';
import { sceneLights, withUndo, type ServiceCall } from '../actions/undo';
import { UNDO, type HubbToast } from '../elements/toast';
import type { HomeAssistant } from '../ha/types';
import type { HubbConfig, SceneItem, Shared, TabId } from '../model/types';
import { SCENE_LABEL } from '../model/classify';
import { hiddenForList } from '../model/visibility';
import { onEditingChange } from '../editing';
import { EDIT, REVIEW, sceneRan } from '../strings';
import '../elements/people-picker';
import type { PeopleChange } from '../elements/people-picker';
import '../elements/sheet';
import '../elements/status-strips';
import '../elements/toast';
import { keepSheet, keptSheet, leaveSheets, REBUILD_MS } from '../sheets';
import { areaNow, layoutNow, onLayoutChange, railHidden, reportArea } from '../layout';
import { configureRest, isResting, onRestChange, screenShown } from '../actions/rest';
import { sampleServerClock } from '../server-clock';
import { latestHass, setLatestHass } from '../latest-hass';
import '../elements/rest-screen';
import type { Layout } from '../model/layout';
import { PLACE_ICON, type Place } from '../model/profiles';

/** Whose "Quem vê" sheet is open on a tab screen: the tab itself or one of its items. */
export type PeopleTarget = { kind: 'tab'; tab: TabId; name: string } | { kind: 'entity'; entityId: string; name: string };

/** What every screen shares: theme from the profile, the undo toast, and running scenes. */
/**
 * Where each page is scrolled (the screen, and the columns of the wide home), by the same key as its
 * sheets. Home Assistant rebuilds the page after a save or a registry change, and the new screen
 * starts at the top: it takes the place of the one it replaces, as the sheets do (src/sheets.ts).
 */
interface KeptScroll {
  tops: number[];
  owner: object;
  left: number | null;
}
const keptScroll = new Map<string, KeptScroll>();

export abstract class HubbScreen extends LitElement {
  // Typed as PropertyDeclarations so screens can declare their own properties; Lit merges them.
  static properties: PropertyDeclarations = {
    hass: { attribute: false },
    theme: { reflect: true },
    offline: { type: Boolean, reflect: true },
    editNotice: { state: true },
    peopleTarget: { state: true },
    screenLayout: { reflect: true, attribute: 'screen-layout' },
    embedded: { type: Boolean, reflect: true },
  };

  declare hass: HomeAssistant | undefined;
  declare theme: 'dark' | 'light';
  /** Home Assistant lost the connection: the strip says so and the controls take no tap. */
  declare offline: boolean;
  /** Said in place of the edit hint when a save failed. */
  declare editNotice: string | null;
  /** The tab or the item whose "Quem vê" sheet is open (Cenas, Segurança). */
  declare peopleTarget: PeopleTarget | null;
  /** Phone, roomy or wide, from the area of the panel (`src/layout.ts`); the styles key on it. */
  declare screenLayout: Layout;
  /** Drawn inside another screen (the room on the wide home): the screen that holds it measures. */
  declare embedded: boolean;

  #unwatch: (() => void) | null = null;
  #unwatchLayout: (() => void) | null = null;
  #unwatchRest: (() => void) | null = null;
  #observer: ResizeObserver | null = null;
  /** Tells the rest of a wall tablet this screen left the page. */
  #shown: (() => void) | null = null;
  /** The place of the page this one replaces, until it is reached (the content may still be growing). */
  #restore: { tops: number[]; until: number } | null = null;

  /** The edit mode of a tab screen: the pencil by the title, the hint, and small tool buttons. */
  static editStyles = css`
    .title {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }
    .edit {
      all: unset;
      flex: none;
      box-sizing: border-box;
      width: 44px;
      height: 44px;
      display: grid;
      place-items: center;
      border-radius: 12px;
      background: var(--hubb-surface);
      color: var(--hubb-text-2);
      cursor: pointer;
    }
    .edit.on {
      background: var(--hubb-primary-bg);
      color: var(--hubb-primary-ink);
    }
    .edit svg {
      width: 20px;
      height: 20px;
      fill: currentColor;
    }
    .hint {
      margin: 0 2px 10px;
      padding: 10px 12px;
      border-radius: 12px;
      background: var(--hubb-surface);
      font-size: 12px;
      font-weight: 600;
      color: var(--hubb-text-2);
    }
    .tools {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px;
      margin: 6px 0 4px;
    }
    .tool {
      all: unset;
      box-sizing: border-box;
      min-height: 40px;
      padding: 0 12px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 12px;
      background: var(--hubb-surface-2);
      color: var(--hubb-text);
      font-family: var(--hubb-font);
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
    }
    .edit:focus-visible,
    .tool:focus-visible {
      outline: 2px solid var(--hubb-focus);
      outline-offset: 2px;
    }
  `;

  static baseStyles = css`
    :host {
      display: block;
      min-height: 100vh;
      min-height: 100dvh;
      background: var(--hubb-bg);
      color: var(--hubb-text);
      font-family: var(--hubb-font);
      -webkit-font-smoothing: antialiased;
    }
    /* The screen scrolls by itself, as tall as the area: the page of Home Assistant under it never
       does. Never sideways, and with no scroll bar on any screen (Gustavo, 21/10). */
    :host(:not([embedded])) {
      box-sizing: border-box;
      min-height: 0;
      height: calc(100vh - var(--hubb-area-top, 0px));
      height: calc(100dvh - var(--hubb-area-top, 0px));
      overflow-x: hidden;
      overflow-y: auto;
      overscroll-behavior: contain;
      scrollbar-width: none;
    }
    :host(:not([embedded]))::-webkit-scrollbar {
      display: none;
    }
    /* Drawn inside another screen (the room on the wide home): the screen around it has the page. */
    :host([embedded]) {
      min-height: 0;
      background: transparent;
    }
    :host([embedded]) main {
      padding-bottom: 24px;
    }
    /* Out of reach: nothing on screen would answer, so nothing takes a tap (and inert, set in
       updated(), keeps the keyboard and screen readers out too), an open sheet included. */
    :host([offline]) main,
    :host([offline]) .side,
    :host([offline]) hubb-sheet > * {
      opacity: 0.45;
      pointer-events: none;
    }
    main {
      box-sizing: border-box;
      max-width: var(--hubb-col, 560px);
      margin: 0 auto;
      /* The top is Home Assistant's: its layout already sits below the status bar. Only the
         bottom needs the safe area, because the nav bar is fixed to the viewport. */
      padding: 12px 16px calc(96px + env(safe-area-inset-bottom));
    }
    h2 {
      margin: 22px 2px 10px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--hubb-text-2);
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 8px;
    }
    .primary {
      all: unset;
      box-sizing: border-box;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 44px;
      padding: 0 16px;
      border-radius: 14px;
      background: var(--hubb-primary-bg);
      color: var(--hubb-primary-ink);
      font-family: var(--hubb-font);
      font-weight: 700;
      font-size: 13px;
      cursor: pointer;
    }
    .primary:focus-visible {
      outline: 2px solid var(--hubb-focus);
      outline-offset: 2px;
    }
    .empty {
      margin-top: 48px;
      text-align: center;
      color: var(--hubb-text-2);
      font-size: 13px;
    }
    .empty strong {
      display: block;
      margin-bottom: 6px;
      color: var(--hubb-text);
      font-size: 16px;
    }
  `;

  #onRunScene = (e: Event): void => {
    const hass = this.hass;
    if (!hass) return;
    // A room drawn inside the wide home runs its own scene: the home around it must not run it again.
    e.stopPropagation();
    const scene = (e as CustomEvent<{ scene: SceneItem }>).detail.scene;
    // A scene says which lights it sets, on the panel or not: those, and only those, go back. A script
    // does not say, so the whole panel is the scope, and a still running script is stopped first.
    const members = sceneLights(hass, scene.entityId, this.scope());
    const stop: ServiceCall[] = scene.entityId.startsWith('script.')
      ? [{ domain: 'script', service: 'turn_off', target: { entity_id: scene.entityId } }]
      : [];
    this.undoable(members.length ? members : this.scope(), sceneRan(scene.name), () => runScene(hass, scene.entityId), {
      stop,
      targets: members,
    });
  };

  constructor() {
    super();
    this.hass = undefined;
    this.theme = 'dark';
    this.offline = false;
    this.editNotice = null;
    this.peopleTarget = null;
    this.screenLayout = layoutNow();
    this.embedded = false;
    this.addEventListener('hubb-run-scene', this.#onRunScene);
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.#unwatch = onEditingChange(() => this.requestUpdate());
    this.#unwatchLayout = onLayoutChange(() => this.#applyLayout());
    this.#unwatchRest = onRestChange(() => this.requestUpdate());
    if (!this.embedded) {
      this.#shown = screenShown();
      this.#takeScroll();
      this.addEventListener('scroll', this.#onScroll, { passive: true });
      this.renderRoot.addEventListener('scroll', this.#onScroll, { capture: true, passive: true });
      // Measured at once, so the first paint already has the right layout; then on every resize.
      this.#measure();
      if (typeof ResizeObserver !== 'undefined') {
        this.#observer = new ResizeObserver(() => this.#measure());
        this.#observer.observe(this);
      }
    }
    this.#applyLayout();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#unwatch?.();
    this.#unwatch = null;
    this.#unwatchLayout?.();
    this.#unwatchLayout = null;
    this.#unwatchRest?.();
    this.#shown?.();
    this.#shown = null;
    this.removeEventListener('scroll', this.#onScroll);
    this.renderRoot.removeEventListener('scroll', this.#onScroll, { capture: true });
    const k = keptScroll.get(this.#scrollKey());
    if (k?.owner === this) k.left = Date.now();
    this.#unwatchRest = null;
    this.#observer?.disconnect();
    this.#observer = null;
    leaveSheets(this);
  }

  #measure(): void {
    const r = this.getBoundingClientRect();
    // Where the screen starts on the page, not on the window: scrolled, its top would go negative.
    reportArea({ left: r.left, top: r.top + window.scrollY, width: r.width, height: r.height }, window.innerHeight);
  }

  /** The layout of the panel, and where its area sits for what is fixed to it (bar, sheet, toast). */
  #applyLayout(): void {
    this.screenLayout = layoutNow();
    // The rail put away (wide only): the screen takes its room, and the undo is centred without it.
    const away = railHidden();
    this.toggleAttribute('rail-hidden', away);
    this.style.setProperty('--hubb-rail', away ? '0px' : '84px');
    const area = areaNow();
    // Not measured yet (or no layout engine): the fallbacks of the styles take the whole window.
    for (const [name, value] of [
      ['--hubb-area-left', area.left],
      ['--hubb-area-top', area.top],
      ['--hubb-area-width', area.width],
    ] as const) {
      if (area.width > 0) this.style.setProperty(name, `${value}px`);
      else this.style.removeProperty(name);
    }
  }

  /** What the strategy shares with every screen (alerts, the tablet of the viewer); missing on old dashboards. */
  protected sharedSlice(): Shared | undefined {
    return (this as unknown as { config?: { shared?: Shared } }).config?.shared;
  }

  /** A home or a business, after the profile of the dashboard; a home on dashboards frozen before it came. */
  protected place(): Place {
    return this.sharedSlice()?.place === 'business' ? 'business' : 'home';
  }

  /** The icon of the first tab of the bar: a house, or a building for a business. */
  protected homeIcon(): string {
    return PLACE_ICON[this.place()];
  }

  /**
   * The rest screen of a wall tablet, over the page while it rests (src/actions/rest.ts); `line` is the
   * summary of the house, which the home hands it (resting always opens the home).
   */
  protected restLayer(line = '', weather: string | null = null) {
    return !this.embedded && isResting()
      ? html`<hubb-rest-screen .hass=${this.hass} .line=${line} .weatherId=${weather}></hubb-rest-screen>`
      : nothing;
  }

  /**
   * The properties that hold this screen's open sheets, one per `hubb-sheet` it draws. Each one opens
   * again on the page Home Assistant rebuilds after a tap; a sheet left out of this list closes on the
   * first tap that changes a registry (test/sheets-rebuild.test.ts counts them).
   */
  static keptSheets: readonly string[] = [];

  /** What tells this screen's sheets apart from another page of the same kind (the room of a room page). */
  protected sheetScope(): string {
    return '';
  }

  /** What scrolls on this screen: the screen itself; the wide home adds its two columns. */
  protected scrollers(): HTMLElement[] {
    return [this];
  }

  #scrollKey(): string {
    return `${this.localName}:${this.sheetScope()}`;
  }

  #onScroll = (): void => {
    if (this.#restore) return;
    keptScroll.set(this.#scrollKey(), { tops: this.scrollers().map((e) => e.scrollTop), owner: this, left: null });
  };

  /** The place of the page this screen replaces, when it left a moment ago (a rebuild, not a new visit). */
  #takeScroll(): void {
    const key = this.#scrollKey();
    const k = keptScroll.get(key);
    if (!k || k.owner === this) return;
    if (k.left !== null && Date.now() - k.left > REBUILD_MS) {
      keptScroll.delete(key);
      return;
    }
    k.owner = this;
    k.left = null;
    this.#restore = { tops: k.tops, until: Date.now() + REBUILD_MS };
  }

  #applyScroll(): void {
    const r = this.#restore;
    if (!r) return;
    const scrollers = this.scrollers();
    scrollers.forEach((e, i) => {
      const top = r.tops[i] ?? 0;
      if (e.scrollTop !== top) e.scrollTop = top;
    });
    // Reached, or the content never grew that tall: the page is the reader's again.
    if (scrollers.every((e, i) => e.scrollTop === (r.tops[i] ?? 0)) || Date.now() > r.until) this.#restore = null;
  }

  /** Whether one of its sheets is open: a property of `keptSheets` holds something. */
  hasOpenSheet(): boolean {
    const self = this as unknown as Record<string, unknown>;
    return (this.constructor as typeof HubbScreen).keptSheets.some((k) => self[k] !== null && self[k] !== undefined && self[k] !== false);
  }

  /**
   * Whether this person may edit this dashboard: an administrator, on a dashboard whose strategy
   * handed its configuration over (one frozen with "Take control" has none).
   */
  protected canEdit(options: unknown): boolean {
    return !!this.hass?.user?.is_admin && options !== undefined;
  }

  /**
   * Saves a change of the dashboard configuration; Home Assistant rebuilds the dashboard by itself.
   * `change` returns its undo, offered as Desfazer. False when it could not save.
   */
  protected async saveChange(
    message: string,
    change: (hass: HomeAssistant, urlPath: string | null) => Promise<(hass: HomeAssistant) => Promise<unknown>>,
  ): Promise<boolean> {
    const hass = this.hass;
    if (!hass) return false;
    const urlPath = dashboardPath();
    try {
      const undo = await change(hass, urlPath);
      haptic('success');
      this.editNotice = null;
      this.toast()?.show(message, () => void undo(latestHass() ?? hass).catch(() => haptic('failure')));
      return true;
    } catch {
      haptic('failure');
      this.editNotice = EDIT.failed;
      return false;
    }
  }

  /** Light ids whose state an action on this screen may change, for the undo snapshot. */
  protected abstract scope(): string[];

  #reopened = false;

  protected willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('hass') && this.hass) {
      this.theme = this.hass.themes.darkMode ? 'dark' : 'light';
      this.offline = this.hass.connected === false;
      setLatestHass(this.hass);
      // The screen on show hands the rest of a wall tablet its user's tablet and the newest hass.
      if (!this.embedded) configureRest(this.sharedSlice()?.tablet ?? null, this.hass);
      // A state that just arrived tells how far this device's clock is from the server's (src/server-clock.ts).
      if (!this.embedded) sampleServerClock((changed.get('hass') as HomeAssistant | undefined)?.states, this.hass.states);
    }
    // The page Home Assistant rebuilt opens the sheets the one it replaced had open.
    const self = this as unknown as Record<string, unknown>;
    const key = (name: string): string => `${this.localName}:${this.sheetScope()}:${name}`;
    for (const name of (this.constructor as typeof HubbScreen).keptSheets) {
      if (!this.#reopened) self[name] ??= keptSheet(key(name), this);
      else if ((changed as Map<PropertyKey, unknown>).has(name)) keepSheet(key(name), this, self[name]);
    }
    this.#reopened = true;
  }

  protected updated(changed: PropertyValues<this>): void {
    super.updated(changed);
    this.#applyScroll();
    // Out of reach, the page and what an open sheet holds take no key and reach no screen reader
    // either; the strips that say so, the bar and closing a sheet still work.
    for (const el of this.renderRoot.querySelectorAll('main, .side, .hero .actions, hubb-sheet > *')) el.toggleAttribute('inert', this.offline);
  }

  /** The strips of every screen (alerts, the house out of reach), from the slice the strategy shares. */
  protected strips(shared: Shared | undefined) {
    return html`<hubb-status-strips
      .hass=${this.hass}
      .alerts=${shared?.alerts ?? []}
      .security=${shared?.security ?? true}
      .place=${this.place()}
    ></hubb-status-strips>`;
  }

  /** The ids `hidden_for` holds for a tab or an item, from the configuration of the dashboard. */
  protected hiddenForOf(options: HubbConfig | undefined, target: PeopleTarget): string[] {
    return hiddenForList(target.kind === 'tab' ? options?.tabs?.[target.tab]?.hidden_for : options?.entities?.[target.entityId]?.hidden_for);
  }

  /** The "Quem vê" sheet of a tab or of one of its items; open while `peopleTarget` is set. */
  protected peopleSheet(options: HubbConfig | undefined) {
    const target = this.peopleTarget;
    return html`<hubb-sheet
      class="people"
      ?open=${target !== null}
      heading=${target?.kind === 'tab' ? EDIT.whoSeesTab : EDIT.whoSeesItem}
      subheading=${target?.name ?? ''}
      @hubb-close=${() => (this.peopleTarget = null)}
    >
      ${target
        ? // One picker per tab or item: the taps on one never carry over to the next one opened.
          keyed(
            target.kind === 'tab' ? `tab:${target.tab}` : target.entityId,
            html`<hubb-people-picker
              .hass=${this.hass}
              .place=${this.place()}
              .hiddenFor=${this.hiddenForOf(options, target)}
              @hubb-people=${(e: CustomEvent<PeopleChange>) => void this.#savePeople(target, e.detail)}
            ></hubb-people-picker>`,
          )
        : nothing}
    </hubb-sheet>`;
  }

  async #savePeople(target: PeopleTarget, change: PeopleChange): Promise<void> {
    const hiddenFor = change.hiddenFor.length ? change.hiddenFor : undefined;
    const what = target.kind === 'tab' ? EDIT.tabName(target.name) : target.name;
    const message = change.sees ? EDIT.nowShownFor(what, change.person) : EDIT.nowHiddenFor(what, change.person);
    const saved = await this.saveChange(message, async (hass, urlPath) => {
      if (target.kind === 'tab') {
        const before = await setTabs(hass, urlPath, { [target.tab]: { hidden_for: hiddenFor } });
        return (h) => putBackTabs(h, urlPath, before);
      }
      const before = await setEntity(hass, urlPath, target.entityId, { hidden_for: hiddenFor });
      return (h) => putBack(h, urlPath, before);
    });
    // Not saved: the sheet closes, so the notice behind it can be read and the buttons start over.
    if (!saved) this.peopleTarget = null;
  }

  /**
   * "Não mostrar" for a scene, with Desfazer. One added from the panel (role scene, no hubb_cena
   * label) just leaves Cenas and goes back to "Adicionar cena": hidden, Mostrar in its room would drop
   * the role and lose it.
   */
  protected hideItem(entityId: string, name: string, options: HubbConfig | undefined): void {
    const added = options?.entities?.[entityId]?.role === 'scene' && !this.hass?.entities[entityId]?.labels.includes(SCENE_LABEL);
    void this.saveChange(added ? EDIT.sceneRemoved(name) : REVIEW.savedHidden(name), async (hass, urlPath) => {
      const before = await setEntity(hass, urlPath, entityId, { role: added ? undefined : 'hidden' });
      return (h) => putBack(h, urlPath, before);
    });
  }

  /**
   * The undo on offer. The offer is one for the whole panel (`src/elements/toast.ts`), so a room drawn
   * inside the wide home, which has no toast of its own, shows it on the home's.
   */
  protected toast(): Pick<HubbToast, 'show' | 'hide'> {
    return UNDO;
  }

  protected undoable(
    ids: string[],
    message: string,
    action: () => Promise<unknown>,
    extra: { stop?: readonly ServiceCall[]; targets?: readonly string[] } = {},
  ): void {
    const hass = this.hass;
    if (!hass) return;
    let mine: (() => void) | null = null;
    void withUndo(
      hass,
      ids,
      action,
      (undo) => {
        mine = undo;
        this.toast()?.show(message, undo);
      },
      {
        // Desfazer may be tapped on another screen; Home Assistant stops updating a hidden view.
        current: () => latestHass() ?? this.hass,
        stop: extra.stop,
        targets: extra.targets,
        // Withdraw this action's offer only: a later action may already have its own.
        failed: () => {
          if (mine) this.toast()?.hide(mine);
        },
      },
    );
  }

  getCardSize(): number {
    return 12;
  }
}
