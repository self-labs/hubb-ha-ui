import { afterEach, describe, expect, it } from 'vitest';
import { setEditing } from '../../src/editing';
import type { HubbSheet } from '../../src/elements/sheet';
import { allLightIds, buildHouse } from '../../src/model/build-house';
import type { HubbConfig } from '../../src/model/types';
import '../../src/screens/room-screen';
import type { HubbRoomScreen } from '../../src/screens/room-screen';
import { area, makeHass, type FakeHass } from '../helpers/fake-hass';

// A tap on a curtain opens its sheet, and nothing the resident does inside it closes it: not a button
// and not the track, not even a rebuild of the page (the rule "folhas nunca fecham sozinhas").
const OPEN_CLOSE_STOP_POSITION = 1 | 2 | 4 | 8;

function sala(): FakeHass {
  return makeHass({
    areas: [area('sala', 'Sala')],
    entities: [
      {
        entity_id: 'cover.cortina',
        area_id: 'sala',
        name: 'Cortina',
        state: 'open',
        attributes: { supported_features: OPEN_CLOSE_STOP_POSITION, current_position: 60 },
      },
    ],
  });
}

const CONFIG: HubbConfig = {};

async function mountRoom(h: FakeHass): Promise<HubbRoomScreen> {
  const house = buildHouse(h, CONFIG);
  const el = document.createElement('hubb-room-screen') as HubbRoomScreen;
  el.setConfig({ type: 'custom:hubb-room-screen', room: house.rooms.find((r) => r.areaId === 'sala')!, lightIds: allLightIds(house), options: CONFIG });
  el.hass = h;
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}

const openSheets = (el: HubbRoomScreen) => [...el.shadowRoot!.querySelectorAll('hubb-sheet')].filter((s) => (s as HubbSheet).open);
type Panel = HTMLElement & { updateComplete: Promise<unknown> };

describe('the sheet of a curtain on the room page', () => {
  afterEach(() => {
    // The open sheets are module state that the next page would reopen (src/sheets.ts): leaving the edit mode forgets them.
    setEditing(true);
    setEditing(false);
    document.body.replaceChildren();
  });

  async function opened(h: FakeHass): Promise<{ el: HubbRoomScreen; panel: Panel }> {
    const el = await mountRoom(h);
    const tile = el.shadowRoot!.querySelector('hubb-cover-tile')!;
    tile.shadowRoot!.querySelector('button')!.click();
    await el.updateComplete;
    const panel = el.shadowRoot!.querySelector('hubb-cover-panel') as Panel;
    await panel.updateComplete;
    return { el, panel };
  }

  it('opens on a tap, with the buttons and the track, and sends nothing', async () => {
    const h = sala();
    const { el, panel } = await opened(h);
    expect(openSheets(el).map((s) => (s as HubbSheet).heading)).toEqual(['Cortina']);
    expect([...panel.shadowRoot!.querySelectorAll('.row button')].map((b) => b.textContent!.trim())).toEqual(['Abrir', 'Parar', 'Fechar']);
    expect(panel.shadowRoot!.querySelector('.track')).not.toBeNull();
    expect(h.calls).toEqual([]);
  });

  it('stays open after Parar is pressed and the page is rebuilt', async () => {
    const h = sala();
    let { el, panel } = await opened(h);
    panel.shadowRoot!.querySelector<HTMLButtonElement>('.stop')!.click();
    expect(h.calls.map((c) => c.service)).toEqual(['stop_cover']);
    el.remove();
    el = await mountRoom(h);
    expect(openSheets(el)).toHaveLength(1);
    expect(el.shadowRoot!.querySelector('hubb-cover-panel')).not.toBeNull();
  });

  it('stays open after the track is dragged and the page is rebuilt', async () => {
    const h = sala();
    let { el, panel } = await opened(h);
    const track = panel.shadowRoot!.querySelector<HTMLElement>('.track')!;
    track.getBoundingClientRect = () => ({ left: 0, top: 0, width: 200, height: 48, right: 200, bottom: 48, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
    track.dispatchEvent(Object.assign(new Event('pointerdown', { bubbles: true }), { clientX: 50, pointerId: 1 }));
    track.dispatchEvent(Object.assign(new Event('pointerup', { bubbles: true }), { clientX: 50, pointerId: 1 }));
    expect(h.calls.map((c) => [c.service, c.data])).toEqual([['set_cover_position', { position: 25 }]]);
    el.remove();
    el = await mountRoom(h);
    expect(openSheets(el)).toHaveLength(1);
  });
});
