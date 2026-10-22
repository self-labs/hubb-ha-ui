import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { HubbNavBar } from '../../src/elements/nav-bar';
import type { HubbToast } from '../../src/elements/toast';
import { railHidden, reportArea, resetLayoutForTests } from '../../src/layout';
import { buildHouse } from '../../src/model/build-house';
import '../../src/screens/home-screen';
import '../../src/screens/scenes-screen';
import type { HubbScreen } from '../../src/screens/base';
import { resetSelectionForTests } from '../../src/selection';
import { layoutStyles } from '../../src/theme/layout';
import { flush } from '../helpers/fake-dashboard';
import { area, makeHass } from '../helpers/fake-hass';

// The rail of the wide layout (Casa, Cenas, Segurança) can be put away, and a handle on the left edge
// brings it back. The column of the house stays (Gustavo, 21/10: "o que quero esconder é a barra").

type Screen = HubbScreen & { setConfig(c: unknown): void };

const cssOf = (styles: unknown): string =>
  ([] as unknown[]).concat(styles).map((s) => (s as { cssText: string }).cssText).join('\n');

async function home(): Promise<Screen> {
  const h = makeHass({ areas: [area('sala', 'Sala')], entities: [{ entity_id: 'light.teto', area_id: 'sala', name: 'Teto', state: 'on' }] });
  const el = document.createElement('hubb-home-screen') as Screen;
  el.setConfig({ type: 'custom:hubb-home-screen', house: buildHouse(h) });
  el.hass = h;
  document.body.appendChild(el);
  await flush();
  await el.updateComplete;
  return el;
}

async function nav(el: Screen): Promise<HubbNavBar> {
  const bar = el.shadowRoot!.querySelector('hubb-nav-bar') as HubbNavBar;
  await bar.updateComplete;
  return bar;
}

async function tap(el: Screen, selector: string): Promise<void> {
  const bar = await nav(el);
  (bar.shadowRoot!.querySelector(selector) as HTMLButtonElement).click();
  await el.updateComplete;
  await bar.updateComplete;
}

describe('putting the rail away', () => {
  beforeEach(() => {
    history.replaceState(null, '', '/hubb-casa/home');
    reportArea({ left: 0, top: 0, width: 1024, height: 768 }, 768);
  });
  afterEach(() => {
    resetLayoutForTests();
    resetSelectionForTests();
    for (const el of document.querySelectorAll('hubb-home-screen, hubb-scenes-screen')) (el.shadowRoot?.querySelector('hubb-toast') as HubbToast | null)?.hide();
    document.body.replaceChildren();
  });

  it('a button at the foot of the rail puts it away; the column of the house stays', async () => {
    const el = await home();
    const bar = await nav(el);
    expect(bar.shadowRoot!.querySelector('button.rail-hide')!.getAttribute('aria-label')).toBe('Esconder as abas');
    await tap(el, 'button.rail-hide');
    expect(bar.shadowRoot!.querySelector('nav')).toBeNull();
    expect(bar.shadowRoot!.querySelector('button.rail-show')!.getAttribute('aria-label')).toBe('Mostrar as abas');
    expect(el.hasAttribute('rail-hidden')).toBe(true);
    expect(el.shadowRoot!.querySelector('aside.side')).not.toBeNull();
  });

  it('the handle on the left edge brings it back', async () => {
    const el = await home();
    await tap(el, 'button.rail-hide');
    await tap(el, 'button.rail-show');
    const bar = await nav(el);
    expect(bar.shadowRoot!.querySelector('nav')).not.toBeNull();
    expect(el.hasAttribute('rail-hidden')).toBe(false);
  });

  it('stays away on every screen and through a rebuild, and the device remembers it', async () => {
    let el = await home();
    await tap(el, 'button.rail-hide');
    el.remove();
    el = await home();
    expect((await nav(el)).shadowRoot!.querySelector('nav')).toBeNull();
    expect(window.localStorage.getItem('hubb-rail:/hubb-casa')).toBe('hidden');
    const scenes = document.createElement('hubb-scenes-screen') as Screen;
    scenes.setConfig({ type: 'custom:hubb-scenes-screen', scenes: [], lightIds: [] });
    scenes.hass = makeHass({ areas: [], entities: [] });
    document.body.appendChild(scenes);
    await scenes.updateComplete;
    expect(scenes.hasAttribute('rail-hidden')).toBe(true);
  });

  it('on a phone and on a tablet upright the bar at the bottom never goes away', async () => {
    let el = await home();
    await tap(el, 'button.rail-hide');
    expect(railHidden()).toBe(true);
    el.remove();
    reportArea({ left: 0, top: 0, width: 768, height: 1024 }, 1024);
    el = await home();
    const bar = await nav(el);
    expect(bar.shadowRoot!.querySelector('nav')).not.toBeNull();
    expect(bar.shadowRoot!.querySelector('button.rail-hide, button.rail-show')).toBeNull();
  });

  it('the screens take the room of the rail, and the column leaves room for the handle', () => {
    expect(cssOf(layoutStyles)).toMatch(/:host\(\[screen-layout='wide'\]\[rail-hidden\]:not\(\[embedded\]\)\)\s*\{[^}]*padding-left: 0/);
    expect(cssOf((customElements.get('hubb-home-screen') as unknown as { styles: unknown }).styles)).toMatch(
      /:host\(\[rail-hidden\]\) \.side\s*\{[^}]*padding-left: 40px/,
    );
  });
});
