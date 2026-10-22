import type { ItemKind } from './config';
import type { Layout } from './layout';
import type { HubbConfig } from './types';

/** How wide a card is in its block: a third of the row, half of it, or all of it. */
export const SIZES = ['small', 'medium', 'large'] as const;
export type Size = (typeof SIZES)[number];

/** What a size can be set on: an item of a room, or a scene of Cenas. */
export type SizedKind = ItemKind | 'scene';

/** Cards with buttons or a slide: on half a phone row their text runs under the buttons. */
const WIDE: ReadonlySet<SizedKind> = new Set(['climate', 'media', 'gate', 'lock', 'appliance']);

export const isSize = (v: unknown): v is Size => typeof v === 'string' && (SIZES as readonly string[]).includes(v);

/** The sizes the installer can pick for a kind of card; one size leaves nothing to pick. */
export function sizesFor(kind: SizedKind): Size[] {
  return WIDE.has(kind) ? ['large'] : [...SIZES];
}

/** Whether an entity shows as a card that only takes the whole row, by its domain or its role. */
export function wholeRowOnly(entityId: string, role: string | undefined): boolean {
  return /^(climate|media_player|lock)\./.test(entityId) || role === 'gate' || role === 'appliance';
}

/**
 * The size with no choice made: today's look, except scenes of Cenas, two to a row on a phone
 * (Gustavo, 15/10) and four on a tablet, where half a row is a long empty strip (Gustavo, 21/10).
 */
export function defaultSize(kind: SizedKind, layout: Layout = 'phone'): Size {
  if (WIDE.has(kind)) return 'large';
  if (kind === 'scene') return layout === 'phone' ? 'medium' : 'small';
  return 'small';
}

/** The size of a card: `entities.<id>.size` when it fits the kind, else the default for the layout. */
export function sizeOf(options: HubbConfig | undefined, entityId: string, kind: SizedKind, layout: Layout = 'phone'): Size {
  const chosen = options?.entities?.[entityId]?.size;
  return isSize(chosen) && sizesFor(kind).includes(chosen) ? chosen : defaultSize(kind, layout);
}
