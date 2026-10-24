import { LitElement, css, html, nothing, svg, type PropertyValues } from 'lit';
import { degrees } from '../actions/climate';
import { haptic } from '../actions/haptic';
import { ARC_START, ARC_SWEEP, angleToValue, arcPath, inGap, pointToAngle, valueToAngle } from '../model/arc';
import { CLIMATE } from '../strings';
import { define } from './define';

/** The drawing: a 260 by 230 box, the arc around (130, 130). */
const W = 260;
const H = 230;
const CX = 130;
const CY = 130;
const R = 105;
/** How far from the line of the arc a finger still takes it; the middle (the number) does not. */
const REACH = 40;
/** Page Up and Page Down move this many steps. */
const PAGE = 5;

export interface ArcChange {
  value: number;
  /** A finger let go (sent at once) or a key (grouped with the next keys, like − and +). */
  source: 'pointer' | 'key';
}

const point = (deg: number): [number, number] => [CX + R * Math.cos((deg * Math.PI) / 180), CY + R * Math.sin((deg * Math.PI) / 180)];

/**
 * The arc of an air conditioner's sheet, after the card of Home Assistant: 270 degrees from the lowest
 * target of the device to the highest, the part up to the target in the colour of the mode, a knob to
 * drag, a dot at the temperature now and, inside, what it is doing, the target and the temperature now.
 * Dragging shows the target under the finger (`hubb-arc-input`) and asks for it once when the finger
 * lets go (`hubb-arc-change`); a touch the system takes away asks for nothing. The knob is a slider for
 * the keyboard and for screen readers.
 */
export class HubbClimateArc extends LitElement {
  static properties = {
    value: { attribute: false },
    min: { attribute: false },
    max: { attribute: false },
    step: { attribute: false },
    current: { attribute: false },
    color: { attribute: false },
    label: { attribute: false },
    disabled: { attribute: false },
  };

  /** The target on screen (the one asked, until Home Assistant shows it); null: none to set. */
  declare value: number | null;
  declare min: number;
  declare max: number;
  declare step: number;
  /** The temperature now; null when the device does not tell it. */
  declare current: number | null;
  /** The colour of the mode, a `var(--hubb-mode-*)`. */
  declare color: string;
  /** What it is doing ("Resfriando"), or why there is no target ("Desligado"). */
  declare label: string;
  declare disabled: boolean;

  /** The target under the finger while it drags. */
  #drag: number | null = null;
  /** The last target picked (finger let go, a key), shown until a new `value` comes. */
  #picked: number | null = null;

  constructor() {
    super();
    this.value = null;
    this.min = 7;
    this.max = 35;
    this.step = 1;
    this.current = null;
    this.color = 'var(--hubb-mode-off)';
    this.label = '';
    this.disabled = false;
  }

