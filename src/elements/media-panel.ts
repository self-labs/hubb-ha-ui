import {
  mdiMinus,
  mdiPause,
  mdiPlay,
  mdiPlus,
  mdiPower,
  mdiRepeat,
  mdiRepeatOff,
  mdiRepeatOnce,
  mdiShuffle,
  mdiShuffleDisabled,
  mdiSkipNext,
  mdiSkipPrevious,
  mdiVolumeHigh,
  mdiVolumeOff,
} from '@mdi/js';
import { LitElement, css, html, nothing, type TemplateResult } from 'lit';
import { has } from '../actions/climate';
import { haptic } from '../actions/haptic';
import { MEDIA_FEATURE, channelWord, mediaLine } from '../actions/media';
import { stepVolume, volumeTarget } from '../actions/volume';
import { channelSelect, commandTarget, groupOf, mediaView, type MediaView } from '../model/media';
import { isInfrared } from '../ha/infrared';
import type { HassEntityState, HomeAssistant } from '../ha/types';
import { MEDIA, S } from '../strings';
import { define } from './define';
import { icon } from './icon';
import './media-group';
import './media-progress';
import { unlisted } from './unlisted';

const NEXT_REPEAT: Readonly<Record<string, string>> = { off: 'all', all: 'one', one: 'off' };

/**
 * The sheet of a TV or a speaker: cover, progress, the controls in five fixed places, volume, source,
 * sound mode, channel and power. Each part shows only when the player, or the Spotify on it, has it.
 */
export class HubbMediaPanel extends LitElement {
  static properties = {
    hass: { attribute: false },
    entityId: { attribute: false },
    visible: { attribute: false },
    broken: { state: true },
  };

  declare hass: HomeAssistant | undefined;
  declare entityId: string;
  /** The media players the resident sees in the house, offered to play together with. */
  declare visible: readonly string[];
  /** A cover that failed to load: left out until the cover changes. */
  declare broken: string | null;

