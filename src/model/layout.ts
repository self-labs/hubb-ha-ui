/**
 * How the panel lays itself out, from the area it has (never the window, so an administrator with
 * Home Assistant's sidebar open gets the right one): the phone, a roomier column (a tablet standing
 * up, a phone on its side), or wide (a tablet on its side, a computer).
 */
export type Layout = 'phone' | 'roomy' | 'wide';

/** Wide from this width, and only this tall or more: a phone on its side is wide but 461 px tall. */
export const WIDE_MIN = 900;
export const WIDE_HEIGHT_MIN = 600;
/** Roomy from this width. */
export const ROOMY_MIN = 600;
/** A layout is left only this far past its threshold, so a width right on the line does not flicker. */
const SLACK = 16;

export function layoutFor(width: number, height: number, prev: Layout): Layout {
  const wideFrom = prev === 'wide' ? WIDE_MIN - SLACK : WIDE_MIN;
  const roomyFrom = prev === 'phone' ? ROOMY_MIN : ROOMY_MIN - SLACK;
  if (width >= wideFrom && height >= WIDE_HEIGHT_MIN) return 'wide';
  if (width >= roomyFrom) return 'roomy';
  return 'phone';
}