  protected willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('value')) this.#picked = null;
  }

  get #off(): boolean {
    return this.disabled || this.value === null;
  }

  #emit(type: 'hubb-arc-input' | 'hubb-arc-change', detail: { value: number } | ArcChange): void {
    this.dispatchEvent(new CustomEvent(type, { detail, bubbles: true, composed: true }));
  }

  /** The target at the finger, or null when the finger is not on the line of the arc. */
  #at(e: PointerEvent, svgEl: SVGSVGElement, strict: boolean): number | null {
    const rect = svgEl.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    const x = ((e.clientX - rect.left) * W) / rect.width;
    const y = ((e.clientY - rect.top) * H) / rect.height;
    if (strict && Math.abs(Math.hypot(x - CX, y - CY) - R) > REACH) return null;
    // A finger that slips past an end into the gap holds that end, never the other one.
    if (this.#drag !== null && inGap(x, y, CX, CY)) return this.#drag >= (this.min + this.max) / 2 ? this.max : this.min;
    return angleToValue(pointToAngle(x, y, CX, CY), this.min, this.max, this.step);
  }

  #down = (e: PointerEvent): void => {
    if (this.#off) return;
    const svgEl = e.currentTarget as SVGSVGElement;
    const v = this.#at(e, svgEl, true);
    if (v === null) return;
    // The sheet must not start a drag, nor the page scroll (touch-action: none in the styles).
    e.stopPropagation();
    (svgEl as unknown as { setPointerCapture?: (id: number) => void }).setPointerCapture?.(e.pointerId);
    haptic('selection');
    this.#drag = v;
    this.#emit('hubb-arc-input', { value: v });
    this.requestUpdate();
  };

  #move = (e: PointerEvent): void => {
    if (this.#drag === null) return;
    // The device went off or to a mode with no target under the finger: the drag is over.
    if (this.#off) return this.#cancel();
    const v = this.#at(e, e.currentTarget as SVGSVGElement, false);
    if (v === null || v === this.#drag) return;
    haptic('selection');
    this.#drag = v;
    this.#emit('hubb-arc-input', { value: v });
    this.requestUpdate();
  };

  #up = (): void => {
    if (this.#drag === null) return;
    if (this.#off) return this.#cancel();
    const v = this.#drag;
    const had = this.#picked ?? this.value;
    this.#drag = null;
    // A tap on the target it already has asks for nothing (an infrared blast, a call to the cloud).
    if (v !== had) {
      this.#picked = v;
      this.#emit('hubb-arc-change', { value: v, source: 'pointer' });
    }
    this.requestUpdate();
  };

  #cancel = (): void => {
    if (this.#drag === null) return;
    this.#drag = null;
    this.requestUpdate();
  };

  #key = (e: KeyboardEvent): void => {
    const base = this.#picked ?? this.value;
    if (this.#off || base === null) return;
    const s = this.step;
    const up = (n: number): number => Math.floor(base / s) * s + n * s;
    const down = (n: number): number => Math.ceil(base / s) * s - n * s;
    const moves: Record<string, [number, () => number]> = {
      ArrowUp: [1, () => up(1)],
      ArrowRight: [1, () => up(1)],
      ArrowDown: [-1, () => down(1)],
      ArrowLeft: [-1, () => down(1)],
      PageUp: [1, () => up(PAGE)],
      PageDown: [-1, () => down(PAGE)],
      Home: [-1, () => this.min],
      End: [1, () => this.max],
    };
    const move = moves[e.key];
    if (!move) return;
    e.preventDefault();
    const next = Math.min(this.max, Math.max(this.min, move[1]()));
    // Below the lowest target the device allows (an LG in Auto at 17 with 18), down does not go up.
    if ((next - base) * move[0] <= 0) return;
    this.#picked = next;
    this.#emit('hubb-arc-change', { value: next, source: 'key' });
    this.requestUpdate();
  };

  render() {
    const off = this.#off;
    const shown = off ? null : (this.#drag ?? this.#picked ?? this.value);
    const angle = shown === null ? null : valueToAngle(shown, this.min, this.max);
    const knob = angle === null ? null : point(angle);
    const now = this.current;
    const dot = now !== null && now >= this.min && now <= this.max ? point(valueToAngle(now, this.min, this.max)) : null;
    return html`<div class="dial">
      <svg viewBox="0 0 ${W} ${H}" @pointerdown=${this.#down} @pointermove=${this.#move} @pointerup=${this.#up} @pointercancel=${this.#cancel}>
        <path class="track" d=${arcPath(CX, CY, R, ARC_START, ARC_START + ARC_SWEEP)}></path>
        ${angle !== null && angle > ARC_START ? svg`<path class="active" style=${`stroke: ${this.color}`} d=${arcPath(CX, CY, R, ARC_START, angle)}></path>` : nothing}
        ${dot ? svg`<circle class="now-dot" cx=${dot[0]} cy=${dot[1]} r="4"></circle>` : nothing}
        ${knob && shown !== null
          ? svg`<circle
              class="knob"
              cx=${knob[0]}
              cy=${knob[1]}
              r="13"
              role="slider"
              tabindex="0"
              aria-label=${CLIMATE.target}
              aria-valuemin=${String(this.min)}
              aria-valuemax=${String(this.max)}
              aria-valuenow=${String(Math.min(this.max, Math.max(this.min, shown)))}
              aria-valuetext=${CLIMATE.degreesSpoken(shown)}
              @keydown=${this.#key}
            ></circle>`
          : nothing}
      </svg>
      <div class="pan"></div>
      <div class="center">
        <span class="state">${this.label}</span>
        ${shown !== null ? html`<span class="target">${degrees(shown)}°</span>` : nothing}
        ${now !== null ? html`<span class="now">${CLIMATE.nowShort(Math.round(now))}</span>` : nothing}
      </div>
    </div>`;
  }

  static styles = css`
    :host {
      display: block;
      font-family: var(--hubb-font);
      color: var(--hubb-text);
    }
    .dial {
      position: relative;
      width: 100%;
      max-width: var(--hubb-arc-size, 280px);
      margin: 0 auto;
    }
    svg {
      display: block;
      width: 100%;
      height: auto;
      touch-action: none;
      -webkit-user-select: none;
      user-select: none;
      -webkit-tap-highlight-color: transparent;
    }
    .track,
    .active {
      fill: none;
      stroke-width: 18;
      stroke-linecap: round;
    }
    .track {
      stroke: var(--hubb-surface-2);
    }
    .now-dot {
      fill: var(--hubb-amber);
    }
    .knob {
      fill: #fff;
      cursor: grab;
      filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.45));
    }
    .knob:focus {
      outline: none;
    }
    .knob:focus-visible {
      stroke: var(--hubb-focus);
      stroke-width: 4;
    }
    /* The middle of the dial, which no finger drags: a swipe there scrolls the sheet (the drawing
       takes every touch, touch-action: none). */
    .pan {
      position: absolute;
      left: 25%;
      top: 28.26%;
      width: 50%;
      height: 56.52%;
      border-radius: 50%;
      touch-action: pan-y;
    }
    /* Inside the arc, a little above its middle: the opening is at the bottom. */
    .center {
      position: absolute;
      inset: 0 0 12% 0;
      display: grid;
      place-content: center;
      justify-items: center;
      gap: 2px;
      pointer-events: none;
      text-align: center;
    }
    .state,
    .now {
      font-size: 13px;
      color: var(--hubb-text-2);
    }
    .target {
      font-size: 56px;
      font-weight: 800;
      line-height: 1.05;
      letter-spacing: -0.03em;
    }
  `;
}

define('hubb-climate-arc', HubbClimateArc);
