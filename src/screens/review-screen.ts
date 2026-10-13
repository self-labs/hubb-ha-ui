import { mdiChevronLeft } from '@mdi/js';
import { css, html, nothing } from 'lit';
import { copyText } from '../actions/clipboard';
import { haptic } from '../actions/haptic';
import { goBack } from '../actions/navigate';
import { define } from '../elements/define';
import { icon } from '../elements/icon';
import '../elements/nav-bar';
import { REVIEW_GROUPS, reviewItems, suggestedLines, yamlBlock, yamlLine, type ReviewItem } from '../model/review';
import type { HubbConfig } from '../model/types';
import { REVIEW, ROLE_LABELS, S } from '../strings';
import { tokens } from '../theme/tokens';
import { HubbScreen } from './base';

export interface ReviewScreenConfig {
  type: string;
  /** The dashboard configuration, so the review reads the same roles the panel does. */
  options?: HubbConfig;
  homeLabel?: string;
}

/** How long "Linha copiada" stays. */
const NOTICE_MS = 2000;
/** One object for a missing configuration, so the cached review keeps its key. */
const NO_OPTIONS: HubbConfig = {};

/** "Revisar o painel": what stayed off the panel and why, with the line of YAML to paste. Administrators only. */
export class HubbReviewScreen extends HubbScreen {
  static properties = {
    config: { attribute: false },
    notice: { state: true },
    manual: { state: true },
  };

  declare config: ReviewScreenConfig | undefined;
  declare notice: string | null;
  /** The text to copy by hand, when the device copies nothing. */
  declare manual: string | null;

  #timer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    super();
    this.config = undefined;
    this.notice = null;
    this.manual = null;
  }

  setConfig(config: ReviewScreenConfig): void {
    if (!config) throw new Error('hubb-review-screen: missing config');
    this.config = config;
  }

  protected scope(): string[] {
    return [];
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this.#timer) clearTimeout(this.#timer);
    this.#timer = null;
  }

  async #copy(text: string, done: string): Promise<void> {
    const ok = await copyText(text);
    haptic(ok ? 'success' : 'warning');
    this.manual = ok ? null : text;
    this.notice = ok ? done : REVIEW.copyFailed;
    if (this.#timer) clearTimeout(this.#timer);
    this.#timer = setTimeout(() => {
      this.#timer = null;
      this.notice = null;
    }, NOTICE_MS);
  }

  #item(item: ReviewItem) {
    const where = [item.areaName, item.group === 'config' ? null : item.entityId].filter(Boolean).join(' · ');
    const entityId = item.entityId;
    return html`<li class="item">
      <strong>${item.name}</strong>
      ${where ? html`<span class="where">${where}</span>` : nothing}
      <span class="why">${item.reason}</span>
      ${entityId && item.roles.length
        ? html`<div class="roles">
            ${item.roles.map(
              (role) =>
                html`<button class="role ${role === item.suggested ? 'suggested' : ''}" @click=${() => void this.#copy(yamlLine(entityId, role), REVIEW.copied)}>
                  ${ROLE_LABELS[role]}
                </button>`,
            )}
          </div>`
        : nothing}
    </li>`;
  }

  render() {
    const hass = this.hass;
    if (!hass) return nothing;
    const admin = !!hass.user?.is_admin;
    const items = admin ? reviewItems(hass, this.config?.options ?? NO_OPTIONS) : [];
    const lines = suggestedLines(items);
    return html`<header class="hero">
        <button class="back" aria-label=${S.back} @click=${() => goBack()}>${icon(mdiChevronLeft)}</button>
        <div>
          <h1>${REVIEW.title}</h1>
          <p>${admin ? REVIEW.onlyYou : REVIEW.adminOnly}</p>
        </div>
      </header>
      <main>
        <p class="notice" role="status">${this.notice ?? ''}</p>
        ${this.manual ? html`<pre class="manual">${this.manual}</pre>` : nothing}
        ${admin && items.length === 0 ? html`<div class="empty"><strong>${REVIEW.nothing}</strong></div>` : nothing}
        ${lines.length
          ? html`<button class="primary wide" @click=${() => void this.#copy(yamlBlock(lines), REVIEW.copiedAll)}>${REVIEW.copyAll}</button>`
          : nothing}
        ${REVIEW_GROUPS.map((group) => {
          const mine = items.filter((i) => i.group === group);
          return mine.length
            ? html`<h2>${REVIEW.groups[group]} (${mine.length})</h2>
                <ul>
                  ${mine.map((i) => this.#item(i))}
                </ul>`
            : nothing;
        })}
      </main>
      <hubb-nav-bar current="home" home-label=${this.config?.homeLabel ?? S.home}></hubb-nav-bar>`;
  }

  static styles = [
    tokens,
    HubbScreen.baseStyles,
    css`
      .hero {
        box-sizing: border-box;
        display: flex;
        align-items: center;
        gap: 12px;
        max-width: 560px;
        min-height: 76px;
        margin: 0 auto;
        padding: 12px 16px 4px;
      }
      .back {
        all: unset;
        flex: none;
        width: 44px;
        height: 44px;
        display: grid;
        place-items: center;
        border-radius: 50%;
        background: var(--hubb-surface);
        color: var(--hubb-text);
        cursor: pointer;
      }
      .back:focus-visible {
        outline: 2px solid var(--hubb-focus);
        outline-offset: 2px;
      }
      .back svg {
        width: 24px;
        height: 24px;
        fill: currentColor;
      }
      h1 {
        margin: 0;
        font-size: 22px;
        font-weight: 800;
        letter-spacing: -0.02em;
      }
      .hero p {
        margin: 2px 0 0;
        font-size: 12px;
        font-weight: 600;
        color: var(--hubb-text-2);
      }
      /* Reserved height: the list does not jump when the notice comes and goes. */
      .notice {
        min-height: 18px;
        margin: 0 2px 8px;
        font-size: 12px;
        font-weight: 700;
        color: var(--hubb-amber-text);
      }
      .manual {
        margin: 0 0 12px;
        padding: 10px 12px;
        border-radius: 12px;
        background: var(--hubb-surface);
        font-size: 12px;
        white-space: pre-wrap;
        user-select: all;
        -webkit-user-select: all;
      }
      .wide {
        width: 100%;
      }
      ul {
        display: grid;
        gap: 8px;
        margin: 0;
        padding: 0;
        list-style: none;
      }
      .item {
        display: grid;
        gap: 2px;
        padding: 12px;
        border-radius: var(--hubb-radius, 16px);
        background: var(--hubb-surface);
        box-shadow: var(--hubb-card-shadow);
        font-size: 12px;
      }
      .item strong {
        font-size: 13px;
      }
      .where {
        color: var(--hubb-text-2);
        font-weight: 600;
        overflow-wrap: anywhere;
      }
      .why {
        color: var(--hubb-text-2);
      }
      .roles {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-top: 8px;
      }
      .role {
        all: unset;
        box-sizing: border-box;
        min-height: 44px;
        padding: 0 12px;
        display: inline-flex;
        align-items: center;
        border-radius: 12px;
        background: var(--hubb-surface-2);
        color: var(--hubb-text);
        font-size: 12px;
        font-weight: 700;
        cursor: pointer;
      }
      .role:focus-visible {
        outline: 2px solid var(--hubb-focus);
        outline-offset: 2px;
      }
      .role.suggested {
        background: var(--hubb-primary-bg);
        color: var(--hubb-primary-ink);
      }
    `,
  ];
}

define('hubb-review-screen', HubbReviewScreen);
