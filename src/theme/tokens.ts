import { css } from 'lit';

/**
 * Declared only by screens and standalone cards. Inner elements read the variables, so the theme
 * attribute on the screen switches every child at once.
 */
export const tokens = css`
  :host {
    --hubb-bg: #10161a;
    --hubb-surface: #1b242a;
    --hubb-surface-2: #25313a;
    --hubb-sheet: #182027;
    --hubb-text: #e3e0d9;
    --hubb-text-2: #8e9aa2;
    --hubb-amber: #f2c98a;
    --hubb-amber-ink: #2a2620;
    --hubb-amber-tint: rgba(242, 201, 138, 0.3);
    /* Amber for text: --hubb-amber is a fill and glow colour and fails AA as small text in Areia. */
    --hubb-amber-text: #f2c98a;
    --hubb-toast-action: #7a4e10;
    --hubb-on-bg: #2a2620;
    --hubb-primary-bg: #e3e0d9;
    --hubb-primary-ink: #1b1f22;
    --hubb-backdrop: rgba(8, 10, 12, 0.6);
    --hubb-card-shadow: none;
    /* Room drawings: the line follows the theme, the lamp glows the same amber in both. */
    --hubb-art: rgba(227, 224, 217, 0.32);
    --hubb-art-glow: #f2c98a;
    /* Focus rings: 3:1 or more on every surface of the theme (the Areia amber was not). */
    --hubb-focus: #f2c98a;
    --hubb-radius: 16px;
    --hubb-radius-sheet: 24px;
    --hubb-motion: 200ms;
    --hubb-font: 'Manrope Variable', Manrope, system-ui, sans-serif;
  }
  :host([theme='light']) {
    --hubb-bg: #ebe8e2;
    --hubb-surface: #f8f6f2;
    --hubb-surface-2: #e6e2da;
    --hubb-sheet: #f8f6f2;
    --hubb-text: #293a44;
    /* Darker than the first Areia grey (#6e7a82), which failed AA on every light surface. */
    --hubb-text-2: #58646c;
    --hubb-amber: #e0a54b;
    /* Dark ink on the amber, as in Ardósia: white on #e0a54b was 2.2:1. */
    --hubb-amber-ink: #2a2620;
    --hubb-amber-tint: rgba(224, 165, 75, 0.3);
    --hubb-amber-text: #8a5a12;
    --hubb-toast-action: #f2c98a;
    --hubb-on-bg: #fbf1df;
    --hubb-primary-bg: #293a44;
    --hubb-primary-ink: #e3e0d9;
    --hubb-backdrop: rgba(41, 58, 68, 0.35);
    /* Areia: a light surface on a light background needs a soft edge, not a dark gradient. */
    --hubb-card-shadow: 0 1px 3px rgba(41, 58, 68, 0.1);
    --hubb-art: rgba(41, 58, 68, 0.28);
    --hubb-focus: #8a5a12;
  }
  @media (prefers-reduced-motion: reduce) {
    :host {
      --hubb-motion: 0ms;
    }
  }
`;
