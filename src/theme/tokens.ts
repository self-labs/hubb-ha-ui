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
    /* The colour of each mode, as in Home Assistant; each passes AA with white on it and 3:1 on the
       surfaces of both themes (test/contrast.test.ts). */
    --hubb-mode-cool: #3478c6;
    --hubb-mode-heat: #b8541b;
    --hubb-mode-auto: #2e8049;
    --hubb-mode-dry: #9a6f00;
    --hubb-mode-fan: #1f7a84;
    --hubb-mode-off: #7a868e;
    /* The ink of each mode: its words and icons over its tint on the dark surface (proposal A, Gustavo
       23/10), 4.5:1 on the surface and over the tint (test/contrast.test.ts). */
    --hubb-mode-cool-ink: #8db9ec;
    --hubb-mode-heat-ink: #f2a675;
    --hubb-mode-auto-ink: #82cb9b;
    --hubb-mode-dry-ink: #e5c463;
    --hubb-mode-fan-ink: #6cc6cd;
    --hubb-mode-off-ink: #8e9aa2;
    /* The alert strip and a triggered alarm: the one red of the panel. */
    --hubb-alert-bg: #c62828;
    --hubb-alert-ink: #ffffff;
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
    /* The colour of each mode, as in Home Assistant; each passes AA with white on it and 3:1 on the
       surfaces of both themes (test/contrast.test.ts). */
    --hubb-mode-cool: #3478c6;
    --hubb-mode-heat: #b8541b;
    --hubb-mode-auto: #2e8049;
    --hubb-mode-dry: #9a6f00;
    --hubb-mode-fan: #1f7a84;
    --hubb-mode-off: #58646c;
    --hubb-mode-cool-ink: #22548f;
    --hubb-mode-heat-ink: #8a3a0f;
    --hubb-mode-auto-ink: #1f5c33;
    --hubb-mode-dry-ink: #6f5000;
    --hubb-mode-fan-ink: #17626a;
    --hubb-mode-off-ink: #58646c;
    --hubb-alert-bg: #b71c1c;
    --hubb-alert-ink: #ffffff;
  }
  @media (prefers-reduced-motion: reduce) {
    :host {
      --hubb-motion: 0ms;
    }
  }
`;
