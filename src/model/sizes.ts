import type { ItemKind } from './config';
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

/** The size with no choice made: today's look, except scenes of Cenas, two to a row (Gustavo, 15/10). */
export function defaultSize(kind: SizedKind): Size {
  if (WIDE.has(kind)) return 'large';
  return kind === 'scene' ? 'medium' : 'small';
}

/** The size of a card: `entities.<id>.size` when it fits the kind, else the default. */
export function sizeOf(options: HubbConfig | undefined, entityId: string, kind: SizedKind): Size {
  const chosen = options?.entities?.[entityId]?.size;
  return isSize(chosen) && sizesFor(kind).includes(chosen) ? chosen : defaultSize(kind);
}
