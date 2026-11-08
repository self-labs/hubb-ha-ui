import { LitElement, css, html } from 'lit';
import { define } from './define';

/**
 * The scenes of a room in one line swiped sideways, so many scenes never push the lights down (spec
 * Cenas no cômodo, opção C). It has no bar, so an edge fades while more scenes wait past it: that is all
 * that tells the reader the line goes on.
 */
export class HubbSceneStrip extends LitElement {
  static properties = {
    fadeStart: { type: Boolean, reflect: true, attribute: 'fade-start' },
    fadeEnd: { type: Boolean, reflect: true, attribute: 'fade-end' },
  };

  declare fadeStart: boolean;
  declare fadeEnd: boolean;

  #observer: ResizeObserver | null = null;

  constructor() {
    super();
    this.fadeStart = false;
    this.fadeEnd = false;
  }

  connectedCallback(): void {
    super.connectedCallback();
    // A view switch takes the strip off the page, and the scroll of the line goes with it.
    this.updateComplete.then(() => this.#watch());
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#observer?.disconnect();
    this.#observer = null;
  }

  get #run(): HTMLElement | null {
    return this.renderRoot.querySelector<HTMLElement>('.run');
  }

  /** The line, and every scene in it: a name that grows when the font arrives changes what fits. */
  #watch = (): void => {
    const run = this.#run;
    if (!run || !this.isConnected) return;
    this.#observer?.disconnect();
    if (typeof ResizeObserver !== 'undefined') {
      this.#observer = new ResizeObserver(() => this.#measure());
      this.#observer.observe(run);
      for (const scene of Array.from(this.children)) this.#observer.observe(scene);
    }
    this.#measure();
  };

  #measure = (): void => {
    const run = this.#run;
    if (!run) return;
    // A pixel of slack: a zoomed screen never scrolls quite to the end.
    this.fadeStart = run.scrollLeft > 1;
    this.fadeEnd = run.scrollLeft + run.clientWidth < run.scrollWidth - 1;
  };

  render() {
    return html`<div class="run" @scroll=${this.#measure}><slot @slotchange=${this.#watch}></slot></div>`;
  }

  static styles = css`
    :host {
      --fade: 32px;
      display: block;
    }
    /* The padding keeps the focus ring of a scene inside the line, which clips what leaves it. */
    .run {
      display: flex;
      flex-wrap: nowrap;
      gap: 8px;
      margin: -4px;
      padding: 4px;
      overflow-x: auto;
      overflow-y: hidden;
      scrollbar-width: none;
      overscroll-behavior-x: contain;
    }
    .run::-webkit-scrollbar {
      display: none;
    }
    ::slotted(*) {
      flex: none;
    }
    :host([fade-end]) .run {
      -webkit-mask-image: linear-gradient(to right, #000 calc(100% - var(--fade)), transparent);
      mask-image: linear-gradient(to right, #000 calc(100% - var(--fade)), transparent);
    }
    :host([fade-start]) .run {
      -webkit-mask-image: linear-gradient(to left, #000 calc(100% - var(--fade)), transparent);
      mask-image: linear-gradient(to left, #000 calc(100% - var(--fade)), transparent);
    }
    :host([fade-start][fade-end]) .run {
      -webkit-mask-image: linear-gradient(to right, transparent, #000 var(--fade), #000 calc(100% - var(--fade)), transparent);
      mask-image: linear-gradient(to right, transparent, #000 var(--fade), #000 calc(100% - var(--fade)), transparent);
    }
  `;
}

define('hubb-scene-strip', HubbSceneStrip);
