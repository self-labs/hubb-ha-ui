import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { HubbToast } from '../../src/elements/toast';
import { reportArea, resetLayoutForTests } from '../../src/layout';
import { allLightIds, buildHouse } from '../../src/model/build-house';
import '../../src/screens/home-screen';
import '../../src/screens/room-screen';
import { HubbScreen } from '../../src/screens/base';
import { resetSelectionForTests } from '../../src/selection';
import { flush } from '../helpers/fake-dashboard';
import { area, makeHass } from '../helpers/fake-hass';

// The screen scrolls by itself, with no scroll bar, on a phone and on a tablet upright too (Gustavo,
// 21/10): the page of Home Assistant under it never does. A rebuild of Home Assistant keeps the place.

type Screen = HubbScreen & { setConfig(c: unknown): void };

const cssOf = (styles: unknown): string =>
  ([] as unknown[]).concat(styles).map((s) => (s as { cssText: string }).cssText).join('\n');

function house() {
  const h = makeHass({ areas: [area('sala', 'Sala')], entities: [{ entity_id: 'light.teto', area_id: 'sala', name: 'Teto', state: 'on' }] });
  return { h, house: buildHouse(h) };
}

async function room(): Promise<Screen> {
  const { h, house: b } = house();
  const el = document.createElement('hubb-room-screen') as Screen;
  el.setConfig({ type: 'custom:hubb-room-screen', room: b.rooms[0]!, lightIds: allLightIds(b) });
  el.hass = h;
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}

describe('the screen is the scroller', () => {
  beforeEach(() => history.replaceState(null, '', '/hubb-casa/sala'));
  afterEach(() => {
    vi.restoreAllMocks();
    resetLayoutForTests();
    resetSelectionForTests();
    for (const el of document.querySelectorAll('hubb-home-screen, hubb-room-screen')) (el.shadowRoot?.querySelector('hubb-toast') as HubbToast | null)?.hide();
    document.body.replaceChildren();
  });

  it('is as tall as the area, scrolls by itself, never sideways and with no bar', () => {
    const host = cssOf(HubbScreen.baseStyles).match(/:host\(:not\(\[embedded\]\)\)\s*\{[^}]*\}/)![0];
    expect(host).toContain('height: calc(100vh - var(--hubb-area-top, 0px))');
    expect(host).toContain('height: calc(100dvh - var(--hubb-area-top, 0px))');
    expect(host).toContain('overflow-y: auto');
    expect(host).toContain('overflow-x: hidden');
    expect(host).toContain('scrollbar-width: none');
    expect(host).toContain('overscroll-behavior: contain');
  });

  it('no part of the panel that scrolls shows a bar, the sheets included', () => {
    // Scrolling to see more is what the resident expects; a bar is only noise (Gustavo, 24/10, the
    // sheet of a speaker showed one).
    const sources = import.meta.glob('../../src/**/*.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
    const bars = Object.entries(sources).flatMap(([file, text]) =>
      (text.match(/[^{}]*\{[^{}]*\}/g) ?? [])
        .filter((block) => /overflow(-[xy])?:\s*auto/.test(block) && !/scrollbar-width:\s*none/.test(block))
        .map((block) => `${file}: ${block.split('{')[0]!.trim()}`),
    );
    expect(bars).toEqual([]);
  });

  it('a rebuild of Home Assistant keeps the place on the page', async () => {
    let el = await room();
    el.scrollTop = 320;
    el.dispatchEvent(new Event('scroll'));
    el.remove();
    el = await room();
    await el.updateComplete;
    expect(el.scrollTop).toBe(320);
  });

  it('opened again later, the page starts at the top', async () => {
    let el = await room();
    el.scrollTop = 320;
    el.dispatchEvent(new Event('scroll'));
    el.remove();
    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now + 60_000);
    el = await room();
    await el.updateComplete;
    expect(el.scrollTop).toBe(0);
  });

  it('wide, both columns keep their place through a rebuild', async () => {
    history.replaceState(null, '', '/hubb-casa/home');
    reportArea({ left: 0, top: 0, width: 1280, height: 800 }, 800);
    const mount = async (): Promise<Screen> => {
      const { h, house: b } = house();
      const el = document.createElement('hubb-home-screen') as Screen;
      el.setConfig({ type: 'custom:hubb-home-screen', house: b });
      el.hass = h;
      document.body.appendChild(el);
      await flush();
      await el.updateComplete;
      return el;
    };
    let el = await mount();
    (el.shadowRoot!.querySelector('.side') as HTMLElement).scrollTop = 200;
    (el.shadowRoot!.querySelector('.pane') as HTMLElement).scrollTop = 150;
    el.shadowRoot!.querySelector('.pane')!.dispatchEvent(new Event('scroll'));
    el.remove();
    el = await mount();
    await el.updateComplete;
    expect((el.shadowRoot!.querySelector('.side') as HTMLElement).scrollTop).toBe(200);
    expect((el.shadowRoot!.querySelector('.pane') as HTMLElement).scrollTop).toBe(150);
  });
});
