import { mdiChevronLeft, mdiChevronRight } from '@mdi/js';
import { LitElement, css, html, nothing } from 'lit';
import type { HomeAssistant } from '../ha/types';
import { roleFits, type Role } from '../model/config';
import type { EntityConfig } from '../model/types';
import { EDIT, REVIEW, ROLE_LABELS } from '../strings';
import { define } from './define';
import { icon } from './icon';

/** The item the editor is open for. */
export interface EditItem {
  entityId: string;
  name: string;
  /** How it shows now. */
  kind: Role;
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
  };

  declare hass: HomeAssistant | undefined;
  declare item: EditItem | undefined;
  declare roomAreaId: string;
  /** Whether the YAML gives it a name, so "Usar o nome do Home Assistant" means something. */
  declare named: boolean;

  constructor() {
    super();
    this.hass = undefined;
    this.item = undefined;
    this.roomAreaId = '';
    this.named = false;
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

  #showAs(role: Role): void {
    const item = this.item;
    if (!item) return;
    const message = role === 'hidden' ? REVIEW.savedHidden(item.name) : REVIEW.savedAs(item.name, ROLE_LABELS[role]);
    this.#ask({ patch: { role }, message });
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

  #roles(hass: HomeAssistant, item: EditItem): Role[] {
    const fitting =
      item.kind === 'appliance'
        ? (['appliance'] as Role[])
        : (['light', 'outlet', 'equipment', 'action'] as Role[]).filter((r) => roleFits(hass, r, item.entityId));
    return [...fitting, 'hidden'];
  }

  render() {
    const { hass, item } = this;
    if (!hass || !item) return nothing;
    const areas = Object.values(hass.areas).sort((a, b) => collator.compare(a.name, b.name));
    const at = item.siblings.indexOf(item.entityId);
    return html`<div class="field">
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
          ${this.#roles(hass, item).map(
            (role) =>
              html`<button class="role ${role === item.kind ? 'current' : ''}" ?disabled=${role === item.kind} @click=${() => this.#showAs(role)}>
                ${ROLE_LABELS[role]}
              </button>`,
          )}
        </div>
      </div>
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
    .role.current {
      background: var(--hubb-primary-bg);
      color: var(--hubb-primary-ink);
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
