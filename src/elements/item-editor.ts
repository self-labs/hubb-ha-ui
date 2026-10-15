import { mdiChevronLeft, mdiChevronRight } from '@mdi/js';
import { LitElement, css, html, nothing, type PropertyValues } from 'lit';
import { CLIMATE_FEATURE, has, namedValues } from '../actions/climate';
import type { HomeAssistant } from '../ha/types';
import { coverIsGate } from '../model/classify';
import { CLIMATE_CONTROLS, ROLES, roleFits, type ItemKind, type Role } from '../model/config';
import { originOf } from '../model/origin';
import type { EntityConfig } from '../model/types';
import { CLIMATE, EDIT, KIND_LABELS, REVIEW } from '../strings';
import { define } from './define';
import { icon } from './icon';

/** The item the editor is open for. */
export interface EditItem {
  entityId: string;
  name: string;
  /** How it shows now. */
  kind: ItemKind;
  /** The items of its block, in their order, to move it among them. */
  siblings: string[];
}

/** What the editor asks the screen to save; the screen saves it and offers Desfazer. */
export interface EditRequest {
  entityId: string;
  /** What changed, in plain words, for the notice ("Agora se chama Teto."). */
  message: string;
  patch?: Partial<EntityConfig>;
  orders?: Record<string, number>;
}

const isRole = (kind: ItemKind): kind is Role => (ROLES as readonly string[]).includes(kind);

const collator = new Intl.Collator('pt-BR', { sensitivity: 'base', numeric: true });

/**
 * The editor of one item, inside a sheet: its name on the panel, its room, how it shows and its
 * place in its block. Each change is one request to the screen, which saves it.
 */
export class HubbItemEditor extends LitElement {
  static properties = {
    hass: { attribute: false },
    item: { attribute: false },
    roomAreaId: { attribute: false },
    named: { attribute: false },
    settings: { attribute: false },
    chosen: { state: true },
  };

  declare hass: HomeAssistant | undefined;
  declare item: EditItem | undefined;
  declare roomAreaId: string;
  /** Whether the YAML gives it a name, so "Usar o nome do Home Assistant" means something. */
  declare named: boolean;
  /** What the YAML says about the item, for the choices of an air conditioner. */
  declare settings: Partial<EntityConfig> | undefined;
  /** An air conditioner: the modes and settings ticked, until "Salvar escolhas". */
  declare chosen: { modes: string[]; controls: string[] } | null;

  constructor() {
    super();
    this.hass = undefined;
    this.item = undefined;
    this.roomAreaId = '';
    this.named = false;
    this.settings = undefined;
    this.chosen = null;
  }

