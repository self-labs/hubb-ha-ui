import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { HubbToast } from '../../src/elements/toast';
import { navigate } from '../../src/actions/navigate';
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

function house(areaId = 'sala') {
  const h = makeHass({ areas: [area(areaId, 'Sala')], entities: [{ entity_id: 'light.teto', area_id: areaId, name: 'Teto', state: 'on' }] });
  return { h, house: buildHouse(h) };
}

async function room(areaId = 'sala'): Promise<Screen> {
  const { h, house: b } = house(areaId);
  const el = document.createElement('hubb-room-screen') as Screen;
  el.setConfig({ type: 'custom:hubb-room-screen', room: b.rooms[0]!, lightIds: allLightIds(b) });
  el.hass = h;
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}

describe('the screen is the scroller', () => {
  beforeEach(() => {
    history.replaceState(null, '', '/hubb-ui/sala');
    // Whatever the last test did, this one starts as if a tap had opened the page.
    window.dispatchEvent(new CustomEvent('location-changed', { detail: { replace: false } }));
  });
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
    history.replaceState(null, '', '/hubb-ui/home');
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

  // Back from a room, the home was at the top again: a clinic with 24 rooms scrolled down again
  // after every room (Gustavo, 07/11). Home Assistant keeps the view and puts the same screen back,
  // and the browser forgets the place of a box taken off the page.
  it('back to the page Home Assistant kept, it is where the reader left it', async () => {
    const el = await room('kept');
    el.scrollTop = 320;
    el.dispatchEvent(new Event('scroll'));
    el.remove();
    el.scrollTop = 0;
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 60_000);
    window.dispatchEvent(new Event('popstate'));
    document.body.appendChild(el);
    await el.updateComplete;
    expect(el.scrollTop).toBe(320);
  });

  it('back to the page Home Assistant rebuilt meanwhile, it is where the reader left it', async () => {
    let el = await room('rebuilt');
    el.scrollTop = 320;
    el.dispatchEvent(new Event('scroll'));
    el.remove();
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 60_000);
    window.dispatchEvent(new Event('popstate'));
    el = await room('rebuilt');
    await el.updateComplete;
    expect(el.scrollTop).toBe(320);
  });

  it('the same page reached by a tap, not by going back, starts at the top', async () => {
    const el = await room('tapped');
    el.scrollTop = 320;
    el.dispatchEvent(new Event('scroll'));
    el.remove();
    el.scrollTop = 0;
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 120_000);
    navigate('/hubb-ui/tapped', { back: true });
    document.body.appendChild(el);
    await el.updateComplete;
    expect(el.scrollTop).toBe(0);
  });

  it('a room tapped right after going back starts at the top, however quick the tap', async () => {
    const el = await room('quick');
    el.scrollTop = 320;
    el.dispatchEvent(new Event('scroll'));
    el.remove();
    el.scrollTop = 0;
    window.dispatchEvent(new Event('popstate'));
    navigate('/hubb-ui/quick', { back: true });
    document.body.appendChild(el);
    await el.updateComplete;
    expect(el.scrollTop).toBe(0);
  });

  it('back on a slow tablet, whose view takes seconds to come back, still finds its place', async () => {
    const el = await room('slow');
    el.scrollTop = 320;
    el.dispatchEvent(new Event('scroll'));
    el.remove();
    el.scrollTop = 0;
    window.dispatchEvent(new Event('popstate'));
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 10_000);
    document.body.appendChild(el);
    await el.updateComplete;
    expect(el.scrollTop).toBe(320);
  });
});
