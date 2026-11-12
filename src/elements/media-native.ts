import { mdiChevronLeft, mdiChevronRight, mdiFolderOutline, mdiMusicNote, mdiPlay } from '@mdi/js';
import { LitElement, css, html, nothing } from 'lit';
import { haptic } from '../actions/haptic';
import type { HomeAssistant } from '../ha/types';
import { brandImage, browseFolder, browseRoot, playNative, signedImage, type NativeFolder, type NativeItem } from '../model/native-library';
import { MEDIA } from '../strings';
import { define } from './define';
import { icon } from './icon';
import { listStyles } from './media-list-styles';

/** Rows a folder shows at first, and each "Mostrar mais" adds: Radio Browser lists 600 languages and 225 countries. */
const PAGE = 30;

/** A folder opened, and how many of its rows show. */
interface Level extends NativeFolder {
  shown: number;
}

/**
 * Tocar algo on the sheet of a speaker without Music Assistant: what the player lists itself (its
 * favorites, its presets with a name) and the audio libraries of Home Assistant (DLNA servers, internet
 * radios). A folder opens in place, with a way back; a tap on what plays plays it here. A player that
 * lists nothing, or does not answer, leaves the sheet in silence: the rest of it still works.
 */
export class HubbMediaNative extends LitElement {
  static properties = {
    hass: { attribute: false },
    entityId: { attribute: false },
    levels: { state: true },
    images: { state: true },
    loading: { state: true },
    failed: { state: true },
    off: { state: true },
    broken: { state: true },
  };

  declare hass: HomeAssistant | undefined;
  /** The speaker whose list this is. */
  declare entityId: string;
  /** The folders opened, from the root to the one on screen. */
  declare levels: Level[];
  /** The pictures ready to show: the address the player gave, and the one that loads. */
  declare images: ReadonlyMap<string, string>;
  /** A folder is on its way: the list stays, faded, and a second tap waits. */
  declare loading: boolean;
  /** The last folder asked for did not open. */
  declare failed: boolean;
  declare off: boolean;
  /** Pictures that failed to load: the note stands in for them. */
  declare broken: ReadonlySet<string>;

  /** The speaker the list was asked for: it is asked again only when this one changes, never on a state. */
  #for = '';
  /** Which speaker's list the screen waits for: an answer coming late for the previous one is dropped. */
  #session = 0;
  /** The theme the pictures are signed for: a library has one icon for each. */
  #dark = false;

  constructor() {
    super();
    this.hass = undefined;
    this.entityId = '';
    this.levels = [];
    this.images = new Map();
    this.loading = false;
    this.failed = false;
    this.off = false;
    this.broken = new Set();
  }

  protected willUpdate(): void {
    const hass = this.hass;
    if (!hass || !this.entityId) return;
    const dark = hass.themes?.darkMode === true;
    if (this.entityId !== this.#for) {
      [this.#for, this.#dark] = [this.entityId, dark];
      void this.#start(hass, this.entityId, ++this.#session);
    } else if (dark !== this.#dark) {
      // The icons of the other theme are signed; each row keeps its note until its own arrives.
      this.#dark = dark;
      for (const level of this.levels) this.#sign(hass, level, this.#session);
    }
  }

  async #start(hass: HomeAssistant, speaker: string, session: number): Promise<void> {
    [this.levels, this.images, this.broken, this.off, this.failed, this.loading] = [[], new Map(), new Set(), false, false, true];
    try {
      const root = await browseRoot(hass, speaker);
      if (session !== this.#session) return;
      this.loading = false;
      if (!root.items.length) {
        this.off = true;
        return;
      }
      this.levels = [{ ...root, shown: PAGE }];
      this.#sign(hass, root, session);
    } catch {
      if (session !== this.#session) return;
      [this.loading, this.off] = [false, true];
    }
  }

  async #enter(item: NativeItem): Promise<void> {
    const hass = this.hass;
    if (!hass || this.loading) return;
    haptic('selection');
    const session = this.#session;
    [this.loading, this.failed] = [true, false];
    try {
      const folder = await browseFolder(hass, this.entityId, item);
      if (session !== this.#session) return;
      // The row that was tapped names the folder: Radio Browser answers every folder of its own with the
      // name of the whole library ("Radio Browser" over Populares).
      const opened = { ...folder, title: item.title || folder.title, shown: PAGE };
      [this.levels, this.loading] = [[...this.levels, opened], false];
      this.#sign(hass, opened, session);
    } catch {
      if (session !== this.#session) return;
      [this.loading, this.failed] = [false, true];
    }
  }

  #back(): void {
    haptic('selection');
    [this.levels, this.failed] = [this.levels.slice(0, -1), false];
  }

  #more(): void {
    const last = this.levels[this.levels.length - 1]!;
    this.levels = [...this.levels.slice(0, -1), { ...last, shown: last.shown + PAGE }];
  }

  #play(item: NativeItem): void {
    if (!this.hass) return;
    haptic('light');
    playNative(this.hass, this.entityId, item).catch(() => haptic('failure'));
  }

