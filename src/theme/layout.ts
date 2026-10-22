import { css } from 'lit';

/**
 * The width of the column, by layout (`src/model/layout.ts`): the one number the page, the bar, the
 * undo and the strips start from. Elements fixed to the screen also read where the area of the panel
 * sits (`--hubb-area-left`, `--hubb-area-top`, `--hubb-area-width`, set by `HubbScreen`), so they
 * line up with it when Home Assistant's sidebar takes part of the window.
 */
export const layoutStyles = css`
  :host([screen-layout='roomy']) {
    --hubb-col: 760px;
  }
  :host([screen-layout='wide']) {
    --hubb-col: 880px;
  }
  /* The rail of the bar (src/elements/nav-bar.ts) takes the left 84 px of a wide screen. */
  :host([screen-layout='wide']:not([embedded])) {
    box-sizing: border-box;
    padding-left: 84px;
  }
  :host([screen-layout='wide'][rail-hidden]:not([embedded])) {
    padding-left: 0;
  }
`;

/**
 * Roomy and wide grids have twelve columns: a small card takes three (four a row), a medium one six,
 * a large one the row. The phone keeps the six columns of each screen. The rules name the size class,
 * like the phone ones: an edit tile resets its own styles with `all: unset`.
 */
export const gridSpans = css`
  :host([screen-layout='roomy']) .grid,
  :host([screen-layout='wide']) .grid,
  :host([screen-layout='roomy']) .list,
  :host([screen-layout='wide']) .list {
    grid-template-columns: repeat(12, minmax(0, 1fr));
  }
  :host([screen-layout='roomy']) .grid > .size-small,
  :host([screen-layout='wide']) .grid > .size-small,
  :host([screen-layout='roomy']) .list > .size-small,
  :host([screen-layout='wide']) .list > .size-small {
    grid-column: span 3;
  }
  :host([screen-layout='roomy']) .grid > .size-medium,
  :host([screen-layout='wide']) .grid > .size-medium,
  :host([screen-layout='roomy']) .list > .size-medium,
  :host([screen-layout='wide']) .list > .size-medium {
    grid-column: span 6;
  }
  :host([screen-layout='roomy']) .grid > .size-large,
  :host([screen-layout='wide']) .grid > .size-large,
  :host([screen-layout='roomy']) .list > .size-large,
  :host([screen-layout='wide']) .list > .size-large {
    grid-column: 1 / -1;
  }
`;
