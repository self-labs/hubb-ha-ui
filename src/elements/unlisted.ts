import { html, nothing } from 'lit';

/**
 * The first option of a select whose value is none of its choices. Without it the browser shows the
 * first choice, which is not where the device is, and picking that choice then sends nothing (no
 * change event). A value is shown by `word`; no value at all (null, unknown) leaves the line empty.
 */
export function unlisted(current: unknown, choices: readonly string[], word: (value: string) => string) {
  if (typeof current === 'string' && choices.includes(current)) return nothing;
  const known = typeof current === 'string' && current !== '' && current !== 'unknown' && current !== 'unavailable';
  return html`<option value="" disabled selected>${known ? word(current) : ''}</option>`;
}
