import { LitElement, css, html, nothing } from 'lit';
import { serverSkew } from '../server-clock';
import { MEDIA } from '../strings';
import { define } from './define';

const clock = (s: number): string => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/**
 * Where the music is: elapsed and total time, and a bar. The position runs by itself while playing, from
 * the position Home Assistant gave and when it gave it; dragged, it asks to seek (`hubb-seek`).
 */
export class HubbMediaProgress extends LitElement {
  static properties = {
    duration: { attribute: false },
    position: { attribute: false },
    positionAt: { attribute: false },
    playing: { attribute: false },
    seekable: { attribute: false },
  };

  declare duration: number;
  declare position: number;
  declare positionAt: number;
  declare playing: boolean;
  declare seekable: boolean;

  #tick: ReturnType<typeof setInterval> | null = null;
  /** Where the finger holds the bar while it drags; null when nobody drags. */
  #drag: number | null = null;

  constructor() {
    super();
    this.duration = 0;
    this.position = 0;
    this.positionAt = 0;
    this.playing = false;
    this.seekable = false;
  }

  connectedCallback(): void {
    super.connectedCallback();
    // Back on screen with the same position: updated() would not run again to restart the clock.
    if (this.hasUpdated) this.requestUpdate();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#stop();
  }

  #stop(): void {
    if (this.#tick) clearInterval(this.#tick);
    this.#tick = null;
  }

  protected updated(): void {
    // One second at a time while it plays; still when paused or gone.
    if (this.playing && this.isConnected && !this.#tick) this.#tick = setInterval(() => this.requestUpdate(), 1000);
    if (!this.playing) this.#stop();
  }

  #elapsed(): number {
    // `positionAt` is the time of the server: counted on the clock of the server, not of this device.
    const run = this.playing ? Math.max(0, (Date.now() - serverSkew() - this.positionAt) / 1000) : 0;
    return Math.min(this.duration, Math.max(0, this.position + run));
  }

  render() {
    if (!(this.duration > 0)) return nothing;
    const elapsed = this.#elapsed();
    const share = `${(elapsed / this.duration) * 100}%`;
    return html`${this.seekable
        ? html`<input
            type="range"
            min="0"
            max=${Math.round(this.duration)}
            .value=${String(this.#drag ?? Math.round(elapsed))}
            aria-label=${MEDIA.elapsed}
            @input=${(e: Event) => (this.#drag = Number((e.target as HTMLInputElement).value))}
            @change=${(e: Event) => {
              this.#drag = null;
              this.dispatchEvent(new CustomEvent('hubb-seek', { detail: { position: Number((e.target as HTMLInputElement).value) }, bubbles: true, composed: true }));
            }}
          />`
        : html`<div class="bar" role="progressbar" aria-label=${MEDIA.elapsed} aria-valuemin="0" aria-valuemax=${Math.round(this.duration)} aria-valuenow=${Math.round(elapsed)}>
            <span style="width:${share}"></span>
          </div>`}
      <div class="times"><span class="time">${clock(elapsed)}</span><span class="time">${clock(this.duration)}</span></div>`;
  }

  static styles = css`
    :host {
      display: block;
    }
    .bar {
      height: 6px;
      border-radius: 3px;
      background: var(--hubb-surface-2);
      overflow: hidden;
    }
    .bar span {
      display: block;
      height: 100%;
      background: var(--hubb-amber);
    }
    input {
      width: 100%;
      margin: 0;
      accent-color: var(--hubb-amber);
    }
    .times {
      display: flex;
      justify-content: space-between;
      margin-top: 6px;
      font-size: 12px;
      font-weight: 600;
      color: var(--hubb-text-2);
      font-variant-numeric: tabular-nums;
    }
  `;
}

define('hubb-media-progress', HubbMediaProgress);
