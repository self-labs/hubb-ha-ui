import { afterEach, describe, expect, it } from 'vitest';
import '../../src/elements/nav-bar';
import '../../src/elements/sheet';
import '../../src/elements/toast';
import { HubbNavBar } from '../../src/elements/nav-bar';
import type { HubbSheet } from '../../src/elements/sheet';
import { HubbToast } from '../../src/elements/toast';
import { reportArea, resetLayoutForTests } from '../../src/layout';

const cssOf = (styles: unknown): string =>
  ([] as unknown[]).concat(styles).map((s) => (s as { cssText: string }).cssText).join('\n');

/** An administrator's window: Home Assistant's sidebar takes 256 px and its header 56. */
const WIDE = { left: 256, top: 56, width: 1024, height: 768 };

async function sheet(): Promise<HubbSheet> {
  const el = document.createElement('hubb-sheet') as HubbSheet;
  el.heading = 'Ar';
  el.open = true;
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}

describe('on a wide screen the bar is a rail and a sheet is a window in the middle', () => {
  afterEach(() => {
    resetLayoutForTests();
    document.body.replaceChildren();
  });

  it('the bar becomes a rail down the left side of the area, under the header of Home Assistant', async () => {
    reportArea(WIDE, 824);
    const nav = document.createElement('hubb-nav-bar') as HubbNavBar;
    document.body.appendChild(nav);
    await nav.updateComplete;
    expect(nav.getAttribute('screen-layout')).toBe('wide');
    const css = cssOf(HubbNavBar.styles);
    expect(css).toMatch(/:host\(\[screen-layout='wide'\]\) nav\s*\{[^}]*top: var\(--hubb-area-top, 0px\)[^}]*width: 84px/);
    expect(css).toMatch(/:host\(\[screen-layout='wide'\]\) \.fade,\s*:host\(\[screen-layout='wide'\]\) \.shield\s*\{[^}]*display: none/);
  });

  it('a sheet opens as a window with a close button and no handle to drag', async () => {
    reportArea(WIDE, 824);
    const el = await sheet();
    expect(el.getAttribute('screen-layout')).toBe('wide');
    expect(el.shadowRoot!.querySelector('.grab')).toBeNull();
    const close = el.shadowRoot!.querySelector('.close') as HTMLButtonElement;
    expect(close.getAttribute('aria-label')).toBe('Fechar');
    let closed = 0;
    el.addEventListener('hubb-close', () => closed++);
    close.click();
    expect(closed).toBe(1);
    expect(cssOf((el.constructor as typeof HubbSheet).styles)).toMatch(/:host\(\[screen-layout='wide'\]\) \.sheet\s*\{[^}]*max-width: 520px[^}]*max-height: 80vh/);
  });

  it('turning the tablet with a sheet open keeps it open: it only changes shape', async () => {
    reportArea(WIDE, 824);
    const el = await sheet();
    reportArea({ left: 0, top: 0, width: 768, height: 1024 }, 1024);
    await el.updateComplete;
    expect(el.open).toBe(true);
    expect(el.getAttribute('screen-layout')).toBe('roomy');
    expect(el.shadowRoot!.querySelector('.grab')).not.toBeNull();
    expect(el.shadowRoot!.querySelector('.close')).toBeNull();
  });

  it('the undo sits low and in the middle of the content, right of the rail (or of nothing, put away)', () => {
    expect(cssOf(HubbToast.styles)).toMatch(
      /:host\(\[screen-layout='wide'\]\) \.toast\s*\{[^}]*left: calc\(var\(--hubb-area-left, 0px\) \+ var\(--hubb-rail, 84px\) \+ \(var\(--hubb-area-width, 100vw\) - var\(--hubb-rail, 84px\)\) \/ 2\)/,
    );
  });
});
