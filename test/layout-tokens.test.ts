import { describe, expect, it } from 'vitest';
import { HubbNavBar } from '../src/elements/nav-bar';
import { HubbStatusStrips } from '../src/elements/status-strips';
import { HubbToast } from '../src/elements/toast';
import { HubbScreen } from '../src/screens/base';
import { HubbHomeScreen } from '../src/screens/home-screen';
import { HubbRoomScreen } from '../src/screens/room-screen';
import { HubbScenesScreen } from '../src/screens/scenes-screen';
import { gridSpans, layoutStyles } from '../src/theme/layout';

const cssOf = (styles: unknown): string =>
  ([] as unknown[]).concat(styles).map((s) => (s as { cssText: string }).cssText).join('\n');

const sources = import.meta.glob('../src/**/*.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

describe('one column width for the whole panel, wider as the area grows', () => {
  it('no screen or element caps its width with a number of its own', () => {
    const stray = Object.entries(sources)
      .filter(([path, text]) => !path.endsWith('/theme/layout.ts') && /max-width:\s*(560|536|528)px/.test(text))
      .map(([path]) => path);
    expect(stray).toEqual([]);
  });

  it('the column is 560 on a phone, 760 roomy and 880 wide', () => {
    expect(cssOf(HubbScreen.baseStyles)).toMatch(/main\s*\{[^}]*max-width: var\(--hubb-col, 560px\)/);
    const css = cssOf(layoutStyles);
    expect(css).toMatch(/:host\(\[screen-layout='roomy'\]\)\s*\{[^}]*--hubb-col: 760px/);
    expect(css).toMatch(/:host\(\[screen-layout='wide'\]\)\s*\{[^}]*--hubb-col: 880px/);
  });

  it('roomy and wide grids have twelve columns: four small cards a row', () => {
    const css = cssOf(gridSpans);
    expect(css).toMatch(/:host\(\[screen-layout='roomy'\]\) \.grid[^{]*\{[^}]*grid-template-columns: repeat\(12, minmax\(0, 1fr\)\)/);
    expect(css).toMatch(/:host\(\[screen-layout='wide'\]\) \.grid > \.size-small[^{]*\{[^}]*grid-column: span 3/);
    expect(css).toMatch(/:host\(\[screen-layout='roomy'\]\) \.list > \.size-medium[^{]*\{[^}]*grid-column: span 6/);
    expect(css).toMatch(/:host\(\[screen-layout='wide'\]\) \.grid > \.size-large[^{]*\{[^}]*grid-column: 1 \/ -1/);
  });

  it('the room page and Cenas take the twelve columns, and keep six on a phone', () => {
    for (const styles of [HubbRoomScreen.styles, HubbScenesScreen.styles]) {
      const css = cssOf(styles);
      expect(css).toContain(cssOf(gridSpans));
      expect(css).toContain(cssOf(layoutStyles));
      expect(css).toMatch(/repeat\(6, minmax\(0, 1fr\)\)/);
    }
  });

  it('the home shows three rooms a row when roomy', () => {
    expect(cssOf(HubbHomeScreen.styles)).toMatch(/:host\(\[screen-layout='roomy'\]\) \.rooms\s*\{[^}]*grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
  });

  it('the bar and the undo sit in the middle of the area, not of the window (the sidebar of an administrator)', () => {
    const middle = /left: calc\(var\(--hubb-area-left, 0px\) \+ var\(--hubb-area-width, 100vw\) \/ 2\)/;
    expect(cssOf(HubbNavBar.styles)).toMatch(middle);
    expect(cssOf(HubbNavBar.styles)).toMatch(/nav\s*\{[^}]*width: min\(calc\(var\(--hubb-area-width, 100vw\) - 24px\), calc\(var\(--hubb-col, 560px\) - 24px\)\)/);
    expect(cssOf(HubbToast.styles)).toMatch(middle);
    expect(cssOf(HubbToast.styles)).toMatch(/width: min\(calc\(var\(--hubb-area-width, 100vw\) - 32px\), calc\(var\(--hubb-col, 560px\) - 32px\)\)/);
    expect(cssOf(HubbStatusStrips.styles)).toMatch(/max-width: calc\(var\(--hubb-col, 560px\) - 32px\)/);
  });

  it('the fade under the bar covers the area only', () => {
    expect(cssOf(HubbNavBar.styles)).toMatch(/\.fade\s*\{[^}]*left: var\(--hubb-area-left, 0px\)[^}]*width: var\(--hubb-area-width, 100vw\)/);
  });
});
