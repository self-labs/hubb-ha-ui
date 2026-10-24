import { html, nothing } from 'lit';

/**
 * The first option of a select whose value is none of its choices. Without it the browser shows the
 * first choice, which is not where the device is, and picking that choice then sends nothing (no
 * change event). A value is shown by `word`; no value at all (null, unknown) leaves the line empty.
 */
export function unlisted(current: unknown, choices: readonly string[], word: (value: string) => string) {
  if (typeof current === 'string' && choices.includes(current)) return nothing;
  return html`<option value="" disabled selected>${reported(current) ? word(current) : ''}</option>`;
}

/** A value the device reports: not empty, unknown or unavailable. */
export const reported = (v: unknown): v is string => typeof v === 'string' && v !== '' && v !== 'unknown' && v !== 'unavailable';
