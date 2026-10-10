import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '../../src/screens/room-screen';
import type { HubbRoomScreen } from '../../src/screens/room-screen';
import type { HubbSheet } from '../../src/elements/sheet';
import type { HubbToast } from '../../src/elements/toast';
import { buildHouse, allLightIds } from '../../src/model/build-house';
import { area, makeHass, type FakeHass } from '../helpers/fake-hass';

function hass(opts: { darkMode?: boolean } = {}): FakeHass {
  return makeHass({
    darkMode: opts.darkMode ?? true,
    areas: [area('sala', 'Sala')],
    entities: [
      { entity_id: 'light.sofa', area_id: 'sala', name: 'Sofá', state: 'on', attributes: { supported_color_modes: ['onoff'] } },
      { entity_id: 'light.mesa', area_id: 'sala', name: 'Mesa', state: 'off', attributes: { supported_color_modes: ['brightness'] } },
      { entity_id: 'scene.cinema', area_id: 'sala', name: 'Cinema', labels: ['hubb_cena'], state: 'unknown' },
    ],
  });
}

async function mount(h: FakeHass): Promise<HubbRoomScreen> {
  const house = buildHouse(h);
  const el = document.createElement('hubb-room-screen') as HubbRoomScreen;
  el.setConfig({ type: 'custom:hubb-room-screen', room: house.rooms[0]!, lightIds: allLightIds(house) });
  el.hass = h;
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}
const $ = (el: HubbRoomScreen, sel: string) => el.shadowRoot!.querySelector(sel);

describe('hubb-room-screen', () => {
  beforeEach(() => history.replaceState(null, '', '/hubb-casa/sala'));
  afterEach(() => {
    vi.useRealTimers();
    document.body.replaceChildren();
  });

  it('refuses a config with no room', () => {
    const el = document.createElement('hubb-room-screen') as HubbRoomScreen;
    expect(() => el.setConfig({ type: 'custom:hubb-room-screen' } as never)).toThrow('hubb-room-screen: missing room');
  });

  it('shows the room, its status and one tile per light', async () => {
    const el = await mount(hass());
    expect($(el, 'h1')!.textContent).toBe('Sala');
    expect($(el, 'header p')!.textContent).toBe('1 de 2 luzes acesas');
    expect(el.shadowRoot!.querySelectorAll('.grid hubb-light-tile')).toHaveLength(2);
  });

  it('follows the theme of the Home Assistant profile', async () => {
    expect((await mount(hass({ darkMode: false }))).getAttribute('theme')).toBe('light');
    document.body.replaceChildren();
    expect((await mount(hass())).getAttribute('theme')).toBe('dark');
  });

  it('turns the room off with one call and offers to undo it', async () => {
    const h = hass();
    const el = await mount(h);
    ($(el, '.actions .primary') as HTMLButtonElement).click();
    await Promise.resolve();
    expect(h.calls[0]).toEqual({ domain: 'light', service: 'turn_off', data: undefined, target: { entity_id: ['light.sofa'] } });
    const toast = $(el, 'hubb-toast') as HubbToast;
    await toast.updateComplete;
    expect(toast.shadowRoot!.querySelector('.toast span')!.textContent).toBe('Sala: 1 luz apagada');
    (toast.shadowRoot!.querySelector('.toast button') as HTMLButtonElement).click();
    await Promise.resolve();
    expect(h.calls[1]).toEqual({ domain: 'light', service: 'turn_on', target: { entity_id: 'light.sofa' } });
  });

  it('hides the turn-off button when everything is off', async () => {
    const h = makeHass({ areas: [area('sala', 'Sala')], entities: [{ entity_id: 'light.a', area_id: 'sala', state: 'off' }] });
    const el = await mount(h);
    expect($(el, '.actions .primary')).toBeNull();
    expect($(el, 'header p')!.textContent).toBe('Tudo apagado');
  });

  it('opens the dimmer sheet when a tile asks for it', async () => {
    const el = await mount(hass());
    $(el, '.grid')!.dispatchEvent(new CustomEvent('hubb-open-dimmer', { detail: { entityId: 'light.mesa', name: 'Mesa' }, bubbles: true, composed: true }));
    await el.updateComplete;
    const sheet = $(el, 'hubb-sheet') as HubbSheet;
    expect(sheet.open).toBe(true);
    expect(sheet.heading).toBe('Mesa');
    expect(sheet.querySelector('hubb-dimmer-panel')).not.toBeNull();
    sheet.close();
    await el.updateComplete;
    expect(sheet.querySelector('hubb-dimmer-panel')).toBeNull();
  });

  it('runs a scene of the room and offers to undo it', async () => {
    const h = hass();
    const el = await mount(h);
    const button = $(el, '.actions hubb-scene-button')!;
    await (button as unknown as { updateComplete: Promise<unknown> }).updateComplete;
    (button.shadowRoot!.querySelector('button') as HTMLButtonElement).click();
    await Promise.resolve();
    expect(h.calls[0]).toEqual({ domain: 'scene', service: 'turn_on', data: undefined, target: { entity_id: 'scene.cinema' } });
    const toast = $(el, 'hubb-toast') as HubbToast;
    await toast.updateComplete;
    expect(toast.shadowRoot!.querySelector('.toast span')!.textContent).toBe('Cena Cinema');
  });

  it('goes back to the home screen without stacking a history entry', async () => {
    const el = await mount(hass());
    const push = vi.spyOn(history, 'pushState');
    ($(el, '.back') as HTMLButtonElement).click();
    expect(location.pathname).toBe('/hubb-casa/home');
    expect(push).not.toHaveBeenCalled();
    push.mockRestore();
  });

  it('goes back through history when the home screen opened the room', async () => {
    history.replaceState({ hubbBack: true }, '', '/hubb-casa/sala');
    const el = await mount(hass());
    const back = vi.spyOn(history, 'back').mockImplementation(() => undefined);
    ($(el, '.back') as HTMLButtonElement).click();
    expect(back).toHaveBeenCalledOnce();
    back.mockRestore();
  });
});
