import { mdiMusicNote } from '@mdi/js';
import { LitElement, css, html, nothing } from 'lit';
import { haptic } from '../actions/haptic';
import type { HomeAssistant } from '../ha/types';
import { library, maEntryId, playItem, search, type LibraryItem } from '../model/ma-library';
import { MEDIA } from '../strings';
import { define } from './define';
import { icon } from './icon';

/** How long the search waits for the last key. */
const SEARCH_MS = 400;
/** The letters a search needs: one or two find everything and nothing (bench, 24/10). */
const MIN_LETTERS = 3;

/**
 * Tocar algo, on the sheet of a speaker with Music Assistant: the search, the songs played last and the
 * playlists of the house's Spotify; a tap plays it here. When Music Assistant does not answer (not set
 * up, or the call fails), the part leaves the sheet in silence: the rest of the sheet still works.
 */
export class HubbMediaBrowse extends LitElement {
  static properties = {
    hass: { attribute: false },
    ma: { attribute: false },
    recent: { state: true },
    playlists: { state: true },
    results: { state: true },
    answered: { state: true },
    query: { state: true },
    off: { state: true },
    broken: { state: true },
  };

  declare hass: HomeAssistant | undefined;
  /** The Music Assistant player that plays what is picked. */
  declare ma: string;
  declare recent: LibraryItem[];
  declare playlists: LibraryItem[];
  /** The answer of the last search; null while none has come. */
  declare results: LibraryItem[] | null;
  /** The words that answer was for: other words on screen show it faded while theirs comes. */
  declare answered: string;
  declare query: string;
  declare off: boolean;
  /** Covers that failed to load: the note stands in for them. */
  declare broken: ReadonlySet<string>;

  #loaded = false;
  #timer: ReturnType<typeof setTimeout> | null = null;
  /** Which search the screen waits for: an older answer arriving late is dropped. */
  #asked = 0;

  constructor() {
    super();
    this.hass = undefined;
    this.ma = '';
    this.recent = [];
    this.playlists = [];
    this.results = null;
    this.answered = '';
    this.query = '';
    this.off = false;
    this.broken = new Set();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this.#timer) clearTimeout(this.#timer);
    this.#timer = null;
  }

  /** "Spotify" in Fonte with nothing to resume brings the person here, further down the sheet. */
  focusSearch(): void {
    const input = this.renderRoot.querySelector<HTMLInputElement>('input.search');
    input?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    input?.focus({ preventScroll: true });
  }

  protected updated(): void {
    if (this.#loaded || !this.hass) return;
    this.#loaded = true;
    void this.#load(this.hass);
  }

  async #load(hass: HomeAssistant): Promise<void> {
    try {
      if (!(await maEntryId(hass))) {
        this.off = true;
        return;
      }
      const [recent, playlists] = await Promise.all([library(hass, 'recent'), library(hass, 'playlists')]);
      this.recent = recent;
      this.playlists = playlists;
    } catch {
      this.off = true;
    }
  }

  #typed(text: string): void {
    this.query = text;
    if (this.#timer) clearTimeout(this.#timer);
    const asked = ++this.#asked;
    // Below three letters the list stays as it was: the songs played last and the playlists.
    if (text.trim().length < MIN_LETTERS) {
      this.results = null;
      return;
    }
    this.#timer = setTimeout(() => {
      this.#timer = null;
      const hass = this.hass;
      if (!hass) return;
      search(hass, text.trim())
        .then((found) => {
          if (asked === this.#asked) [this.results, this.answered] = [found, text.trim()];
        })
        .catch(() => {
          if (asked === this.#asked) [this.results, this.answered] = [[], text.trim()];
        });
    }, SEARCH_MS);
  }

