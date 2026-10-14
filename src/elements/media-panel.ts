import { mdiMinus, mdiPause, mdiPlay, mdiPlus, mdiPower, mdiSkipNext, mdiSkipPrevious, mdiVolumeHigh, mdiVolumeOff } from '@mdi/js';
import { LitElement, css, html, nothing } from 'lit';
import { has } from '../actions/climate';
import { haptic } from '../actions/haptic';
import { MEDIA_FEATURE, mediaLine } from '../actions/media';
import { isInfrared } from '../ha/infrared';
import type { HassEntityState, HomeAssistant } from '../ha/types';
import { MEDIA, S } from '../strings';
import { define } from './define';
import { icon } from './icon';

/** One step of − or + on the volume. */
const VOLUME_STEP = 0.05;

/** The sheet of a TV or a speaker: play, previous and next, volume and mute, and the source. */
export class HubbMediaPanel extends LitElement {
  static properties = {
    hass: { attribute: false },
    entityId: { attribute: false },
  };

  declare hass: HomeAssistant | undefined;
  declare entityId: string;

  constructor() {
    super();
    this.hass = undefined;
    this.entityId = '';
  }

  #call(service: string, data?: Record<string, unknown>): void {
    haptic('light');
    this.hass?.callService('media_player', service, data, { entity_id: this.entityId }).catch(() => haptic('failure'));
  }

  #volume(direction: 1 | -1, level: number, canSet: boolean): void {
    if (canSet) {
      const next = Math.round(Math.min(1, Math.max(0, level + direction * VOLUME_STEP)) * 100) / 100;
      this.#call('volume_set', { volume_level: next });
    } else this.#call(direction > 0 ? 'volume_up' : 'volume_down');
  }

  render() {
    const st = this.hass?.states[this.entityId];
    if (!st) return nothing;
    if (st.state === 'unavailable') return html`<p class="now">${S.noResponse}</p>`;
    const a = st.attributes;
    const level = typeof a.volume_level === 'number' ? a.volume_level : null;
    const canSet = has(st, MEDIA_FEATURE.volumeSet);
    const volume = canSet || has(st, MEDIA_FEATURE.volumeStep);
    const muted = a.is_volume_muted === true;
    const sources = Array.isArray(a.source_list) ? a.source_list.filter((s): s is string => typeof s === 'string') : [];
    const playing = st.state === 'playing';
    const on = !['off', 'standby', 'unknown'].includes(st.state);
    const power = on ? has(st, MEDIA_FEATURE.turnOff) : has(st, MEDIA_FEATURE.turnOn);
    return html`<p class="now">${mediaLine(st)}</p>
      ${isInfrared(this.hass!, this.entityId) ? html`<p class="infrared">${S.infrared}</p>` : nothing}
      ${on ? this.#controls(st, { level, canSet, volume, muted, sources, playing }) : nothing}
      ${power
        ? html`<button class="power ${on ? '' : 'primary'}" @click=${() => this.#call(on ? 'turn_off' : 'turn_on')}>
            ${icon(mdiPower)} ${on ? MEDIA.turnOff : MEDIA.turnOn}
          </button>`
        : nothing}`;
  }

  /** What a player that is on offers: play, the tracks, the volume and the source. */
  #controls(
    st: HassEntityState,
    v: { level: number | null; canSet: boolean; volume: boolean; muted: boolean; sources: string[]; playing: boolean },
  ) {
    const { level, canSet, volume, muted, sources, playing } = v;
    const a = st.attributes;
    return html`<div class="row center">
        ${has(st, MEDIA_FEATURE.previous)
          ? html`<button class="round previous" aria-label=${MEDIA.previous} @click=${() => this.#call('media_previous_track')}>${icon(mdiSkipPrevious)}</button>`
          : nothing}
        ${has(st, MEDIA_FEATURE.play) || has(st, MEDIA_FEATURE.pause)
          ? html`<button class="round big play" aria-label=${playing ? MEDIA.pause : MEDIA.play} @click=${() => this.#call('media_play_pause')}>
              ${icon(playing ? mdiPause : mdiPlay)}
            </button>`
          : nothing}
        ${has(st, MEDIA_FEATURE.next)
          ? html`<button class="round next" aria-label=${MEDIA.next} @click=${() => this.#call('media_next_track')}>${icon(mdiSkipNext)}</button>`
          : nothing}
      </div>
      ${volume
        ? html`<p class="label">${MEDIA.volume}</p>
            <div class="row">
              <button class="round quieter" aria-label=${MEDIA.quieter} @click=${() => this.#volume(-1, level ?? 0, canSet)}>${icon(mdiMinus)}</button>
              <span class="volume">${level !== null ? `${Math.round(level * 100)}%` : ''}</span>
              <button class="round louder" aria-label=${MEDIA.louder} @click=${() => this.#volume(1, level ?? 0, canSet)}>${icon(mdiPlus)}</button>
              ${has(st, MEDIA_FEATURE.mute)
                ? html`<button class="round mute" aria-label=${muted ? MEDIA.unmute : MEDIA.mute} aria-pressed=${muted ? 'true' : 'false'} @click=${() => this.#call('volume_mute', { is_volume_muted: !muted })}>
                    ${icon(muted ? mdiVolumeOff : mdiVolumeHigh)}
                  </button>`
                : nothing}
            </div>`
        : nothing}
      ${has(st, MEDIA_FEATURE.source) && sources.length
        ? html`<label class="field">
            <span>${MEDIA.source}</span>
            <select class="source" @change=${(e: Event) => this.#call('select_source', { source: (e.target as HTMLSelectElement).value })}>
              ${sources.map((s) => html`<option value=${s} ?selected=${s === a.source}>${s}</option>`)}
            </select>
          </label>`
        : nothing}`;
  }

  static styles = css`
    :host {
      display: block;
      font-family: var(--hubb-font);
      color: var(--hubb-text);
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
    .row {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .row.center {
      justify-content: center;
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
    select:focus-visible {
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
