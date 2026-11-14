import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setEditing } from '../../src/editing';
import type { HubbSheet } from '../../src/elements/sheet';
import { allLightIds, buildHouse } from '../../src/model/build-house';
import type { HubbConfig } from '../../src/model/types';
import '../../src/screens/room-screen';
import type { HubbRoomScreen } from '../../src/screens/room-screen';
import { area, makeHass, type FakeHass } from '../helpers/fake-hass';

// On the room page a tap opens the sheet of a light or an outlet that has one, and a hold runs the
// command; an item with no sheet keeps toggling on a tap (Gustavo, 14/11).
function sala(): FakeHass {
  return makeHass({
    areas: [area('sala', 'Sala')],
    entities: [
      { entity_id: 'light.mesa', area_id: 'sala', name: 'Mesa', state: 'on', attributes: { supported_color_modes: ['brightness'], brightness: 153 } },
      { entity_id: 'light.teto', area_id: 'sala', name: 'Teto', state: 'off', attributes: { supported_color_modes: ['onoff'] } },
      { entity_id: 'switch.tomada', area_id: 'sala', name: 'Tomada', state: 'on', attributes: { device_class: 'outlet' } },
      { entity_id: 'switch.abajur', area_id: 'sala', name: 'Abajur', state: 'off', attributes: { device_class: 'outlet' } },
      { entity_id: 'sensor.tomada_w', state: '120', attributes: { device_class: 'power', unit_of_measurement: 'W' } },
    ],
  });
}

const CONFIG: HubbConfig = { entities: { 'switch.tomada': { power: 'sensor.tomada_w' } } };

async function mountRoom(h: FakeHass): Promise<HubbRoomScreen> {
  const house = buildHouse(h, CONFIG);
  const el = document.createElement('hubb-room-screen') as HubbRoomScreen;
  el.setConfig({ type: 'custom:hubb-room-screen', room: house.rooms.find((r) => r.areaId === 'sala')!, lightIds: allLightIds(house), options: CONFIG });
  el.hass = h;
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}

/** The button inside the tile that draws `name`. */
function tile(el: HubbRoomScreen, tag: string, name: string): HTMLButtonElement {
  const found = [...el.shadowRoot!.querySelectorAll(tag)].find((t) => t.shadowRoot!.querySelector('.name')!.textContent === name)!;
  return found.shadowRoot!.querySelector('button')!;
}
const services = (h: FakeHass) => h.calls.map((c) => `${c.domain}.${c.service}`);
const openSheets = (el: HubbRoomScreen) => [...el.shadowRoot!.querySelectorAll('hubb-sheet')].filter((s) => (s as HubbSheet).open);

describe('tap and hold on the room page', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    // The open sheets are module state that the next page would reopen (src/sheets.ts): leaving the edit mode forgets them.
    setEditing(true);
    setEditing(false);
    document.body.replaceChildren();
  });

  it('opens the dimmer on a tap of a dimmable light, and sends nothing', async () => {
    const h = sala();
    const el = await mountRoom(h);
    tile(el, 'hubb-light-tile', 'Mesa').click();
    await el.updateComplete;
    expect(openSheets(el).map((s) => (s as HubbSheet).heading)).toEqual(['Mesa']);
    expect(el.shadowRoot!.querySelector('hubb-dimmer-panel')).not.toBeNull();
    expect(h.calls).toEqual([]);
  });

  it('keeps the sheet open after its Apagar button is pressed', async () => {
    const h = sala();
    const el = await mountRoom(h);
    tile(el, 'hubb-light-tile', 'Mesa').click();
    await el.updateComplete;
    const panel = el.shadowRoot!.querySelector('hubb-dimmer-panel') as HTMLElement & { updateComplete: Promise<unknown> };
    await panel.updateComplete;
    panel.shadowRoot!.querySelector<HTMLButtonElement>('button.power')!.click();
    await el.updateComplete;
    expect(services(h)).toEqual(['light.turn_off']);
    expect(openSheets(el)).toHaveLength(1);
  });

  // Home Assistant rebuilds the page after a save or a registry change: the new page opens the sheet the old one had.
  async function rebuilt(old: HubbRoomScreen, h: FakeHass): Promise<HubbRoomScreen> {
    old.remove();
    return mountRoom(h);
  }

  it('keeps the light sheet open after its Apagar button is pressed and the page is rebuilt', async () => {
    const h = sala();
    let el = await mountRoom(h);
    tile(el, 'hubb-light-tile', 'Mesa').click();
    await el.updateComplete;
    const panel = el.shadowRoot!.querySelector('hubb-dimmer-panel') as HTMLElement & { updateComplete: Promise<unknown> };
    await panel.updateComplete;
    panel.shadowRoot!.querySelector<HTMLButtonElement>('button.power')!.click();
    el = await rebuilt(el, h);
    expect(openSheets(el).map((s) => (s as HubbSheet).heading)).toEqual(['Mesa']);
    expect(el.shadowRoot!.querySelector('hubb-dimmer-panel')).not.toBeNull();
  });

  it('keeps the consumption sheet open after its Desligar button is pressed and the page is rebuilt', async () => {
    const h = sala();
    let el = await mountRoom(h);
    tile(el, 'hubb-outlet-tile', 'Tomada').click();
    await el.updateComplete;
    const panel = el.shadowRoot!.querySelector('hubb-power-panel') as HTMLElement & { updateComplete: Promise<unknown> };
    await panel.updateComplete;
    panel.shadowRoot!.querySelector<HTMLButtonElement>('button.power')!.click();
    expect(services(h)).toEqual(['switch.turn_off']);
    el = await rebuilt(el, h);
    expect(openSheets(el)).toHaveLength(1);
    expect(el.shadowRoot!.querySelector('hubb-power-panel')).not.toBeNull();
  });

  it('still toggles a light that cannot dim on a tap', async () => {
    const h = sala();
    const el = await mountRoom(h);
    tile(el, 'hubb-light-tile', 'Teto').click();
    expect(services(h)).toEqual(['light.turn_on']);
    expect(openSheets(el)).toEqual([]);
  });

  it('opens the consumption sheet on a tap of an outlet with a power sensor, and toggles it on a hold', async () => {
    const h = sala();
    const el = await mountRoom(h);
    const plug = tile(el, 'hubb-outlet-tile', 'Tomada');
    plug.click();
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('hubb-power-panel')).not.toBeNull();
    expect(h.calls).toEqual([]);
    plug.dispatchEvent(Object.assign(new Event('pointerdown'), { pointerType: 'mouse' }));
    vi.advanceTimersByTime(600);
    plug.dispatchEvent(new Event('pointerup'));
    plug.click();
    expect(services(h)).toEqual(['switch.turn_off']);
  });

  it('still toggles an outlet with no sensor on a tap', async () => {
    const h = sala();
    const el = await mountRoom(h);
    tile(el, 'hubb-outlet-tile', 'Abajur').click();
    expect(services(h)).toEqual(['switch.turn_on']);
    expect(openSheets(el)).toEqual([]);
  });
});
