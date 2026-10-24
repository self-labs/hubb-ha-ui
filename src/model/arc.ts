/**
 * The arc of an air conditioner's sheet, as the card of Home Assistant draws it: 270 degrees open at
 * the bottom, from the lowest target the device takes (lower left) to the highest (lower right).
 * Angles are degrees clockwise from the x axis of the screen (y grows down), so the top is 270.
 */
export const ARC_START = 135;
export const ARC_SWEEP = 270;

const clamp = (v: number, min: number, max: number): number => Math.min(max, Math.max(min, v));

/** The angle of a target on the arc; one outside the limits stays at the end. */
export function valueToAngle(value: number, min: number, max: number): number {
  const share = max > min ? clamp((value - min) / (max - min), 0, 1) : 0;
  return ARC_START + ARC_SWEEP * share;
}

/** The target at an angle of the arc, rounded to the step and kept inside the limits. */
export function angleToValue(angle: number, min: number, max: number, step: number): number {
  const share = clamp((angle - ARC_START) / ARC_SWEEP, 0, 1);
  const rounded = Math.round((min + share * (max - min)) / step) * step;
  return clamp(rounded, min, max);
}

/**
 * The angle of a finger at (x, y) around the centre, on the arc's own scale (135 to 405). In the gap
 * at the bottom it goes to the nearest end, so a finger slipping past an end holds it.
 */
export function pointToAngle(x: number, y: number, cx: number, cy: number): number {
  const raw = (Math.atan2(y - cy, x - cx) * 180) / Math.PI;
  const full = raw < 0 ? raw + 360 : raw;
  const onArc = full >= ARC_START ? full : full + 360;
  const end = ARC_START + ARC_SWEEP;
  if (onArc <= end) return onArc;
  // The gap runs from the end (45 degrees) to the start (135), the bottom (90) halfway.
  return onArc <= end + (360 - ARC_SWEEP) / 2 ? end : ARC_START;
}

/** Whether a finger at (x, y) is in the gap at the bottom, between the two ends. */
export function inGap(x: number, y: number, cx: number, cy: number): boolean {
  const raw = (Math.atan2(y - cy, x - cx) * 180) / Math.PI;
  return raw > ARC_START + ARC_SWEEP - 360 && raw < ARC_START;
}

const fmt = (n: number): string => String(Number(n.toFixed(2)));

/** The SVG path of the arc from one angle to another, clockwise. */
export function arcPath(cx: number, cy: number, r: number, from: number, to: number): string {
  const at = (deg: number): [number, number] => [cx + r * Math.cos((deg * Math.PI) / 180), cy + r * Math.sin((deg * Math.PI) / 180)];
  const [x1, y1] = at(from);
  const [x2, y2] = at(to);
  const large = to - from > 180 ? 1 : 0;
  return `M ${fmt(x1)} ${fmt(y1)} A ${fmt(r)} ${fmt(r)} 0 ${large} 1 ${fmt(x2)} ${fmt(y2)}`;
}

/**
 * The lowest and highest target of a device and the step of the panel: whole degrees in every mode,
 * like a remote control (Gustavo, 15/10), even when the device takes half degrees. A device that does
 * not say its limits gets those of Home Assistant (7 and 35).
 */
export function targetLimits(attrs: Readonly<Record<string, unknown>>): { min: number; max: number; step: number } {
  const num = (v: unknown, fallback: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
  return {
    min: num(attrs.min_temp, 7),
    max: num(attrs.max_temp, 35),
    step: Math.max(Number(attrs.target_temp_step) || 1, 1),
  };
}
