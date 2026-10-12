import { css, html, type TemplateResult } from 'lit';
import { unsafeSVG } from 'lit/directives/unsafe-svg.js';
import { DRAWINGS, type ArtId } from './drawings';

/**
 * A room drawing for the right side of a card or a header. The markup is ours, bundled, and kept to
 * plain shapes by test/art/drawings.test.ts: that is what makes unsafeSVG acceptable here.
 */
export function roomArt(id: ArtId): TemplateResult {
  return html`<svg class="art" viewBox="0 0 140 100" aria-hidden="true" focusable="false"><g fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${unsafeSVG(DRAWINGS[id])}</g></svg>`;
}

/** How a drawing looks: the theme line colour, fading in from the left; `.lit` on a parent turns its lamp on. */
export const artStyles = css`
  .art {
    position: absolute;
    color: var(--hubb-art);
    -webkit-mask-image: linear-gradient(to right, transparent 0%, #000 38%);
    mask-image: linear-gradient(to right, transparent 0%, #000 38%);
    pointer-events: none;
  }
  .lit {
    --glow: var(--hubb-art-glow);
  }
  .lit .art {
    filter: drop-shadow(0 0 6px color-mix(in srgb, var(--hubb-art-glow) 55%, transparent));
  }
`;
