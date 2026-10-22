import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as layout from '../src/layout';
import { layoutNow, reportArea, resetLayoutForTests } from '../src/layout';
import { allLightIds, buildHouse } from '../src/model/build-house';
import '../src/screens/home-screen';
import '../src/screens/room-screen';
import type { HubbScreen } from '../src/screens/base';
import { area, makeHass } from './helpers/fake-hass';

function house() {
  return makeHass({
    areas: [area('sala', 'Sala')],
    entities: [{ entity_id: 'light.teto', area_id: 'sala', name: 'Teto', state: 'off' }],
  });
}

async function mount(tag: string, config: Record<string, unknown>, embedded = false): Promise<HubbScreen & { setConfig(c: unknown): void }> {
  const h = house();
  const el = document.createElement(tag) as HubbScreen & { setConfig(c: unknown): void };
  el.setConfig({ type: `custom:${tag}`, ...config });
  if (embedded) el.embedded = true;
  el.hass = h;
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}

describe('a screen knows the area it has', () => {
  beforeEach(() => history.replaceState(null, '', '/hubb-casa/home'));
  afterEach(() => {
    resetLayoutForTests();
    vi.restoreAllMocks();
    document.body.replaceChildren();
  });

  it('reflects the layout and publishes where its area is, for the fixed bar, sheet and toast', async () => {
    // An administrator: the sidebar of Home Assistant takes 256 px and its header 56.
    reportArea({ left: 256, top: 56, width: 1024, height: 768 }, 824);
    const h = house();
    const el = await mount('hubb-home-screen', { house: buildHouse(h) });
    expect(layoutNow()).toBe('wide');
    expect(el.getAttribute('screen-layout')).toBe('wide');
    expect(el.style.getPropertyValue('--hubb-area-left')).toBe('256px');
    expect(el.style.getPropertyValue('--hubb-area-top')).toBe('56px');
    expect(el.style.getPropertyValue('--hubb-area-width')).toBe('1024px');
  });

  it("keeps its layout when Home Assistant gives the card its own (`layout = 'panel'`, seen on his HA 21/10)", async () => {
    reportArea({ left: 56, top: 56, width: 1192, height: 1185 }, 1241);
    const h = house();
    const el = await mount('hubb-home-screen', { house: buildHouse(h) });
    // hui-panel-view sets this on every card it holds.
    (el as unknown as { layout: string }).layout = 'panel';
    await el.updateComplete;
    expect(el.getAttribute('screen-layout')).toBe('wide');
  });

  it('follows a change of layout while on screen (a tablet turned on its side)', async () => {
    const h = house();
    const el = await mount('hubb-home-screen', { house: buildHouse(h) });
    expect(el.getAttribute('screen-layout')).toBe('phone');
    reportArea({ left: 0, top: 0, width: 768, height: 1024 }, 1024);
    await el.updateComplete;
    expect(el.getAttribute('screen-layout')).toBe('roomy');
  });

  it('a page drawn inside another one does not measure: the page that holds it does', async () => {
    const spy = vi.spyOn(layout, 'reportArea');
    const h = house();
    const b = buildHouse(h);
    const el = await mount('hubb-room-screen', { room: b.rooms[0], lightIds: allLightIds(b) }, true);
    expect(el.hasAttribute('embedded')).toBe(true);
    expect(spy).not.toHaveBeenCalled();
  });

  it('a hidden page (width 0, kept by Home Assistant for later) changes nothing', async () => {
    reportArea({ left: 0, top: 0, width: 1280, height: 800 }, 800);
    reportArea({ left: 0, top: 0, width: 0, height: 0 }, 800);
    expect(layoutNow()).toBe('wide');
  });
});
