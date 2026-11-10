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

/** A name past this many characters does not fit a third of a phone row, even over two lines. */
export const LONG_NAME = 22;

/**
 * The size with no choice made: today's look, except scenes of Cenas, two to a row on a phone
 * (Gustavo, 15/10) and four on a tablet, where half a row is a long empty strip (Gustavo, 21/10); and, on
 * a phone, a card whose name is longer than LONG_NAME, which takes half a row. Only that card: the others
 * keep their third and only match its height (Gustavo, 10/11). A tablet keeps its third, where a name fits.
 */
export function defaultSize(kind: SizedKind, layout: Layout = 'phone', name = ''): Size {
  if (WIDE.has(kind)) return 'large';
  if (kind === 'scene') return layout === 'phone' ? 'medium' : 'small';
  return layout === 'phone' && name.length > LONG_NAME ? 'medium' : 'small';
}

/** The columns of a phone row, and how many of them a card of each size takes. */
export const COLUMNS = 6;
const SPAN: Record<Size, number> = { small: 2, medium: 3, large: COLUMNS };

export const spanOf = (size: Size): number => SPAN[size];

/**
 * The columns each card of a grid takes on a phone, in order. It is the span of its size, except in a row of
 * two or more cards that is not the last of the grid: there the last card takes the columns the row had
 * left, so a long name beside a third of a row, or before a card that does not fit, leaves no hole between
 * rows (Gustavo, 10/11). The last row stays as it is, so four lights are not stretched into a strip, and a
 * row of one card does too, so a card before a whole-row one is not made one. The order never changes.
 */
export function rowSpans(sizes: readonly Size[]): number[] {
  const spans = sizes.map(spanOf);
  let first = 0;
  let used = 0;
  sizes.forEach((size, i) => {
    if (used + SPAN[size] > COLUMNS && i > first) {
      if (i - 1 > first) spans[i - 1] += COLUMNS - used;
      first = i;
      used = 0;
    }
    used += SPAN[size];
  });
  return spans;
}

/** The size the installer picked in `entities.<id>.size`, when it exists and fits the kind. */
export function chosenSize(options: HubbConfig | undefined, entityId: string, kind: SizedKind): Size | undefined {
  const chosen = options?.entities?.[entityId]?.size;
  return isSize(chosen) && sizesFor(kind).includes(chosen) ? chosen : undefined;
}

/** The size of a card: `entities.<id>.size` when it fits the kind, else the default for the layout and the name. */
export function sizeOf(options: HubbConfig | undefined, entityId: string, kind: SizedKind, layout: Layout = 'phone', name = ''): Size {
  return chosenSize(options, entityId, kind) ?? defaultSize(kind, layout, name);
}
