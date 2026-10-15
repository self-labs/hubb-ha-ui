import { afterEach, describe, expect, it } from 'vitest';
import '../../src/elements/nav-bar';
import { HubbNavBar } from '../../src/elements/nav-bar';

const cssOf = (styles: unknown): string => ([] as unknown[]).concat(styles).map((s) => (s as { cssText: string }).cssText).join('\n');

describe('the bottom bar over a page that scrolls', () => {
  afterEach(() => document.body.replaceChildren());

  it('lays the background of the page under and around the bar, so the cards passing below do not mix with it', async () => {
    const nav = document.createElement('hubb-nav-bar') as HubbNavBar;
    document.body.appendChild(nav);
    await nav.updateComplete;
    const fade = nav.shadowRoot!.querySelector('.fade')!;
    expect(fade.getAttribute('aria-hidden')).toBe('true');
    const css = cssOf(HubbNavBar.styles);
    // From the bottom edge to above the bar, in the colour of the page; taps go through it.
    expect(css).toMatch(/\.fade\s*\{[^}]*position: fixed[^}]*bottom: 0[^}]*pointer-events: none[^}]*var\(--hubb-bg\)/);
    // The bar itself stands out from the cards: a hairline border.
    expect(css).toMatch(/nav\s*\{[^}]*border: 1px solid/);
  });
});
