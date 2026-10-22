import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { HubbToast } from '../../src/elements/toast';
import { reportArea, resetLayoutForTests } from '../../src/layout';
import { allLightIds, buildHouse } from '../../src/model/build-house';
import '../../src/screens/home-screen';
import '../../src/screens/room-screen';
import type { HubbScreen } from '../../src/screens/base';
import { resetSelectionForTests } from '../../src/selection';
import { flush } from '../helpers/fake-dashboard';
import { area, makeHass, type FakeHass } from '../helpers/fake-hass';

// What the iPad Mini 5 lying down showed on 21/10: the clock card wider than its column (a sideways
// scroll), the bars of the scrollers, an empty row of chips and a room header with a hole under it.

type Screen = HubbScreen & { setConfig(c: unknown): void };

const cssOf = (tag: string): string =>
  ([] as unknown[])
    .concat((customElements.get(tag) as unknown as { styles: unknown }).styles)
    .map((s) => (s as { cssText: string }).cssText)
    .join('\n');

function house(): FakeHass {
  const h = makeHass({
    areas: [area('quarto', 'Quarto'), area('sala', 'Sala')],
    entities: [
      { entity_id: 'light.cama', area_id: 'quarto', name: 'Cama', state: 'off' },
      { entity_id: 'light.teto', area_id: 'sala', name: 'Teto', state: 'off' },
    ],
  });
  h.states['weather.casa'] = { entity_id: 'weather.casa', state: 'cloudy', attributes: { temperature: 23, supported_features: 3 } };
  h.entities['weather.casa'] = { ...h.entities['light.teto']!, entity_id: 'weather.casa', area_id: null, name: 'Casa' };
  return h;
}

async function mountHome(h: FakeHass): Promise<Screen> {
  const el = document.createElement('hubb-home-screen') as Screen;
  el.setConfig({ type: 'custom:hubb-home-screen', house: buildHouse(h) });
  el.hass = h;
  document.body.appendChild(el);
  await flush();
  await el.updateComplete;
  return el;
}

describe('the wide home on an iPad Mini 5 lying down (1024 x 768)', () => {
  beforeEach(() => {
    history.replaceState(null, '', '/hubb-casa/home');
    reportArea({ left: 0, top: 0, width: 1024, height: 768 }, 768);
  });
  afterEach(() => {
    resetLayoutForTests();
    resetSelectionForTests();
    for (const el of document.querySelectorAll('hubb-home-screen, hubb-room-screen')) {
      (el.shadowRoot?.querySelector('hubb-toast') as HubbToast | null)?.hide();
    }
    document.body.replaceChildren();
  });

  it('the clock card puts the next hours on a row of their own, under the time and the weather now', async () => {
    const el = await mountHome(house());
    const card = el.shadowRoot!.querySelector('aside.side .clock-card')!;
    const top = card.querySelector('.clock-top')!;
    expect(top.querySelector('hubb-clock')).not.toBeNull();
    expect(top.querySelector('hubb-weather-now')!.getAttribute('show')).toBe('now');
    expect(card.querySelector(':scope > hubb-weather-now')!.getAttribute('show')).toBe('hours');
  });

  it('never scrolls sideways, and neither column shows a scroll bar', () => {
    const css = cssOf('hubb-home-screen');
    for (const scroller of ['side', 'pane']) {
      // A rule may name both scrollers (".side, .pane {").
      expect(css, scroller).toMatch(new RegExp(`\\.${scroller}[^{]*\\{[^}]*overflow-x: hidden`));
      expect(css, scroller).toMatch(new RegExp(`\\.${scroller}[^{]*\\{[^}]*scrollbar-width: none`));
      expect(css, scroller).toMatch(new RegExp(`\\.${scroller}::-webkit-scrollbar[^{]*\\{[^}]*display: none`));
    }
    // The room on the right scrolls by itself: the page under both columns never does.
    expect(css).toMatch(/\.pane[^{]*\{[^}]*overflow-y: auto/);
  });

  it('with no appliance running, no empty row of chips under the pills', async () => {
    const el = await mountHome(house());
    expect(el.shadowRoot!.querySelector('aside.side .chips')).toBeNull();
  });

  it('the room on the right starts at the top: "Apagar tudo" and its scenes sit in the header, beside the drawing', async () => {
    const h = house();
    const b = buildHouse(h);
    const el = document.createElement('hubb-room-screen') as Screen;
    el.setConfig({ type: 'custom:hubb-room-screen', room: b.rooms[0]!, lightIds: allLightIds(b) });
    el.embedded = true;
    el.hass = h;
    document.body.appendChild(el);
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.hero .actions')).not.toBeNull();
    expect(el.shadowRoot!.querySelector('main > .actions')).toBeNull();
    expect(cssOf('hubb-room-screen')).toMatch(/:host\(\[screen-layout='wide'\]\) \.hero\s*\{[^}]*align-items: flex-start/);
  });
});