  /** The pictures of a folder, one by one as they are signed: the list shows at once, with the note. */
  #sign(hass: HomeAssistant, folder: NativeFolder, session: number): void {
    for (const item of folder.items) {
      const image = item.image ? brandImage(item.image, this.#dark) : null;
      if (!image || this.images.has(image)) continue;
      void signedImage(hass, image).then((src) => {
        if (session === this.#session && src) this.images = new Map(this.images).set(image, src);
      });
    }
  }

  #row(item: NativeItem) {
    const src = item.image ? this.images.get(brandImage(item.image, this.#dark)) : undefined;
    const art =
      src && !this.broken.has(src)
        ? html`<img class="art" src=${src} alt="" @error=${() => (this.broken = new Set([...this.broken, src]))} />`
        : html`<span class="art note">${icon(item.canExpand ? mdiFolderOutline : mdiMusicNote)}</span>`;
    return html`<div class="row">
      <button class="item" @click=${() => (item.canExpand ? void this.#enter(item) : this.#play(item))}>
        ${art}
        <span class="words"><span class="name">${item.title}</span></span>
        ${item.canExpand ? html`<span class="chevron">${icon(mdiChevronRight)}</span>` : nothing}
      </button>
      ${item.canExpand && item.canPlay
        ? html`<button class="play-all" aria-label=${MEDIA.playAll} @click=${() => this.#play(item)}>${icon(mdiPlay)}</button>`
        : nothing}
    </div>`;
  }

  render() {
    const folder = this.levels[this.levels.length - 1];
    if (this.off || !this.hass || !folder) return nothing;
    return html`<p class="label">${MEDIA.playSomething}</p>
      ${this.levels.length > 1
        ? html`<button class="item back" @click=${() => this.#back()}>${icon(mdiChevronLeft)}<span class="name">${MEDIA.up}</span></button>
            <p class="section">${folder.title}</p>`
        : nothing}
      <div class="list ${this.loading ? 'stale' : ''}">
        ${folder.items.length ? folder.items.slice(0, folder.shown).map((item) => this.#row(item)) : html`<p class="none">${MEDIA.nothingFound}</p>`}
      </div>
      ${folder.items.length > folder.shown
        ? html`<button class="item more" @click=${() => this.#more()}>${MEDIA.showMore(folder.items.length - folder.shown)}</button>`
        : nothing}
      ${this.failed ? html`<p class="none">${MEDIA.cannotOpen}</p>` : nothing}`;
  }

  static styles = [
    listStyles,
    css`
      .row {
        display: flex;
        align-items: center;
      }
      .row .item {
        flex: 1;
        width: auto;
        min-width: 0;
      }
      .chevron {
        margin-left: auto;
        display: grid;
      }
      .chevron svg,
      .back svg {
        width: 20px;
        height: 20px;
        fill: var(--hubb-text-2);
      }
      .back,
      .more {
        min-height: 44px;
      }
      .more {
        justify-content: center;
        font-size: 13px;
        font-weight: 700;
        color: var(--hubb-text-2);
      }
      .play-all {
        all: unset;
        box-sizing: border-box;
        flex: none;
        width: 44px;
        height: 44px;
        display: grid;
        place-items: center;
        border-radius: 50%;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
      }
      .play-all svg {
        width: 22px;
        height: 22px;
        fill: var(--hubb-text);
      }
      .play-all:focus-visible {
        outline: 2px solid var(--hubb-focus);
        outline-offset: 2px;
      }
      .list.stale {
        opacity: 0.5;
        transition: opacity var(--hubb-motion, 200ms) ease;
      }
    `,
  ];
}

define('hubb-media-native', HubbMediaNative);
