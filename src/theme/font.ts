import manropeUrl from '@fontsource-variable/manrope/files/manrope-latin-wght-normal.woff2';

const STYLE_ID = 'hubb-ha-ui-font';
export const FONT_FAMILY = "'Manrope Variable'";

/**
 * @font-face inside a shadow root is ignored by Chrome, so the face goes into the document head.
 * The build inlines the file, because HACS serves only hubb-ha-ui.js.
 */
export function ensureFont(doc: Document = document): void {
  if (doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `@font-face{font-family:${FONT_FAMILY};font-style:normal;font-display:swap;font-weight:200 800;src:url(${manropeUrl}) format('woff2');}`;
  doc.head.appendChild(style);
}
