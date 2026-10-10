export type HapticType = 'success' | 'warning' | 'failure' | 'light' | 'medium' | 'heavy' | 'selection';

/** The Companion App turns this window event into a vibration; a plain browser ignores it. */
export function haptic(type: HapticType): void {
  window.dispatchEvent(new CustomEvent('haptic', { detail: type }));
}
