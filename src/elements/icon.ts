import { html, type TemplateResult } from 'lit';

export const icon = (path: string): TemplateResult =>
  html`<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d=${path}></path></svg>`;
