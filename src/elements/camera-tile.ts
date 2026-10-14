import { mdiCctv } from '@mdi/js';
import { LitElement, css, html, nothing } from 'lit';
import { haptic } from '../actions/haptic';
import type { HomeAssistant } from '../ha/types';
import type { CameraItem } from '../model/types';
import { SECURITY } from '../strings';
import { define } from './define';
import { icon } from './icon';

/**
 * A camera on the security tab: one still image, taken when the tab opens and kept while it stays
 * open (Gustavo, 14/10: a camera left running used up the free traffic of the Cloudflare tunnel).
 * A tap opens the live view in Home Assistant's own window, which streams only while it is open.
 */
export class HubbCameraTile extends LitElement {
  static properties = {
    hass: { attribute: false },
    item: { attribute: false },
    failed: { state: true },
  };

  declare hass: HomeAssistant | undefined;
  declare item: CameraItem | undefined;
  /** The image did not load: "Sem imagem", and no second try until the tab opens again. */
  declare failed: boolean;

  /**
   * The image address of this opening of the tab: undefined until asked, '' while Home Assistant signs
   * it, null when there is none.
   */
  #src: string | null | undefined = undefined;
  /** Counts the openings, so an answer that arrives after the tab closed and opened again is dropped. */
  #opening = 0;

  constructor() {
    super();
    this.hass = undefined;
    this.item = undefined;
    this.failed = false;
  }

  connectedCallback(): void {
    super.connectedCallback();
    // Each time the tab opens (Home Assistant attaches the view again), one new image.
    this.#src = undefined;
    this.#opening += 1;
    this.failed = false;
    this.requestUpdate();
  }

  protected willUpdate(): void {
    const { hass, item } = this;
    if (this.#src !== undefined || !hass || !item) return;
    const st = hass.states[item.entityId];
    if (!st || st.state === 'unavailable') {
      this.#src = null;
      return;
    }
    const picture = st.attributes.entity_picture;
    const fallback = typeof picture === 'string' && picture ? picture : null;
    // A hidden view keeps the hass of when it was left, with a token that may have expired; a path
    // signed now, the way the frontend signs its own thumbnails, is fresh on every opening.
    if (!hass.callWS) {
      this.#src = fallback;
      return;
    }
    this.#src = '';
    const opening = this.#opening;
    hass
      .callWS<{ path?: string }>({ type: 'auth/sign_path', path: `/api/camera_proxy/${item.entityId}` })
      .then(
        (r) => (typeof r?.path === 'string' && r.path ? r.path : fallback),
        () => fallback,
      )
      .then((src) => {
        if (opening !== this.#opening) return;
        this.#src = src;
        this.requestUpdate();
      });
  }

  #open = (): void => {
    if (!this.item) return;
    haptic('selection');
    this.dispatchEvent(new CustomEvent('hass-more-info', { detail: { entityId: this.item.entityId }, bubbles: true, composed: true }));
  };

  render() {
    const item = this.item;
    if (!item) return nothing;
    const src = this.#src;
    return html`<button class="camera" @click=${this.#open}>
      <span class="frame">
        ${src === '' || src === undefined
          ? nothing
          : src && !this.failed
            ? html`<img src=${src} alt="" @error=${() => (this.failed = true)} />`
            : html`<span class="none">${icon(mdiCctv)}<span>${SECURITY.noImage}</span></span>`}
      </span>
      <span class="name">${item.name}</span>
      ${item.roomName ? html`<span class="room">${item.roomName}</span>` : nothing}
    </button>`;
  }

  static styles = css`
    :host {
      display: block;
    }
    .camera {
      all: unset;
      box-sizing: border-box;
      display: grid;
      gap: 4px;
      width: 100%;
      padding: 6px 6px 10px;
      border-radius: var(--hubb-radius, 16px);
      background: var(--hubb-surface);
      box-shadow: var(--hubb-card-shadow);
      color: var(--hubb-text);
      font-family: var(--hubb-font);
      cursor: pointer;
    }
    .camera:focus-visible {
      outline: 2px solid var(--hubb-focus);
      outline-offset: 2px;
    }
    .frame {
      display: block;
      aspect-ratio: 16 / 9;
      overflow: hidden;
      border-radius: 12px;
      background: var(--hubb-surface-2);
    }
    img {
      display: block;
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .none {
      display: grid;
      place-items: center;
      align-content: center;
      gap: 4px;
      height: 100%;
      font-size: 12px;
      font-weight: 600;
      color: var(--hubb-text-2);
    }
    .none svg {
      width: 22px;
      height: 22px;
      fill: currentColor;
    }
    .name {
      padding: 0 4px;
      font-weight: 700;
      font-size: 13px;
    }
    .room {
      padding: 0 4px;
      font-size: 11px;
      font-weight: 600;
      color: var(--hubb-text-2);
    }
  `;
}

define('hubb-camera-tile', HubbCameraTile);