  #play(item: LibraryItem): void {
    if (!this.hass || !this.ma) return;
    haptic('light');
    playItem(this.hass, this.ma, item).catch(() => haptic('failure'));
  }

  #list(items: readonly LibraryItem[]) {
    return items.map(
      (item) => html`<button class="item" @click=${() => this.#play(item)}>
        ${item.image && !this.broken.has(item.image)
          ? html`<img class="art" src=${item.image} alt="" @error=${() => (this.broken = new Set([...this.broken, item.image!]))} />`
          : html`<span class="art note">${icon(mdiMusicNote)}</span>`}
        <span class="words"><span class="name">${item.name}</span>${item.subtitle ? html`<span class="sub">${item.subtitle}</span>` : nothing}</span>
      </button>`,
    );
  }

  render() {
    if (this.off || !this.hass) return nothing;
    const words = this.query.trim();
    const searching = words.length >= MIN_LETTERS;
    // While the answer to these words is on its way, what was there stays: the last answer faded, or
    // the songs played last and the playlists. The list never goes blank under the fingers.
    const waiting = searching && (this.results === null || this.answered !== words);
    return html`<p class="label">${MEDIA.playSomething}</p>
      <input
        class="search"
        type="search"
        .value=${this.query}
        placeholder=${MEDIA.searchPlaceholder}
        aria-label=${MEDIA.searchPlaceholder}
        @input=${(e: Event) => this.#typed((e.target as HTMLInputElement).value)}
      />
      ${waiting ? html`<p class="searching">${MEDIA.searching}</p>` : nothing}
      ${searching && this.results !== null
        ? html`<div class="results ${waiting ? 'stale' : ''}">
            ${this.results.length ? this.#list(this.results) : waiting ? nothing : html`<p class="none">${MEDIA.nothingFound}</p>`}
          </div>`
        : html`${this.recent.length ? html`<p class="section">${MEDIA.recent}</p>${this.#list(this.recent)}` : nothing}
          ${this.playlists.length ? html`<p class="section">${MEDIA.playlists}</p>${this.#list(this.playlists)}` : nothing}`}`;
  }

  static styles = css`
    :host {
      display: block;
      font-family: var(--hubb-font);
      color: var(--hubb-text);
    }
    .label,
    .section {
      margin: 16px 2px 8px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--hubb-text-2);
    }
    .section {
      margin-top: 12px;
    }
    .search {
      box-sizing: border-box;
      width: 100%;
      min-height: 48px;
      padding: 0 12px;
      border: 1.5px solid color-mix(in srgb, var(--hubb-text-2) 35%, transparent);
      border-radius: 12px;
      background: var(--hubb-surface);
      color: var(--hubb-text);
      font-family: var(--hubb-font);
      font-size: 16px;
    }
    .item {
      all: unset;
      box-sizing: border-box;
      width: 100%;
      min-height: 52px;
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 4px 2px;
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;
    }
    .art {
      flex: none;
      width: 44px;
      height: 44px;
      border-radius: 8px;
      object-fit: cover;
    }
    .note {
      display: grid;
      place-items: center;
      background: var(--hubb-surface-2);
    }
    .note svg {
      width: 20px;
      height: 20px;
      fill: var(--hubb-text-2);
    }
    .words {
      min-width: 0;
      display: grid;
    }
    .name,
    .sub {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .name {
      font-size: 14px;
      font-weight: 700;
    }
    .sub {
      font-size: 12px;
      color: var(--hubb-text-2);
    }
    .searching {
      margin: 10px 2px 0;
      font-size: 12px;
      color: var(--hubb-text-2);
    }
    .results.stale {
      opacity: 0.5;
      transition: opacity var(--hubb-motion, 200ms) ease;
    }
    .none {
      margin: 12px 2px;
      font-size: 13px;
      color: var(--hubb-text-2);
    }
    .search:focus-visible,
    .item:focus-visible {
      outline: 2px solid var(--hubb-focus);
      outline-offset: 2px;
    }
  `;
}

define('hubb-media-browse', HubbMediaBrowse);