  protected willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('item') || changed.has('settings')) this.chosen = null;
  }

  /**
   * The modes (off is the power button's) and the settings this air conditioner has. A setting counts
   * only when the sheet would show it, with two or more values that have a name: a toggle for one it
   * never shows would do nothing.
   */
  #climateOptions(hass: HomeAssistant, entityId: string): { modes: string[]; controls: string[] } {
    const st = hass.states[entityId];
    const list = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
    const modes = list(st?.attributes.hvac_modes).filter((m) => m !== 'off');
    const controls = CLIMATE_CONTROLS.filter((c) => {
      const feature = { fan: CLIMATE_FEATURE.fan, swing: CLIMATE_FEATURE.swing, preset: CLIMATE_FEATURE.preset }[c];
      return !!st && has(st, feature) && namedValues(hass, st, `${c}_mode`, list(st.attributes[`${c}_modes`])).length > 1;
    });
    return { modes, controls };
  }

  #toggle(kind: 'modes' | 'controls', value: string, all: { modes: string[]; controls: string[] }, now: { modes: string[]; controls: string[] }): void {
    const list = now[kind].includes(value) ? now[kind].filter((v) => v !== value) : [...now[kind], value];
    // In the order the device gives them, whatever the order of the taps.
    this.chosen = { ...now, [kind]: all[kind].filter((v) => list.includes(v)) };
  }

  #saveChoices(all: { modes: string[]; controls: string[] }, now: { modes: string[]; controls: string[] }): void {
    const item = this.item;
    if (!item) return;
    // Everything ticked is the default: the YAML keeps no list for it.
    const same = (a: string[], b: string[]): boolean => a.length === b.length && a.every((v) => b.includes(v));
    this.#ask({
      patch: { modes: same(now.modes, all.modes) ? undefined : now.modes, controls: same(now.controls, all.controls) ? undefined : now.controls },
      message: CLIMATE.choicesSaved(item.name),
    });
  }

  #climateChoices(hass: HomeAssistant, item: EditItem) {
    const all = this.#climateOptions(hass, item.entityId);
    if (all.modes.length + all.controls.length === 0) return nothing;
    const now = this.chosen ?? {
      modes: all.modes.filter((m) => !this.settings?.modes || this.settings.modes.includes(m)),
      controls: all.controls.filter((c) => !this.settings?.controls || this.settings.controls.includes(c)),
    };
    const words: Record<string, string> = { fan: CLIMATE.fan, swing: CLIMATE.swing, preset: CLIMATE.preset };
    const toggle = (kind: 'modes' | 'controls', value: string, label: string) => {
      const on = now[kind].includes(value);
      return html`<button class="panel-choice ${on ? 'current' : ''}" aria-pressed=${on ? 'true' : 'false'} @click=${() => this.#toggle(kind, value, all, now)}>
        ${label}
      </button>`;
    };
    return html`<div class="field">
      <span class="label">${CLIMATE.onPanel}</span>
      <div class="row">
        ${all.modes.map((m) => toggle('modes', m, CLIMATE.modes[m] ?? m))} ${all.controls.map((c) => toggle('controls', c, words[c] ?? c))}
      </div>
      <button class="save-choices" @click=${() => this.#saveChoices(all, now)}>${CLIMATE.saveChoices}</button>
    </div>`;
  }

  #ask(request: Omit<EditRequest, 'entityId'>): void {
    const item = this.item;
    if (!item) return;
    this.dispatchEvent(new CustomEvent<EditRequest>('hubb-edit', { detail: { entityId: item.entityId, ...request }, bubbles: true, composed: true }));
  }

  #saveName = (): void => {
    const item = this.item;
    const input = this.renderRoot.querySelector<HTMLInputElement>('input.name');
    const value = input?.value.trim() ?? '';
    if (!item || !value || value === item.name) return;
    this.#ask({ patch: { name: value }, message: EDIT.renamed(value) });
  };

  #haName = (): void => {
    this.#ask({ patch: { name: undefined }, message: EDIT.nameBack });
  };

  #moveTo = (e: Event): void => {
    const item = this.item;
    const areaId = (e.target as HTMLSelectElement).value;
    if (!item || areaId === this.roomAreaId) return;
    this.#ask({ patch: { area: areaId }, message: EDIT.movedTo(item.name, this.hass?.areas[areaId]?.name ?? areaId) });
  };

  #showAs(kind: ItemKind): void {
    const item = this.item;
    if (!item) return;
    const message = kind === 'hidden' ? REVIEW.savedHidden(item.name) : REVIEW.savedAs(item.name, KIND_LABELS[kind]);
    // Cortina is no role: a cover is a curtain when nothing says otherwise.
    if (kind === 'cover') this.#ask({ patch: { role: undefined }, message });
    else if (isRole(kind)) this.#ask({ patch: { role: kind }, message });
  }

  #move(step: number): void {
    const item = this.item;
    if (!item) return;
    const ids = [...item.siblings];
    const i = ids.indexOf(item.entityId);
    const j = i + step;
    if (i < 0 || j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j]!, ids[i]!];
    this.#ask({ orders: Object.fromEntries(ids.map((id, n) => [id, n + 1])), message: EDIT.moved(item.name) });
  }

  /** What "Mostrar como" offers: what fits the type of the item, and always Não mostrar. */
  #kinds(hass: HomeAssistant, item: EditItem): ItemKind[] {
    switch (item.kind) {
      case 'appliance':
      case 'climate':
      case 'fan':
      case 'media':
      case 'lock':
      case 'door':
      case 'window':
      case 'garage_door':
      case 'opening':
      case 'presence':
      case 'temperature':
      case 'humidity':
        return [item.kind, 'hidden'];
      case 'cover':
        return ['cover', 'gate', 'hidden'];
    }
    // A curtain made a gate by hand can go back; one whose class or name says gate cannot.
    if (item.kind === 'gate' && item.entityId.startsWith('cover.')) return coverIsGate(hass, item.entityId) ? ['gate', 'hidden'] : ['cover', 'gate', 'hidden'];
    const fitting = (['light', 'outlet', 'equipment', 'action', 'gate'] as Role[]).filter((r) => roleFits(hass, r, item.entityId));
    return [...fitting, 'hidden'];
  }

  render() {
    const { hass, item } = this;
    if (!hass || !item) return nothing;
    const areas = Object.values(hass.areas).sort((a, b) => collator.compare(a.name, b.name));
    const at = item.siblings.indexOf(item.entityId);
    const origin = originOf(hass, item.entityId);
    const haName = hass.states[item.entityId]?.attributes.friendly_name;
    // Where the item comes from: two integrations of one device give two items with one name.
    const source = [origin, item.entityId, typeof haName === 'string' && haName ? EDIT.inHa(haName) : null].filter(Boolean).join(' · ');
    return html`<p class="origin"><span class="label">${EDIT.origin}</span> ${source}</p>
      <div class="field">
        <label for="name">${EDIT.name}</label>
        <input
          id="name"
          class="name"
          .value=${item.name}
          @keydown=${(e: KeyboardEvent) => {
            if (e.key === 'Enter') this.#saveName();
          }}
        />
        <div class="row">
          <button class="save-name" @click=${this.#saveName}>${EDIT.saveName}</button>
          ${this.named ? html`<button class="ha-name" @click=${this.#haName}>${EDIT.haName}</button>` : nothing}
        </div>
      </div>
      <div class="field">
        <label for="room">${EDIT.room}</label>
        <select id="room" class="room" @change=${this.#moveTo}>
          ${areas.map((a) => html`<option value=${a.area_id} ?selected=${a.area_id === this.roomAreaId}>${a.name}</option>`)}
        </select>
      </div>
      <div class="field">
        <span class="label">${EDIT.showAs}</span>
        <div class="row">
          ${this.#kinds(hass, item).map(
            (kind) =>
              html`<button class="role ${kind === item.kind ? 'current' : ''}" ?disabled=${kind === item.kind} @click=${() => this.#showAs(kind)}>
                ${KIND_LABELS[kind]}
              </button>`,
          )}
        </div>
      </div>
      ${item.kind === 'climate' && item.entityId.startsWith('climate.') ? this.#climateChoices(hass, item) : nothing}
      ${item.siblings.length > 1
        ? html`<div class="field">
            <span class="label">${EDIT.place}</span>
            <div class="row">
              <button class="before" ?disabled=${at <= 0} @click=${() => this.#move(-1)}>${icon(mdiChevronLeft)} ${EDIT.before}</button>
              <button class="after" ?disabled=${at >= item.siblings.length - 1} @click=${() => this.#move(1)}>
                ${EDIT.after} ${icon(mdiChevronRight)}
              </button>
            </div>
          </div>`
        : nothing}`;
  }

  static styles = css`
    :host {
      display: block;
      font-family: var(--hubb-font);
      color: var(--hubb-text);
    }
    .field {
      display: grid;
      gap: 8px;
      margin-bottom: 18px;
    }
    .origin {
      margin: 0 0 18px;
      padding: 10px 12px;
      border-radius: 12px;
      background: var(--hubb-surface);
      font-size: 12px;
      font-weight: 600;
      color: var(--hubb-text-2);
      overflow-wrap: anywhere;
    }
    .origin .label {
      display: block;
      margin-bottom: 4px;
    }
    label,
    .label {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--hubb-text-2);
    }
    input,
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
    input:focus-visible,
    select:focus-visible {
      outline: 2px solid var(--hubb-focus);
      outline-offset: 1px;
    }
    .row {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    button {
      all: unset;
      box-sizing: border-box;
      min-height: 44px;
      padding: 0 14px;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      border-radius: 12px;
      background: var(--hubb-surface-2);
      color: var(--hubb-text);
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
    }
    button:focus-visible {
      outline: 2px solid var(--hubb-focus);
      outline-offset: 2px;
    }
    button[disabled] {
      cursor: default;
      opacity: 0.45;
    }
    .save-name,
    .save-choices,
    .role.current,
    .panel-choice.current {
      background: var(--hubb-primary-bg);
      color: var(--hubb-primary-ink);
    }
    .save-choices {
      justify-content: center;
    }
    .role.current[disabled] {
      opacity: 1;
    }
    button svg {
      width: 18px;
      height: 18px;
      fill: currentColor;
    }
  `;
}

define('hubb-item-editor', HubbItemEditor);
