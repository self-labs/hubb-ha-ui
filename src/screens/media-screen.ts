import { mdiPause } from '@mdi/js';
import { css, html, nothing } from 'lit';
import { haptic } from '../actions/haptic';
import { define } from '../elements/define';
import { icon } from '../elements/icon';
import '../elements/media-card';
import '../elements/media-panel';
import '../elements/nav-bar';
import '../elements/sheet';
import type { HomeAssistant } from '../ha/types';
import { MEDIA_FEATURE } from '../actions/media';
import { isInfrared } from '../ha/infrared';
import { commandTarget, speakerMusic, viewPlaying } from '../model/media';
import { displayName } from '../model/names';
import type { HubbConfig, MediaItem, Shared } from '../model/types';
import { MEDIA, S } from '../strings';
import { layoutStyles } from '../theme/layout';
import { tokens } from '../theme/tokens';
import { HubbScreen } from './base';

/** A room with sound, as the Mídia tab lists it. */
export interface MediaRoom {
  areaId: string;
  name: string;
  media: MediaItem[];
}

export interface MediaScreenConfig {
  type: string;
  rooms: MediaRoom[];
  /** Name of the first tab of the bottom bar; "Casa" when missing. */
  homeLabel?: string;
  shared?: Shared;
  options?: HubbConfig;
}

/**
 * The Mídia tab: every speaker of the house in one place, room by room, with how many play and
 * Pausar tudo. A house with several zones does not make the resident remember where each one is
 * (Gustavo, 22/10). A tap on a speaker opens its sheet right here.
 */
export class HubbMediaScreen extends HubbScreen {
  static properties = { config: { attribute: false }, mediaId: { state: true } };

  static keptSheets = ['mediaId'];

  declare config: MediaScreenConfig | undefined;
  /** The speaker whose sheet is open; null with none. */
  declare mediaId: string | null;

  constructor() {
    super();
    this.config = undefined;
    this.mediaId = null;
  }

  setConfig(config: MediaScreenConfig): void {
    if (!config || !Array.isArray(config.rooms)) throw new Error('hubb-media-screen: missing rooms');
    this.config = config;
  }

  protected scope(): string[] {
    return [];
  }

  /**
   * How many speakers play, as their cards show it (the Spotify on a TV, a member through its leader),
   * and the players that pause them, each once. An infrared TV is left out: its state is the last
   * command sent, and pausing it would send one more.
   */
  #playing(hass: HomeAssistant, items: readonly MediaItem[]): { count: number; targets: string[] } {
    const targets = new Set<string>();
    let count = 0;
    for (const m of items) {
      if (isInfrared(hass, m.entityId)) continue;
      const { view } = speakerMusic(hass, m.entityId, m.ma);
      if (!viewPlaying(hass, view)) continue;
      count++;
      const target = commandTarget(hass, view, MEDIA_FEATURE.pause);
      if (target) targets.add(target);
    }
    return { count, targets: [...targets] };
  }

  #pauseAll(hass: HomeAssistant, ids: readonly string[]): void {
    haptic('light');
    for (const id of ids) hass.callService('media_player', 'media_pause', undefined, { entity_id: id }).catch(() => haptic('failure'));
  }

  render() {
    const hass = this.hass;
    const rooms = this.config?.rooms;
    if (!hass || !rooms) return nothing;
    const shared = this.config?.shared;
    const playing = this.#playing(hass, rooms.flatMap((r) => r.media));
    return html`${this.strips(shared)}<main>
        <div class="title"><h1>${S.media}</h1></div>
        <div class="summary">
          <span class="status">${playing.count ? MEDIA.playingCount(playing.count) : MEDIA.nothingPlaying}</span>
          ${playing.targets.length
            ? html`<button class="pause-all" @click=${() => this.#pauseAll(hass, playing.targets)}>${icon(mdiPause)}<span>${MEDIA.pauseAll}</span></button>`
            : nothing}
        </div>
        ${rooms.map(
          (room) => html`<section class="room">
            <h2>${room.name}</h2>
            <div class="list" @hubb-open-media=${(e: CustomEvent<{ entityId: string }>) => (this.mediaId = e.detail.entityId)}>
              ${room.media.map((item) => html`<hubb-media-card .hass=${hass} .item=${item} .pairs=${shared?.mediaPairs ?? {}}></hubb-media-card>`)}
            </div>
          </section>`,
        )}
      </main>
      <hubb-sheet
        class="media"
        ?open=${this.mediaId !== null}
        heading=${this.mediaId ? displayName(hass, this.mediaId, null) : ''}
        @hubb-close=${() => (this.mediaId = null)}
      >
        ${this.mediaId
          ? html`<hubb-media-panel .hass=${hass} .entityId=${this.mediaId} .visible=${shared?.media ?? []} .pairs=${shared?.mediaPairs ?? {}}></hubb-media-panel>`
          : nothing}
      </hubb-sheet>
      <hubb-toast></hubb-toast>
      <hubb-nav-bar
        current="midia"
        home-label=${this.config?.homeLabel ?? S.home}
        .homeIcon=${this.homeIcon()}
        ?security=${shared?.security ?? false}
        .scenes=${shared?.scenes ?? true}
        .media=${shared?.mediaTab ?? false}
      ></hubb-nav-bar>${this.restLayer()}`;
  }

  static styles = [
    tokens,
    HubbScreen.baseStyles,
    layoutStyles,
    css`
      h1 {
        margin: 6px 2px 8px;
        font-size: 22px;
        font-weight: 800;
      }
      .summary {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        min-height: 44px;
        margin: 0 2px 8px;
      }
      .status {
        font-size: 14px;
        font-weight: 700;
        color: var(--hubb-text-2);
      }
      .pause-all {
        all: unset;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        min-height: 44px;
        padding: 0 14px;
        border-radius: 22px;
        background: var(--hubb-surface-2);
        font-size: 14px;
        font-weight: 700;
        cursor: pointer;
      }
      .pause-all svg {
        width: 20px;
        height: 20px;
        fill: currentColor;
      }
      .pause-all:focus-visible {
        outline: 2px solid var(--hubb-focus);
        outline-offset: 2px;
      }
      h2 {
        margin: 18px 2px 8px;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--hubb-text-2);
      }
      .list {
        display: grid;
        gap: 8px;
      }
    `,
  ];
}

define('hubb-media-screen', HubbMediaScreen);
