import { LitElement, css, html, nothing } from 'lit';
import {
  clampKelvin,
  currentPreset,
  kelvinRange,
  lightCaps,
  presetRequest,
  presetsFor,
  setLightColor,
  type ColorPreset,
  type PresetId,
} from '../actions/color';
import { haptic } from '../actions/haptic';
import type { HassEntityState, HomeAssistant } from '../ha/types';
import { PRESET_WORDS, S } from '../strings';
import { define } from './define';

const CONFIRM_MS = 3000;
const KELVIN_STEP = 50;

function reportedKelvin(state: HassEntityState | undefined): number | null {
  const k = state?.attributes.color_temp_kelvin;
  return state?.attributes.color_mode === 'color_temp' && typeof k === 'number' ? k : null;
}

/** The colour buttons and the white temperature of one light; nothing for a light with neither. */
export class HubbColorPanel extends LitElement {
  static properties = {
    hass: { attribute: false },
    entityId: { attribute: false },
  };

  declare hass: HomeAssistant | undefined;
  declare entityId: string;

  /** What was last asked, shown until Home Assistant reports it or CONFIRM_MS pass. */
  #pendingPreset: PresetId | null = null;
  #pendingKelvin: number | null = null;
  #pendingAt = 0;
  #timer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    super();
    this.hass = undefined;
    this.entityId = '';
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this.#timer) clearTimeout(this.#timer);
  }

  #expired(): boolean {
    return Date.now() - this.#pendingAt >= CONFIRM_MS;
  }

  #send(data: Record<string, unknown>): void {
    const hass = this.hass;
    if (!hass) return;
    haptic('selection');
    this.#pendingAt = Date.now();
    if (this.#timer) clearTimeout(this.#timer);
    this.#timer = setTimeout(() => this.requestUpdate(), CONFIRM_MS + 50);
    this.requestUpdate();
    setLightColor(hass, this.entityId, data).catch(() => haptic('failure'));
  }

  #pick(preset: ColorPreset): void {
    const st = this.hass?.states[this.entityId];
    this.#pendingPreset = preset.id;
    this.#pendingKelvin = null;
    this.#send(presetRequest(preset, lightCaps(st), kelvinRange(st)));
  }

  #onKelvin = (e: Event): void => {
    const kelvin = clampKelvin(Number((e.target as HTMLInputElement).value), kelvinRange(this.hass?.states[this.entityId]));
    this.#pendingKelvin = kelvin;
    this.#pendingPreset = null;
    this.#send({ color_temp_kelvin: kelvin });
  };

  #shownPreset(actual: PresetId | null): PresetId | null {
    if (this.#pendingPreset === null) return actual;
    if (actual === this.#pendingPreset || this.#expired()) {
      this.#pendingPreset = null;
      return actual;
    }
    return this.#pendingPreset;
  }

  #shownKelvin(actual: number | null, range: readonly [number, number]): number {
    if (this.#pendingKelvin !== null) {
      if ((actual !== null && Math.abs(actual - this.#pendingKelvin) <= KELVIN_STEP) || this.#expired()) this.#pendingKelvin = null;
      else return this.#pendingKelvin;
    }
    return actual ?? Math.round((range[0] + range[1]) / 2 / KELVIN_STEP) * KELVIN_STEP;
  }

  render() {
    const st = this.hass?.states[this.entityId];
    const caps = lightCaps(st);
    const range = kelvinRange(st);
    const presets = presetsFor(caps, range);
    if (presets.length === 0) return nothing;
    const cur = this.#shownPreset(currentPreset(st, presets, range));
    const buttons = html`<div class="presets">
      ${presets.map((p) => {
        const words = PRESET_WORDS[p.id];
        const on = p.id === cur;
        return html`<button class=${on ? 'cur' : ''} aria-pressed=${on ? 'true' : 'false'} aria-label=${words.name} @click=${() => this.#pick(p)}>
          <span class="swatch" style="background:${p.swatch}"></span><span class="label">${words.label}</span>
        </button>`;
      })}
    </div>`;
    if (!caps.temp) return html`<h3>${S.color}</h3>${buttons}`;
    const reported = reportedKelvin(st);
    const kelvin = this.#shownKelvin(reported, range);
    // The number is shown only when it is real: reported in white mode, or just asked.
    const known = reported !== null || this.#pendingKelvin !== null;
    return html`${caps.color ? html`<h3>${S.color}</h3>${buttons}` : nothing}
      <h3>${S.whiteTemp}${known ? html` <span class="value">${kelvin} K</span>` : nothing}</h3>
      ${caps.color ? nothing : buttons}
      <input
        class="kelvin"
        type="range"
        aria-label=${S.whiteTemp}
        min=${Math.floor(range[0] / KELVIN_STEP) * KELVIN_STEP}
        max=${Math.ceil(range[1] / KELVIN_STEP) * KELVIN_STEP}
        step=${KELVIN_STEP}
        .value=${String(kelvin)}
        @change=${this.#onKelvin}
      />`;
  }

  static styles = css`
    :host {
      display: block;
      --kelvin-track: linear-gradient(to right, #ffb46b, #fff4e5, #dfe9ff);
    }
    h3 {
      display: flex;
      justify-content: space-between;
      margin: 18px 2px 8px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--hubb-text-2);
    }
    .value {
      letter-spacing: 0;
      text-transform: none;
      color: var(--hubb-text);
    }
    .presets {
      display: grid;
      grid-template-columns: repeat(5, minmax(0, 1fr));
      gap: 6px;
    }
    .presets button {
      all: unset;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 4px;
      min-height: 60px;
      padding: 6px 2px;
      border-radius: 12px;
      background: var(--hubb-surface-2);
      color: var(--hubb-text);
      font-family: var(--hubb-font);
      cursor: pointer;
    }
    .presets button.cur {
      box-shadow: inset 0 0 0 2px var(--hubb-text);
    }
    .presets button:focus-visible {
      outline: 2px solid var(--hubb-focus);
      outline-offset: 2px;
    }
    .swatch {
      width: 26px;
      height: 26px;
      border-radius: 50%;
      box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--hubb-text-2) 45%, transparent);
    }
    .label {
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: 10.5px;
      font-weight: 700;
    }
    .kelvin {
      -webkit-appearance: none;
      appearance: none;
      width: 100%;
      height: 44px;
      margin: 0;
      background: transparent;
      cursor: pointer;
    }
    .kelvin::-webkit-slider-runnable-track {
      height: 12px;
      border-radius: 6px;
      background: var(--kelvin-track);
    }
    .kelvin::-moz-range-track {
      height: 12px;
      border-radius: 6px;
      background: var(--kelvin-track);
    }
    .kelvin::-webkit-slider-thumb {
      -webkit-appearance: none;
      width: 28px;
      height: 28px;
      margin-top: -8px;
      border-radius: 50%;
      background: var(--hubb-surface);
      box-shadow: 0 0 0 2px var(--hubb-text);
    }
    .kelvin::-moz-range-thumb {
      width: 28px;
      height: 28px;
      border: 0;
      border-radius: 50%;
      background: var(--hubb-surface);
      box-shadow: 0 0 0 2px var(--hubb-text);
    }
  `;
}

define('hubb-color-panel', HubbColorPanel);
