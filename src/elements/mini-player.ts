import { mdiMusicNote, mdiPause, mdiPlay, mdiSkipNext } from '@mdi/js';
import { LitElement, css, html, nothing } from 'lit';
import { haptic } from '../actions/haptic';
import { MEDIA_FEATURE } from '../actions/media';
import type { HomeAssistant } from '../ha/types';
import { commandTarget, mediaView } from '../model/media';
import type { MediaItem } from '../model/types';
import { MEDIA } from '../strings';
import { define } from './define';
import { icon } from './icon';

/**
 * The music playing, at the foot of the column of the wide home: the cover, the song and the artist,
 * play or pause and the next song. A tap on the song opens the sheet of the speaker (`hubb-open-media`).
 */
export class HubbMiniPlayer extends LitElement {
  static properties = { hass: { attribute: false }, item: { attribute: false }, broken: { state: true } };

  declare hass: HomeAssistant | undefined;
  declare item: MediaItem | undefined;
  /** A cover that failed to load: the note takes its place. */
  declare broken: string | null;

  constructor() {
    super();
    this.hass = undefined;
    this.item = undefined;
    this.broken = null;
  }

  #call(service: string, target: string): void {
    haptic('light');
    this.hass?.callService('media_player', service, undefined, { entity_id: target }).catch(() => haptic('failure'));
  }

  #open = (): void => {
    if (!this.item) return;
    haptic('selection');
    this.dispatchEvent(new CustomEvent('hubb-open-media', { detail: { entityId: this.item.entityId } }));
  };

  render() {
    const { hass, item } = this;
    if (!hass || !item) return nothing;
    const view = mediaView(hass, item.entityId);
    const playing = view.state === 'playing' || (!!view.spotify && hass.states[view.spotify]?.state === 'playing');
    const playPause = commandTarget(hass, view, MEDIA_FEATURE.pause) ?? commandTarget(hass, view, MEDIA_FEATURE.play);
    const next = commandTarget(hass, view, MEDIA_FEATURE.next);
    const picture = view.picture && view.picture !== this.broken ? view.picture : null;
    return html`<div class="mini">
      <button class="body" @click=${this.#open}>
        ${picture ? html`<img class="art" src=${picture} alt="" @error=${() => (this.broken = picture)} />` : html`<span class="art note">${icon(mdiMusicNote)}</span>`}
        <span class="words"><span class="title">${view.title ?? item.name}</span><span class="who">${[view.artist, item.name].filter(Boolean).join(' · ')}</span></span>
      </button>
      ${playPause
        ? html`<button class="play" aria-label=${playing ? MEDIA.pause : MEDIA.play} @click=${() => this.#call('media_play_pause', playPause)}>
            ${icon(playing ? mdiPause : mdiPlay)}
          </button>`
        : nothing}
      ${next ? html`<button class="next" aria-label=${MEDIA.next} @click=${() => this.#call('media_next_track', next)}>${icon(mdiSkipNext)}</button>` : nothing}
    </div>`;
  }

  static styles = css`
    :host {
      display: block;
    }
    .mini {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 10px 8px 8px;
      border-radius: var(--hubb-radius, 16px);
      background: var(--hubb-surface);
      box-shadow: var(--hubb-card-shadow);
      color: var(--hubb-text);
      font-family: var(--hubb-font);
    }
    button {
      all: unset;
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;
    }
    button:focus-visible {
      outline: 2px solid var(--hubb-focus);
      outline-offset: 2px;
    }
    .body {
      flex: 1;
      min-width: 0;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .art {
      flex: none;
      width: 44px;
      height: 44px;
      border-radius: 10px;
      object-fit: cover;
    }
    .note {
      display: grid;
      place-items: center;
      background: linear-gradient(135deg, #c8743f, #6a3a74);
    }
    .note svg {
      width: 20px;
      height: 20px;
      fill: rgba(255, 255, 255, 0.8);
    }
    .words {
      min-width: 0;
      display: grid;
    }
    .title,
    .who {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .title {
      font-size: 13px;
      font-weight: 700;
    }
    .who {
      font-size: 11px;
      color: var(--hubb-text-2);
    }
    .play,
    .next {
      flex: none;
      width: 40px;
      height: 40px;
      display: grid;
      place-items: center;
      border-radius: 50%;
      background: var(--hubb-surface-2);
    }
    .play {
      background: var(--hubb-primary-bg);
      color: var(--hubb-primary-ink);
    }
    .play svg,
    .next svg {
      width: 20px;
      height: 20px;
      fill: currentColor;
    }
  `;
}

define('hubb-mini-player', HubbMiniPlayer);
