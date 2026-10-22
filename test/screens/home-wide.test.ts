import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setEditing } from '../../src/editing';
import type { HubbToast } from '../../src/elements/toast';
import { reportArea, resetLayoutForTests } from '../../src/layout';
import { buildHouse } from '../../src/model/build-house';
import '../../src/screens/home-screen';
import type { HubbScreen } from '../../src/screens/base';
import { resetSelectionForTests } from '../../src/selection';
import { admin, flush } from '../helpers/fake-dashboard';
import { area, makeHass, type FakeHass } from '../helpers/fake-hass';

type Screen = HubbScreen & { setConfig(c: unknown): void };

function house(): FakeHass {
  return makeHass({
    areas: [area('cozinha', 'Cozinha'), area('quarto', 'Quarto'), area('sala', 'Sala')],
    entities: [
      { entity_id: 'light.bancada', area_id: 'cozinha', name: 'Bancada', state: 'off' },
      { entity_id: 'light.cama', area_id: 'quarto', name: 'Cama', state: 'off' },
      { entity_id: 'light.teto', area_id: 'sala', name: 'Teto', state: 'on' },
    ],
  });
}

async function mount(h: FakeHass, options?: Record<string, unknown>): Promise<Screen> {
  const el = document.createElement('hubb-home-screen') as Screen;
  el.setConfig({ type: 'custom:hubb-home-screen', house: buildHouse(h), ...(options ? { options } : {}) });
  el.hass = h;
  document.body.appendChild(el);
  await flush();
  await el.updateComplete;
  return el;
}

const embeddedRoom = (el: Screen) =>
  el.shadowRoot!.querySelector('section.pane hubb-room-screen[embedded]') as (HTMLElement & { config: { room: { areaId: string } } }) | null;

describe('the wide home: the house on the left, a room on the right', () => {
  beforeEach(() => {
    history.replaceState(null, '', '/hubb-casa/home');
    reportArea({ left: 0, top: 0, width: 1280, height: 800 }, 800);
  });
  afterEach(() => {
    setEditing(false);
    resetLayoutForTests();
    resetSelectionForTests();
    for (const el of document.querySelectorAll('hubb-home-screen')) (el.shadowRoot?.querySelector('hubb-toast') as HubbToast | null)?.hide();
    document.body.replaceChildren();
  });

  it('draws the column of the house and the room with a light on beside it', async () => {
    const el = await mount(house());
    expect(el.shadowRoot!.querySelector('aside.side')).not.toBeNull();
    expect(el.shadowRoot!.querySelectorAll('aside.side hubb-room-card[variant="row"]')).toHaveLength(3);
    expect(embeddedRoom(el)?.config.room.areaId).toBe('sala');
    expect(el.shadowRoot!.querySelector('aside.side hubb-room-card[selected]')?.getAttribute('data-area')).toBe('sala');
  });

  it('a tap on a room shows it on the right without leaving the page, and a rebuild keeps it', async () => {
    const h = house();
    let el = await mount(h);
    const row = [...el.shadowRoot!.querySelectorAll('aside.side hubb-room-card')].find((r) => r.getAttribute('data-area') === 'cozinha') as HTMLElement & {
      updateComplete: Promise<unknown>;
    };
    await row.updateComplete;
    (row.shadowRoot!.querySelector('button') as HTMLButtonElement).click();
    await el.updateComplete;
    expect(embeddedRoom(el)?.config.room.areaId).toBe('cozinha');
    expect(location.pathname).toBe('/hubb-casa/home');
    el.remove();
    el = await mount(h);
    expect(embeddedRoom(el)?.config.room.areaId).toBe('cozinha');
  });

  it('in the edit mode the rows carry the tools of today (order, hide, Quem vê)', async () => {
    const h = admin(house());
    setEditing(true);
    const el = await mount(h, {});
    expect(el.shadowRoot!.querySelectorAll('aside.side .room-edit')).toHaveLength(3);
    expect(el.shadowRoot!.querySelector('aside.side .room-edit .tool.people')).not.toBeNull();
  });

  it('the scenes of the column sit two a row: four would cut "Chegar em casa" in the middle of a word at 1024 px', () => {
    const css = ([] as unknown[]).concat(customElements.get('hubb-home-screen')!.prototype.constructor.styles).map((s) => (s as { cssText: string }).cssText).join('\n');
    expect(css).toMatch(/\.side \.scenes\s*\{[^}]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  });

  it('opens the column with the time and the weather with the next hours, in place of the greeting', async () => {
    const h = house();
    h.states['weather.casa'] = { entity_id: 'weather.casa', state: 'sunny', attributes: { temperature: 28, supported_features: 3 } };
    h.entities['weather.casa'] = { ...h.entities['light.teto']!, entity_id: 'weather.casa', area_id: null, name: 'Casa' };
    const el = await mount(h);
    const card = el.shadowRoot!.querySelector('aside.side .clock-card')!;
    expect(card.querySelector('hubb-clock')).not.toBeNull();
    expect([...card.querySelectorAll('hubb-weather-now')].map((w) => w.getAttribute('show'))).toEqual(['now', 'hours']);
    expect(el.shadowRoot!.querySelector('aside.side h1')).toBeNull();
  });

  it('on a phone the home is the one of today', async () => {
    resetLayoutForTests();
    const el = await mount(house());
    expect(el.shadowRoot!.querySelector('aside.side')).toBeNull();
    expect(el.shadowRoot!.querySelectorAll('.rooms hubb-room-card')).toHaveLength(3);
  });
});