  constructor() {
    super();
    this.hass = undefined;
    this.entityId = '';
    this.visible = [];
    this.broken = null;
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this.hass && this.entityId) volumeTarget(this.hass, this.entityId).dispose();
  }

  #call(service: string, data?: Record<string, unknown>, target: string | null = this.entityId, domain = 'media_player'): void {
    if (!target) return;
    haptic('light');
    this.hass?.callService(domain, service, data, { entity_id: target }).catch(() => haptic('failure'));
  }

  render() {
    const hass = this.hass;
    const st = hass?.states[this.entityId];
    if (!hass || !st) return nothing;
    if (st.state === 'unavailable') return html`<p class="now">${S.noResponse}</p>`;
    // A member plays what its leader plays: the music, the repeat and the tracks are the leader's,
    // whose copy on the member goes stale (seen on WiiM). Volume, channel and power stay its own.
    const { leader } = groupOf(hass, this.entityId);
    const member = leader !== null && leader !== this.entityId;
    const view = mediaView(hass, member ? leader : this.entityId);
    const on = !['off', 'standby', 'unknown'].includes(st.state);
    const power = on ? has(st, MEDIA_FEATURE.turnOff) : has(st, MEDIA_FEATURE.turnOn);
    const music = on && view.title !== null;
    return html`${music ? this.#music(view) : html`<p class="now">${mediaLine(view, st)}</p>`}
      ${isInfrared(hass, this.entityId) ? html`<p class="infrared">${S.infrared}</p>` : nothing}
      ${on ? this.#controls(hass, st, view, member) : nothing}
      ${power
        ? html`<button class="power ${on ? '' : 'primary'}" @click=${() => this.#call(on ? 'turn_off' : 'turn_on')}>
            ${icon(mdiPower)} ${on ? MEDIA.turnOff : MEDIA.turnOn}
          </button>`
        : nothing}`;
  }

  /** The cover, large, then the title, and the artist with the album. */
  #music(view: MediaView) {
    const picture = view.picture && view.picture !== this.broken ? view.picture : null;
    const sub = [view.artist, view.album].filter(Boolean).join(' · ');
    return html`<div class="music">
      ${picture ? html`<img class="cover" src=${picture} alt="" @error=${() => (this.broken = picture)} />` : nothing}
      <p class="title">${view.title}</p>
      ${sub ? html`<p class="artist">${sub}</p>` : nothing}
    </div>`;
  }

  /**
   * − or +: with a level the taps add up on a target; a player with steps only, or one that does not
   * say its level, gets one step of its own per tap.
   */
  #step(direction: 1 | -1, level: number | null, canSet: boolean): void {
    if (!canSet) return this.#call(direction > 0 ? 'volume_up' : 'volume_down');
    haptic('light');
    stepVolume(this.hass!, this.entityId, level, direction);
    this.requestUpdate();
  }

  /** What a player that is on offers: progress, the controls, the volume, source, sound mode and channel. */
  #controls(hass: HomeAssistant, st: HassEntityState, view: MediaView, member: boolean) {
    const a = st.attributes;
    const target = (feature: number): string | null => commandTarget(hass, view, feature);
    const level = typeof a.volume_level === 'number' ? a.volume_level : null;
    const canSet = has(st, MEDIA_FEATURE.volumeSet);
    const shown = canSet ? volumeTarget(hass, this.entityId).shown(level) : level;
    const muted = a.is_volume_muted === true;
    const sources = Array.isArray(a.source_list) ? a.source_list.filter((s): s is string => typeof s === 'string') : [];
    const modes = Array.isArray(a.sound_mode_list) ? a.sound_mode_list.filter((s): s is string => typeof s === 'string') : [];
    const channel = channelSelect(hass, this.entityId);
    // A member shows the leader's play state, since its play button commands the leader.
    const playing = (member ? view.state : st.state) === 'playing';
    const repeat = view.repeat ?? 'off';
    const seek = target(MEDIA_FEATURE.seek);
    const slot = (t: string | null, make: (t: string) => TemplateResult) => html`<span class="slot">${t ? make(t) : nothing}</span>`;
    return html`${view.duration && view.position !== null && view.positionAt !== null
        ? html`<hubb-media-progress
            .duration=${view.duration}
            .position=${view.position}
            .positionAt=${view.positionAt}
            .playing=${playing}
            .seekable=${seek !== null}
            @hubb-seek=${(e: CustomEvent<{ position: number }>) => this.#call('media_seek', { seek_position: e.detail.position }, seek)}
          ></hubb-media-progress>`
        : nothing}
      <div class="controls">
        ${slot(
          target(MEDIA_FEATURE.repeat),
          (t) =>
            html`<button
              class="round repeat ${repeat !== 'off' ? 'on' : ''}"
              aria-label=${MEDIA.repeatMode(repeat)}
              @click=${() => this.#call('repeat_set', { repeat: NEXT_REPEAT[repeat] ?? 'off' }, t)}
            >
              ${icon(repeat === 'one' ? mdiRepeatOnce : repeat === 'all' ? mdiRepeat : mdiRepeatOff)}
            </button>`,
        )}
        ${slot(
          target(MEDIA_FEATURE.previous),
          (t) =>
            html`<button class="round previous" aria-label=${MEDIA.previous} @click=${() => this.#call('media_previous_track', undefined, t)}>
              ${icon(mdiSkipPrevious)}
            </button>`,
        )}
        ${slot(
          target(MEDIA_FEATURE.pause) ?? target(MEDIA_FEATURE.play),
          (t) =>
            html`<button class="round big play" aria-label=${playing ? MEDIA.pause : MEDIA.play} @click=${() => this.#call('media_play_pause', undefined, t)}>
              ${icon(playing ? mdiPause : mdiPlay)}
            </button>`,
        )}
        ${slot(
          target(MEDIA_FEATURE.next),
          (t) => html`<button class="round next" aria-label=${MEDIA.next} @click=${() => this.#call('media_next_track', undefined, t)}>${icon(mdiSkipNext)}</button>`,
        )}
        ${slot(
          target(MEDIA_FEATURE.shuffle),
          (t) =>
            html`<button
              class="round shuffle ${view.shuffle ? 'on' : ''}"
              aria-label=${MEDIA.shuffle}
              aria-pressed=${view.shuffle ? 'true' : 'false'}
              @click=${() => this.#call('shuffle_set', { shuffle: !view.shuffle }, t)}
            >
              ${icon(view.shuffle ? mdiShuffle : mdiShuffleDisabled)}
            </button>`,
        )}
      </div>
      ${canSet || has(st, MEDIA_FEATURE.volumeStep)
        ? html`<p class="label">${MEDIA.volume}</p>
            <div class="volume-row">
              <button class="round quieter" aria-label=${MEDIA.quieter} @click=${() => this.#step(-1, level, canSet)}>${icon(mdiMinus)}</button>
              <span class="volume">${shown !== null ? `${Math.round(shown * 100)}%` : ''}</span>
              <button class="round louder" aria-label=${MEDIA.louder} @click=${() => this.#step(1, level, canSet)}>${icon(mdiPlus)}</button>
              ${has(st, MEDIA_FEATURE.mute)
                ? html`<button class="round mute" aria-label=${muted ? MEDIA.unmute : MEDIA.mute} aria-pressed=${muted ? 'true' : 'false'} @click=${() => this.#call('volume_mute', { is_volume_muted: !muted })}>
                    ${icon(muted ? mdiVolumeOff : mdiVolumeHigh)}
                  </button>`
                : nothing}
            </div>
            ${canSet && shown !== null
              ? // A level nobody reported has no place on the bar: it would show the music at zero.
                html`<input
                  class="volume-bar"
                  type="range"
                  min="0"
                  max="100"
                  .value=${String(Math.round(shown * 100))}
                  aria-label=${MEDIA.volume}
                  @change=${(e: Event) => {
                    volumeTarget(hass, this.entityId).set(Number((e.target as HTMLInputElement).value) / 100);
                    this.requestUpdate();
                  }}
                />`
              : nothing}`
        : nothing}
      ${!member && has(st, MEDIA_FEATURE.source) && sources.length
        ? html`<label class="field">
            <span>${MEDIA.source}</span>
            <select class="source" @change=${(e: Event) => this.#call('select_source', { source: (e.target as HTMLSelectElement).value })}>
              ${unlisted(a.source, sources, (s) => s)}
              ${sources.map((s) => html`<option value=${s} ?selected=${s === a.source}>${s}</option>`)}
            </select>
          </label>`
        : nothing}
      ${has(st, MEDIA_FEATURE.soundMode) && modes.length > 1
        ? html`<label class="field">
            <span>${MEDIA.soundMode}</span>
            <select class="sound-mode" @change=${(e: Event) => this.#call('select_sound_mode', { sound_mode: (e.target as HTMLSelectElement).value })}>
              ${unlisted(a.sound_mode, modes, (m) => m)}
              ${modes.map((m) => html`<option value=${m} ?selected=${m === a.sound_mode}>${m}</option>`)}
            </select>
          </label>`
        : nothing}
      ${channel ? this.#channelField(hass, channel) : nothing}
      ${has(st, MEDIA_FEATURE.grouping)
        ? html`<hubb-media-group .hass=${hass} .entityId=${this.entityId} .visible=${this.visible}></hubb-media-group>`
        : nothing}`;
  }

  /** Stereo, left or right: the speaker's own select, shown with the words the house uses. */
  #channelField(hass: HomeAssistant, channel: string) {
    const st = hass.states[channel]!;
    const options = Array.isArray(st.attributes.options) ? st.attributes.options.filter((o): o is string => typeof o === 'string') : [];
    return html`<label class="field">
      <span>${MEDIA.channel}</span>
      <select class="channel" @change=${(e: Event) => this.#call('select_option', { option: (e.target as HTMLSelectElement).value }, channel, 'select')}>
        ${unlisted(st.state, options, channelWord)}
        ${options.map((o) => html`<option value=${o} ?selected=${o === st.state}>${channelWord(o)}</option>`)}
      </select>
    </label>`;
  }

  static styles = css`
    :host {
      display: block;
      font-family: var(--hubb-font);
      color: var(--hubb-text);
    }
    .music {
      display: grid;
      justify-items: center;
      gap: 4px;
      margin-bottom: 6px;
      text-align: center;
    }
    .cover {
      width: min(180px, 50vw);
      aspect-ratio: 1;
      object-fit: cover;
      border-radius: 16px;
      margin-bottom: 10px;
      background: var(--hubb-surface-2);
    }
    .title {
      margin: 0;
      font-size: 18px;
      font-weight: 800;
    }
    .artist {
      margin: 0;
      font-size: 13px;
      font-weight: 600;
      color: var(--hubb-text-2);
    }
    .now {
      margin: 4px 2px 14px;
      font-size: 18px;
      font-weight: 800;
    }
    .infrared {
      margin: 0 0 14px;
      padding: 10px 12px;
      border-radius: 12px;
      background: var(--hubb-surface);
      font-size: 12px;
      font-weight: 600;
      color: var(--hubb-text-2);
    }
    hubb-media-progress {
      margin: 4px 2px 6px;
    }
    .label,
    .field span {
      margin: 16px 2px 8px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--hubb-text-2);
    }
    .field {
      display: grid;
    }
    /* Five fixed places: a control the player lacks leaves its place empty, so the others never shift. */
    .controls {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
      margin-top: 8px;
    }
    .slot {
      width: 60px;
      display: grid;
      place-items: center;
    }
    .volume-row {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
    }
    .volume-bar {
      box-sizing: border-box;
      width: 100%;
      margin: 12px 0 0;
      accent-color: var(--hubb-amber);
    }
    .round {
      all: unset;
      width: 48px;
      height: 48px;
      display: grid;
      place-items: center;
      border-radius: 50%;
      background: var(--hubb-surface-2);
      cursor: pointer;
    }
    .round.big {
      width: 60px;
      height: 60px;
      background: var(--hubb-primary-bg);
      color: var(--hubb-primary-ink);
    }
    .round.on {
      color: var(--hubb-amber-text);
    }
    .round svg {
      width: 24px;
      height: 24px;
      fill: currentColor;
    }
    .volume {
      min-width: 4ch;
      text-align: center;
      font-weight: 800;
      font-size: 16px;
      font-variant-numeric: tabular-nums;
    }
    select {
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
    .round:focus-visible,
    select:focus-visible,
    .volume-bar:focus-visible {
      outline: 2px solid var(--hubb-focus);
      outline-offset: 2px;
    }
    .power {
      all: unset;
      box-sizing: border-box;
      width: 100%;
      min-height: 48px;
      margin-top: 18px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      border-radius: 12px;
      background: var(--hubb-surface-2);
      font-size: 14px;
      font-weight: 700;
      cursor: pointer;
    }
    .power.primary {
      background: var(--hubb-primary-bg);
      color: var(--hubb-primary-ink);
    }
    .power svg {
      width: 20px;
      height: 20px;
      fill: currentColor;
    }
    .power:focus-visible {
      outline: 2px solid var(--hubb-focus);
      outline-offset: 2px;
    }
  `;
}

define('hubb-media-panel', HubbMediaPanel);
