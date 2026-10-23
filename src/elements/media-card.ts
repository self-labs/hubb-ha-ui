import { mdiPause, mdiPlay, mdiPower, mdiSpeaker, mdiSpeakerMultiple, mdiTelevision } from '@mdi/js';
import { LitElement, css, html, nothing } from 'lit';
import { has } from '../actions/climate';
import { haptic } from '../actions/haptic';
import { MEDIA_FEATURE, mediaLine } from '../actions/media';
import { commandTarget, groupOf, speakerMusic, speakerOf } from '../model/media';
import { displayName } from '../model/names';
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
    pairs: { attribute: false },
    broken: { state: true },
  };

  declare hass: HomeAssistant | undefined;
  declare item: MediaItem | undefined;
  /** Each speaker and its Music Assistant player (`Shared.mediaPairs`), to name who it plays with. */
  declare pairs: Readonly<Record<string, string>>;
  /** The cover that failed to load: the icon comes back until the cover changes. */
  declare broken: string | null;

  constructor() {
    super();
    this.hass = undefined;
    this.item = undefined;
    this.pairs = {};
    this.broken = null;
  }

  #call(service: string, target: string | null = this.item?.entityId ?? null): void {
    if (!this.hass || !target) return;
    haptic('light');
    this.hass.callService('media_player', service, undefined, { entity_id: target }).catch(() => haptic('failure'));
  }

  #resize: ResizeObserver | null = null;
  /** The line on screen, and the one last measured: the house updates often, the song seldom. */
  #line = '';
  #fitted: string | null = null;

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#resize?.disconnect();
    this.#resize = null;
  }

  protected updated(): void {
    if (this.#line !== this.#fitted) {
      this.#fitted = this.#line;
      this.#fit(true);
    }
    if (!this.#resize && typeof ResizeObserver !== 'undefined') {
      const box = this.renderRoot.querySelector('.state');
      if (box) (this.#resize = new ResizeObserver(() => this.#fit(false))).observe(box);
    }
  }

  /**
   * A line longer than its place scrolls to its end and back a few times, like music apps do; a short
   * one stays. `.run` is an inline block so the browser can measure it; a new song starts the rounds over.
   */
  #fit(restart: boolean): void {
    const box = this.renderRoot.querySelector<HTMLElement>('.state');
    const run = box?.querySelector<HTMLElement>('.run');
    if (!box || !run) return;
    const over = run.scrollWidth - box.clientWidth;
    box.classList.toggle('scroll', over > 0);
    if (over <= 0) return;
    run.style.setProperty('--shift', `-${over}px`);
    run.style.setProperty('--marquee', `${(4 + over / 30).toFixed(1)}s`);
    if (restart) {
      run.style.animation = 'none';
      void run.offsetWidth;
      run.style.animation = '';
    }
  }

  /** Who it plays with, said by the group mark next to the name: the speakers, never their Music Assistant players. */
  #together(hass: HomeAssistant, entityId: string): string | null {
    const { members } = groupOf(hass, entityId);
    return members.length ? MEDIA.together(members.map((m) => displayName(hass, speakerOf(this.pairs, m), null))) : null;
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
    const power = !down && (on ? has(st, MEDIA_FEATURE.turnOff) : has(st, MEDIA_FEATURE.turnOn));
    const tv = st?.attributes.device_class === 'tv' || /tv|televis/i.test(item.name);
    // The music comes from the Music Assistant player while it plays (spec Multiroom, 4.2); power stays
    // on the speaker. A member plays what its leader plays, and its play button commands the leader.
    const { source, member, view } = speakerMusic(hass, item.entityId, item.ma);
    const sourceSt = hass.states[source] ?? st;
    const playing = (member ? view.state : sourceSt?.state) === 'playing';
    // Off, a speaker may still report its last cover: the icon says it is off.
    const picture = on && view.picture && view.picture !== this.broken ? view.picture : null;
    const playPause = commandTarget(hass, view, MEDIA_FEATURE.pause) ?? commandTarget(hass, view, MEDIA_FEATURE.play);
    const together = this.#together(hass, source);
    const playable = on && (playing || (member ? view.state : sourceSt?.state) === 'paused');
    this.#line = mediaLine(view, sourceSt);
    return html`<div class="card ${on ? 'on' : ''} ${down ? 'na' : ''}">
      <button class="body" @click=${this.#open}>
        ${picture
          ? html`<img class="art" src=${picture} alt="" @error=${() => (this.broken = picture)} />`
          : html`<span class="icon">${icon(tv ? mdiTelevision : mdiSpeaker)}</span>`}
        <span class="text"
          ><span class="name"
            >${item.name}${together ? html`<span class="grouped" role="img" aria-label=${together} title=${together}>${icon(mdiSpeakerMultiple)}</span>` : nothing}${playing
              ? html`<span class="bars" aria-hidden="true"><i></i><i></i><i></i></span>`
              : nothing}</span
          ><span class="state"><span class="run">${this.#line}</span></span></span
        >
      </button>
      ${playable && playPause
        ? html`<button class="play round" aria-label=${playing ? MEDIA.pause : MEDIA.play} @click=${() => this.#call('media_play_pause', playPause)}>
            ${icon(playing ? mdiPause : mdiPlay)}
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
    .art {
      flex: none;
      width: 52px;
      height: 52px;
      border-radius: 12px;
      object-fit: cover;
      background: var(--hubb-surface-2);
    }
    .text {
      min-width: 0;
    }
    /* Three bars that dance while it plays. */
    .bars {
      display: inline-flex;
      align-items: flex-end;
      gap: 2px;
      height: 10px;
      margin-left: 6px;
    }
    .bars i {
      width: 3px;
      height: 100%;
      border-radius: 1px;
      background: var(--hubb-amber);
      transform-origin: bottom;
      animation: hubb-bars 0.9s ease-in-out infinite;
    }
    .bars i:nth-child(2) {
      animation-delay: -0.3s;
    }
    .bars i:nth-child(3) {
      animation-delay: -0.6s;
    }
    @keyframes hubb-bars {
      0%,
      100% {
        transform: scaleY(0.3);
      }
      50% {
        transform: scaleY(1);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .bars i {
        animation: none;
        transform: scaleY(0.6);
      }
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
    .state .run {
      display: inline-block;
      max-width: 100%;
      overflow: hidden;
      vertical-align: top;
      text-overflow: ellipsis;
    }
    .state.scroll .run {
      max-width: none;
      overflow: visible;
      animation: hubb-marquee var(--marquee, 8s) ease-in-out 6 alternate;
    }
    @keyframes hubb-marquee {
      0%,
      20% {
        transform: translateX(0);
      }
      80%,
      100% {
        transform: translateX(var(--shift, 0));
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .state.scroll .run {
        animation: none;
        max-width: 100%;
        overflow: hidden;
      }
    }
    .grouped {
      display: inline-grid;
      place-items: center;
      margin-left: 6px;
      vertical-align: -2px;
      color: var(--hubb-amber-text);
    }
    .grouped svg {
      width: 14px;
      height: 14px;
      fill: currentColor;
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
