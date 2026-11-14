import { css } from 'lit';

/** How long a press lasts to count as a hold, in milliseconds. */
export const HOLD_MS = 500;

/**
 * How long a press lasts before the fill shows. A plain tap ends well before it, so a tap never flashes
 * the bar: only a press that really goes on is drawn as a hold.
 */
export const HOLD_SHOW_MS = 180;

/**
 * The fill that grows across a tile while it is held, so the resident sees the hold registering. The
 * tile needs `position: relative; overflow: hidden` and the `holding` class, which it sets HOLD_SHOW_MS
 * into the press; the fill then takes the rest of HOLD_MS, so it is full when the command goes out.
 */
export const holdFill = css`
  .tile.holding::after {
    content: '';
    position: absolute;
    inset: 0;
    background: color-mix(in srgb, var(--hubb-amber) 28%, transparent);
    transform-origin: left;
    animation: hubb-hold ${HOLD_MS - HOLD_SHOW_MS}ms linear forwards;
    pointer-events: none;
  }
  @keyframes hubb-hold {
    from {
      transform: scaleX(0);
    }
    to {
      transform: scaleX(1);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .tile.holding::after {
      animation: none;
      transform: none;
      opacity: 0.5;
    }
  }
`;
