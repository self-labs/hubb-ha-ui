import { mdiPause, mdiPlay, mdiPower, mdiSpeaker, mdiTelevision } from '@mdi/js';
import { LitElement, css, html, nothing } from 'lit';
import { has } from '../actions/climate';
import { haptic } from '../actions/haptic';
import { MEDIA_FEATURE, mediaLine } from '../actions/media';
import type { HomeAssistant } from '../ha/types';
import type { MediaItem } from '../model/types';
import { MEDIA } from '../strings';
import { define } from './define';
import { icon } from './icon';

/** A TV or a speaker on its room page: what it plays, play and pause, and power. A tap opens its sheet. */
export class HubbMediaCard extends LitElement {
  static properties = {
    hass: { attribute: false },
    item: { attribute: false },
  };

  declare hass: HomeAssistant | undefined;
  declare item: MediaItem | undefined;

  constructor() {
    super();
    this.hass = undefined;
    this.item = undefined;
  }

  #call(service: string): void {
    if (!this.hass || !this.item) return;
    haptic('light');
    this.hass.callService('media_player', service, undefined, { entity_id: this.item.entityId }).catch(() => haptic('failure'));
  }

  #open = (): void => {
    if (!this.item) return;
    haptic('selection');
    this.dispatchEvent(new CustomEvent('hubb-open-media', { detail: { entityId: this.item.entityId }, bubbles: true, composed: true }));
  };

  render() {
    const { hass, item } = this;
    if (!hass || !item) return nothing;
    const st = hass.states[item.entityId];
    const down = !st || st.state === 'unavailable';
    const on = !!st && !down && !['off', 'standby', 'unknown'].includes(st.state);
    const playable = on && (st.state === 'playing' || st.state === 'paused') && (has(st, MEDIA_FEATURE.play) || has(st, MEDIA_FEATURE.pause));
    const power = !down && (on ? has(st, MEDIA_FEATURE.turnOff) : has(st, MEDIA_FEATURE.turnOn));
    const tv = st?.attributes.device_class === 'tv' || /tv|televis/i.test(item.name);
    return html`<div class="card ${on ? 'on' : ''} ${down ? 'na' : ''}">
      <button class="body" @click=${this.#open}>
        <span class="icon">${icon(tv ? mdiTelevision : mdiSpeaker)}</span>
        <span class="text"><span class="name">${item.name}</span><span class="state">${mediaLine(st)}</span></span>
      </button>
      ${playable
        ? html`<button class="play round" aria-label=${st!.state === 'playing' ? MEDIA.pause : MEDIA.play} @click=${() => this.#call('media_play_pause')}>
            ${icon(st!.state === 'playing' ? mdiPause : mdiPlay)}
          </button>`
        : nothing}
      ${power
        ? html`<button class="power round" aria-label=${MEDIA.power} aria-pressed=${on ? 'true' : 'false'} @click=${() => this.#call(on ? 'turn_off' : 'turn_on')}>
            ${icon(mdiPower)}
          </button>`
        : nothing}
    </div>`;
  }

  static styles = css`
    :host {
      display: block;
    }
    .card {
      box-sizing: border-box;
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 8px 6px 4px;
      border-radius: var(--hubb-radius, 16px);
      background: var(--hubb-surface);
      box-shadow: var(--hubb-card-shadow);
      color: var(--hubb-text);
      font-family: var(--hubb-font);
    }
    .card.on {
      background: radial-gradient(110% 80% at 15% 0%, var(--hubb-amber-tint), transparent 65%), var(--hubb-on-bg);
    }
    .card.na {
      background: transparent;
      border: 1.5px dashed color-mix(in srgb, var(--hubb-text-2) 55%, transparent);
    }
    .body {
      all: unset;
      box-sizing: border-box;
      flex: 1;
      min-width: 0;
      min-height: 60px;
      padding: 6px 8px;
      display: flex;
      align-items: center;
      gap: 10px;
      border-radius: 12px;
      cursor: pointer;
    }
    .icon {
      flex: none;
      width: 36px;
      height: 36px;
      border-radius: 12px;
      display: grid;
      place-items: center;
      background: var(--hubb-surface-2);
      color: var(--hubb-text-2);
    }
    .card.on .icon {
      background: var(--hubb-amber);
      color: var(--hubb-amber-ink);
    }
    .icon svg,
    .round svg {
      width: 22px;
      height: 22px;
      fill: currentColor;
    }
    .text {
      min-width: 0;
    }
    .name {
      display: block;
      font-weight: 700;
      font-size: 14px;
    }
    .state {
      display: block;
      margin-top: 2px;
      font-weight: 600;
      font-size: 12px;
      color: var(--hubb-text-2);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .card.on .state {
      color: var(--hubb-amber-text);
    }
    .round {
      all: unset;
      flex: none;
      width: 44px;
      height: 44px;
      display: grid;
      place-items: center;
      border-radius: 50%;
      background: var(--hubb-surface-2);
      color: var(--hubb-text-2);
      cursor: pointer;
    }
    .card.on .power {
      background: var(--hubb-amber);
      color: var(--hubb-amber-ink);
    }
    .body:focus-visible,
    .round:focus-visible {
      outline: 2px solid var(--hubb-focus);
      outline-offset: 2px;
    }
  `;
}

define('hubb-media-card', HubbMediaCard);
