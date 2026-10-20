import { mdiMinus, mdiPlus } from '@mdi/js';
import { LitElement, css, html, nothing } from 'lit';
import { haptic } from '../actions/haptic';
import { channelWord } from '../actions/media';
import { PendingTracker } from '../actions/pending';
import { volumeTarget } from '../actions/volume';
import type { HomeAssistant } from '../ha/types';
import { channelSelect, groupCandidates, groupOf } from '../model/media';
import { displayName } from '../model/names';
import { MEDIA } from '../strings';
import { define } from './define';
import { icon } from './icon';

/** How long a switch holds what was asked before it follows Home Assistant again. */
const PENDING_MS = 5000;

/**
 * Tocar junto: the other speakers the resident sees, of the same integration, each with a switch.
 * Home Assistant groups them (`join` on this speaker, `unjoin` on the other); a member of someone
 * else's group can only leave it. The leader also turns every speaker of the group up or down.
 */
export class HubbMediaGroup extends LitElement {
  static properties = {
    hass: { attribute: false },
    entityId: { attribute: false },
    visible: { attribute: false },
  };

  declare hass: HomeAssistant | undefined;
  declare entityId: string;
  /** The media players the resident sees in the house (`Shared.media`). */
  declare visible: readonly string[];

  // No second state: the 5 s are over, the switch shows what Home Assistant says.
  #pending = new PendingTracker(PENDING_MS, 0);
  /** The speakers this group stepped, whose waiting level leaves when the sheet closes. */
  #stepped = new Set<string>();
  #wake: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    super();
    this.hass = undefined;
    this.entityId = '';
    this.visible = [];
  }

  connectedCallback(): void {
    super.connectedCallback();
    // Back on screen (a view switch with the sheet open): a waiting switch gets its wake-up again.
    if (this.hasUpdated) this.requestUpdate();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this.hass) for (const id of this.#stepped) volumeTarget(this.hass, id).dispose();
    this.#stepped.clear();
    if (this.#wake) clearTimeout(this.#wake);
    this.#wake = null;
  }

  #call(service: string, target: string, data?: Record<string, unknown>, domain = 'media_player'): void {
    haptic('light');
    this.hass?.callService(domain, service, data, { entity_id: target }).catch(() => haptic('failure'));
  }

  #setChannel(speakerId: string, option: string): void {
    const select = this.hass ? channelSelect(this.hass, speakerId) : null;
    if (select) this.#call('select_option', select, { option }, 'select');
  }

  /** A speaker alone on one side plays half the music: whoever ends up alone goes back to stereo. */
  #backToStereo(speakerId: string): void {
    const select = this.hass ? channelSelect(this.hass, speakerId) : null;
    const st = select ? this.hass!.states[select] : undefined;
    const options = st?.attributes.options;
    if (st && st.state !== 'Stereo' && Array.isArray(options) && options.includes('Stereo')) this.#setChannel(speakerId, 'Stereo');
  }

  /**
   * `speakerId` leaves the group `leader` leads. Once Home Assistant takes the unjoin, it goes back to
   * stereo, and so does the leader when nobody else stays: the speakers already leaving (a switch
   * waiting on Home Assistant) do not count, since `group_members` still lists them.
   */
  #leave(speakerId: string, leader: string): void {
    const hass = this.hass;
    if (!hass) return;
    const staying = groupOf(hass, leader).members.filter((m) => m !== speakerId && this.#pending.expected(m) !== 'off');
    haptic('light');
    hass
      .callService('media_player', 'unjoin', undefined, { entity_id: speakerId })
      .then(() => {
        this.#backToStereo(speakerId);
        if (!staying.length) this.#backToStereo(leader);
      })
      .catch(() => haptic('failure'));
  }

  #toggle(id: string, joined: boolean): void {
    this.#pending.start(id, joined ? 'off' : 'on');
    if (joined) this.#leave(id, this.entityId);
    else this.#call('join', this.entityId, { group_members: [id] });
    this.requestUpdate();
  }

  /** One step for every speaker of the group, each from its own volume. */
  #stepAll(ids: readonly string[], direction: 1 | -1): void {
    const hass = this.hass;
    if (!hass) return;
    haptic('light');
    for (const id of ids) {
      const level = hass.states[id]?.attributes.volume_level;
      volumeTarget(hass, id).step(typeof level === 'number' ? level : null, direction);
      this.#stepped.add(id);
    }
  }

  protected updated(): void {
    // A switch waiting on Home Assistant goes back to what it shows once its 5 s are over.
    if (this.#wake) clearTimeout(this.#wake);
    this.#wake = null;
    const waits = this.visible.map((id) => this.#pending.msUntilChange(id)).filter((ms): ms is number => ms !== null);
    if (waits.length) this.#wake = setTimeout(() => this.requestUpdate(), Math.min(...waits) + 1);
  }

  render() {
    const hass = this.hass;
    if (!hass?.states[this.entityId]) return nothing;
    const { leader, members } = groupOf(hass, this.entityId);
    if (leader !== null && leader !== this.entityId) {
      return html`<p class="label">${MEDIA.playTogether}</p>
        <p class="part">${MEDIA.partOf(displayName(hass, leader, null))}</p>
        <button class="leave" @click=${() => this.#leave(this.entityId, leader)}>${MEDIA.leaveGroup}</button>`;
    }
    const candidates = groupCandidates(hass, this.entityId, this.visible);
    // A leader keeps the section for its group even when the resident sees none of the others.
    if (!candidates.length && !members.length) return nothing;
    const group = [this.entityId, ...members];
    const settled = members.every((m) => this.#pending.expected(m) === null);
    const pair = members.length === 1 && settled && candidates.some((c) => c.entityId === members[0]) ? this.#pairOf(hass, members[0]!) : null;
    return html`<p class="label">${MEDIA.playTogether}</p>
      ${candidates.length ? html`<ul class="members">
        ${candidates.map((c) => {
          const status = this.#pending.status(c.entityId, c.joined ? 'on' : 'off');
          const on = status === 'pending' ? this.#pending.expected(c.entityId) === 'on' : c.joined;
          const channel = c.joined ? channelSelect(hass, c.entityId) : null;
          return html`<li class="member">
            <div class="row">
              <span class="words"><span class="name">${c.name}</span>${c.areaName ? html`<span class="area">${c.areaName}</span>` : nothing}</span>
              <button class="switch ${on ? 'on' : ''}" role="switch" aria-checked=${on ? 'true' : 'false'} aria-label=${c.areaName ? `${c.name}, ${c.areaName}` : c.name} @click=${() => this.#toggle(c.entityId, on)}>
                <i></i>
              </button>
            </div>
            ${channel ? this.#channelField(hass, c.entityId, c.name, channel) : nothing}
          </li>`;
        })}
      </ul>` : nothing}
      ${pair
        ? html`<button class="pair" @click=${() => {
            this.#setChannel(this.entityId, 'Left');
            this.#setChannel(pair, 'Right');
          }}>${MEDIA.stereoPair}</button>`
        : nothing}
      ${members.length
        ? html`<div class="all">
            <span>${MEDIA.allVolume}</span>
            <button class="round all-quieter" aria-label=${MEDIA.allQuieter} @click=${() => this.#stepAll(group, -1)}>${icon(mdiMinus)}</button>
            <button class="round all-louder" aria-label=${MEDIA.allLouder} @click=${() => this.#stepAll(group, 1)}>${icon(mdiPlus)}</button>
          </div>`
        : nothing}`;
  }

  /** The one other speaker of a two-speaker group, when both have a channel and are not a pair yet, either way round. */
  #pairOf(hass: HomeAssistant, other: string): string | null {
    const mine = channelSelect(hass, this.entityId);
    const theirs = channelSelect(hass, other);
    if (!mine || !theirs) return null;
    const sides = `${hass.states[mine]?.state}/${hass.states[theirs]?.state}`;
    return sides === 'Left/Right' || sides === 'Right/Left' ? null : other;
  }

  #channelField(hass: HomeAssistant, speakerId: string, name: string, select: string) {
    const st = hass.states[select]!;
    const options = Array.isArray(st.attributes.options) ? st.attributes.options.filter((o): o is string => typeof o === 'string') : [];
    return html`<select class="member-channel" aria-label=${MEDIA.channelOf(name)} @change=${(e: Event) => this.#setChannel(speakerId, (e.target as HTMLSelectElement).value)}>
      ${options.map((o) => html`<option value=${o} ?selected=${o === st.state}>${channelWord(o)}</option>`)}
    </select>`;
  }

  static styles = css`
    :host {
      display: block;
      font-family: var(--hubb-font);
      color: var(--hubb-text);
    }
    .label {
      margin: 16px 2px 8px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--hubb-text-2);
    }
    .members {
      margin: 0;
      padding: 0;
      list-style: none;
      display: grid;
      gap: 6px;
    }
    .member,
    .all {
      min-height: 52px;
      padding: 0 12px;
      border-radius: 12px;
      background: var(--hubb-surface);
    }
    .row,
    .all {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .row {
      min-height: 52px;
    }
    .member-channel {
      box-sizing: border-box;
      width: 100%;
      min-height: 44px;
      margin: 0 0 10px;
      padding: 0 12px;
      border: 1.5px solid color-mix(in srgb, var(--hubb-text-2) 35%, transparent);
      border-radius: 12px;
      background: var(--hubb-surface-2);
      color: var(--hubb-text);
      font-family: var(--hubb-font);
      font-size: 16px;
    }
    .pair {
      all: unset;
      box-sizing: border-box;
      width: 100%;
      min-height: 48px;
      margin-top: 6px;
      display: grid;
      place-items: center;
      border-radius: 12px;
      background: var(--hubb-surface-2);
      font-size: 14px;
      font-weight: 700;
      cursor: pointer;
    }
    .words {
      flex: 1;
      display: grid;
    }
    .name {
      font-size: 14px;
      font-weight: 700;
    }
    .area {
      font-size: 12px;
      font-weight: 600;
      color: var(--hubb-text-2);
    }
    .switch {
      all: unset;
      position: relative;
      width: 48px;
      height: 28px;
      border-radius: 14px;
      background: var(--hubb-surface-2);
      cursor: pointer;
    }
    .switch i {
      position: absolute;
      top: 3px;
      left: 3px;
      width: 22px;
      height: 22px;
      border-radius: 50%;
      background: var(--hubb-text-2);
      transition: transform var(--hubb-motion, 200ms) ease;
    }
    .switch.on {
      background: var(--hubb-amber);
    }
    .switch.on i {
      transform: translateX(20px);
      background: var(--hubb-amber-ink);
    }
    .all {
      margin-top: 6px;
    }
    .all span {
      flex: 1;
      font-size: 14px;
      font-weight: 700;
    }
    .round {
      all: unset;
      width: 40px;
      height: 40px;
      display: grid;
      place-items: center;
      border-radius: 50%;
      background: var(--hubb-surface-2);
      cursor: pointer;
    }
    .round svg {
      width: 22px;
      height: 22px;
      fill: currentColor;
    }
    .part {
      margin: 0 2px 10px;
      font-size: 14px;
      font-weight: 600;
    }
    .leave {
      all: unset;
      box-sizing: border-box;
      width: 100%;
      min-height: 48px;
      display: grid;
      place-items: center;
      border-radius: 12px;
      background: var(--hubb-surface-2);
      font-size: 14px;
      font-weight: 700;
      cursor: pointer;
    }
    .switch:focus-visible,
    .pair:focus-visible,
    .member-channel:focus-visible,
    .round:focus-visible,
    .leave:focus-visible {
      outline: 2px solid var(--hubb-focus);
      outline-offset: 2px;
    }
  `;
}

define('hubb-media-group', HubbMediaGroup);
