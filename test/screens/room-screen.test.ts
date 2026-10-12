import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '../../src/screens/room-screen';
import type { HubbRoomScreen } from '../../src/screens/room-screen';
import type { HubbSheet } from '../../src/elements/sheet';
import type { HubbToast } from '../../src/elements/toast';
import type { HubbColorPanel } from '../../src/elements/color-panel';
import { buildHouse, allLightIds } from '../../src/model/build-house';
import { area, makeHass, withState, type FakeHass } from '../helpers/fake-hass';

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

async function runRoomScene(el: HubbRoomScreen): Promise<void> {
  const button = el.shadowRoot!.querySelector('.actions hubb-scene-button')!;
  await (button as unknown as { updateComplete: Promise<unknown> }).updateComplete;
  (button.shadowRoot!.querySelector('button') as HTMLButtonElement).click();
  await Promise.resolve();
}

async function tapUndo(el: HubbRoomScreen): Promise<void> {
  const toast = el.shadowRoot!.querySelector('hubb-toast') as HubbToast;
  await toast.updateComplete;
  (toast.shadowRoot!.querySelector('.toast button') as HTMLButtonElement).click();
  await flush();
}

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
    await flush();
    expect(h.calls[1]).toEqual({ domain: 'light', service: 'turn_on', target: { entity_id: 'light.sofa' } });
  });

  it('keeps the turn-off button disabled and out of sight when everything is off', async () => {
    const h = makeHass({ areas: [area('sala', 'Sala')], entities: [{ entity_id: 'light.a', area_id: 'sala', state: 'off' }] });
    const el = await mount(h);
    const button = $(el, '.actions .primary') as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.classList.contains('idle')).toBe(true);
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

  it('draws the room in the header, with the lamp lit while a light is on', async () => {
    const el = await mount(hass());
    const hero = $(el, 'header.hero')!;
    expect(hero.querySelector('svg.art')).not.toBeNull();
    expect(hero.classList.contains('lit')).toBe(true);
  });

  it('lets an area photo take the place of the drawing in the header', async () => {
    const h = makeHass({
      areas: [area('sala', 'Sala', '/local/sala.jpg')],
      entities: [{ entity_id: 'light.sofa', area_id: 'sala', name: 'Sofá', state: 'off' }],
    });
    const el = await mount(h);
    expect($(el, 'header.hero')!.classList.contains('photo')).toBe(true);
    expect($(el, 'header.hero svg.art')).toBeNull();
  });

  it('puts the colour controls under the brightness in the light sheet', async () => {
    const el = await mount(hass());
    $(el, '.grid')!.dispatchEvent(new CustomEvent('hubb-open-dimmer', { detail: { entityId: 'light.mesa', name: 'Mesa' }, bubbles: true, composed: true }));
    await el.updateComplete;
    const panel = ($(el, 'hubb-sheet') as HubbSheet).querySelector('hubb-color-panel') as HubbColorPanel | null;
    expect(panel).not.toBeNull();
    expect(panel!.entityId).toBe('light.mesa');
  });

  it('lists the outlets under their own heading, and Apagar tudo leaves them alone', async () => {
    const h = makeHass({
      areas: [area('sala', 'Sala')],
      entities: [
        { entity_id: 'light.sofa', area_id: 'sala', name: 'Sofá', state: 'on' },
        { entity_id: 'switch.geladeira', area_id: 'sala', name: 'Geladeira', state: 'on', attributes: { device_class: 'outlet' } },
      ],
    });
    const el = await mount(h);
    expect([...el.shadowRoot!.querySelectorAll('h2')].map((x) => x.textContent)).toEqual(['Luzes', 'Tomadas e equipamentos']);
    expect(el.shadowRoot!.querySelectorAll('hubb-outlet-tile')).toHaveLength(1);
    ($(el, '.actions .primary') as HTMLButtonElement).click();
    await Promise.resolve();
    expect(h.calls).toEqual([{ domain: 'light', service: 'turn_off', data: undefined, target: { entity_id: ['light.sofa'] } }]);
  });

  it('shows a room with only outlets, with their status in the header', async () => {
    const h = makeHass({
      areas: [area('lav', 'Lavanderia')],
      entities: [
        { entity_id: 'switch.secadora', area_id: 'lav', name: 'Secadora', state: 'on', attributes: { device_class: 'outlet' } },
        { entity_id: 'switch.ferro', area_id: 'lav', name: 'Ferro', state: 'off', attributes: { device_class: 'outlet' } },
      ],
    });
    const el = await mount(h);
    expect($(el, 'header p')!.textContent).toBe('1 de 2 tomadas ligadas');
    expect([...el.shadowRoot!.querySelectorAll('h2')].map((x) => x.textContent)).toEqual(['Tomadas e equipamentos']);
  });

  it('leaves out the empty actions row in a room with only outlets and no scenes', async () => {
    const h = makeHass({
      areas: [area('lav', 'Lavanderia')],
      entities: [{ entity_id: 'switch.secadora', area_id: 'lav', name: 'Secadora', state: 'on', attributes: { device_class: 'outlet' } }],
    });
    const el = await mount(h);
    expect($(el, '.actions')).toBeNull();
  });

  it('Desfazer after Apagar tudo restores the lights and never touches an outlet', async () => {
    const h = makeHass({
      areas: [area('sala', 'Sala')],
      entities: [
        { entity_id: 'light.sofa', area_id: 'sala', name: 'Sofá', state: 'on' },
        { entity_id: 'switch.geladeira', area_id: 'sala', name: 'Geladeira', state: 'on', attributes: { device_class: 'outlet' } },
      ],
    });
    const el = await mount(h);
    ($(el, '.actions .primary') as HTMLButtonElement).click();
    await Promise.resolve();
    const toast = $(el, 'hubb-toast') as HubbToast;
    await toast.updateComplete;
    (toast.shadowRoot!.querySelector('.toast button') as HTMLButtonElement).click();
    await flush();
    expect(h.calls.map((c) => [c.domain, c.service])).toEqual([
      ['light', 'turn_off'],
      ['light', 'turn_on'],
    ]);
    expect(h.calls[1]!.target).toEqual({ entity_id: 'light.sofa' });
  });

  it('still draws a room saved by 2026.10.2, before drawings and outlets existed', async () => {
    const h = hass();
    const old: Record<string, unknown> = { ...buildHouse(h).rooms[0]! };
    delete old.art;
    delete old.outlets;
    const el = document.createElement('hubb-room-screen') as HubbRoomScreen;
    el.setConfig({ type: 'custom:hubb-room-screen', room: old as never, lightIds: ['light.sofa', 'light.mesa'] });
    el.hass = h;
    document.body.appendChild(el);
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('.grid hubb-light-tile')).toHaveLength(2);
    expect($(el, 'header.hero svg.art')).not.toBeNull();
  });

  it('scene undo also puts back the lights of the scene that are not on the panel', async () => {
    const h = makeHass({
      areas: [area('sala', 'Sala')],
      entities: [
        { entity_id: 'light.sofa', area_id: 'sala', name: 'Sofá', state: 'off' },
        { entity_id: 'light.jardim', name: 'Jardim', state: 'off' },
        {
          entity_id: 'scene.noite',
          area_id: 'sala',
          name: 'Noite',
          labels: ['hubb_cena'],
          state: 'unknown',
          attributes: { entity_id: ['light.sofa', 'light.jardim'] },
        },
      ],
    });
    const el = await mount(h);
    await runRoomScene(el);
    el.hass = withState(withState(h, 'light.sofa', 'on'), 'light.jardim', 'on');
    await el.updateComplete;
    await tapUndo(el);
    expect(h.calls.slice(1).map((c) => `${c.service} ${String(c.target?.entity_id)}`).sort()).toEqual([
      'turn_off light.jardim',
      'turn_off light.sofa',
    ]);
  });

  it('scene undo first stops a script that may still be running', async () => {
    const h = makeHass({
      areas: [area('sala', 'Sala')],
      entities: [
        { entity_id: 'light.sofa', area_id: 'sala', name: 'Sofá', state: 'off' },
        { entity_id: 'script.chegar', area_id: 'sala', name: 'Chegar', labels: ['hubb_cena'], state: 'off' },
      ],
    });
    const el = await mount(h);
    await runRoomScene(el);
    await tapUndo(el);
    expect(h.calls.map((c) => `${c.domain}.${c.service}`)).toEqual(['script.turn_on', 'script.turn_off', 'light.turn_off']);
  });

  it('Desfazer tapped on another screen reads the newest state, not the one the first screen kept', async () => {
    const h = makeHass({
      areas: [area('sala', 'Sala')],
      entities: [
        { entity_id: 'light.sofa', area_id: 'sala', name: 'Sofá', state: 'off' },
        { entity_id: 'light.mesa', area_id: 'sala', name: 'Mesa', state: 'off' },
        { entity_id: 'script.chegar', area_id: 'sala', name: 'Chegar', labels: ['hubb_cena'], state: 'off' },
      ],
    });
    const first = await mount(h);
    await runRoomScene(first);
    first.remove();
    const second = await mount(withState(h, 'light.sofa', 'on'));
    await tapUndo(second);
    expect(h.calls.map((c) => `${c.domain}.${c.service} ${String(c.target?.entity_id)}`)).toEqual([
      'script.turn_on script.chegar',
      'script.turn_off script.chegar',
      'light.turn_off light.sofa',
    ]);
  });

  it('scene undo puts back only what the scene sets, not a light an automation changed meanwhile', async () => {
    const h = makeHass({
      areas: [area('sala', 'Sala')],
      entities: [
        { entity_id: 'light.sofa', area_id: 'sala', name: 'Sofá', state: 'off' },
        { entity_id: 'light.mesa', area_id: 'sala', name: 'Mesa', state: 'off' },
        { entity_id: 'scene.leitura', area_id: 'sala', name: 'Leitura', labels: ['hubb_cena'], state: 'unknown', attributes: { entity_id: ['light.sofa'] } },
      ],
    });
    const el = await mount(h);
    await runRoomScene(el);
    el.hass = withState(withState(h, 'light.sofa', 'on'), 'light.mesa', 'on');
    await el.updateComplete;
    await tapUndo(el);
    expect(h.calls.slice(1).map((c) => `${c.service} ${String(c.target?.entity_id)}`)).toEqual(['turn_off light.sofa']);
  });

  it('takes Desfazer away when the action fails', async () => {
    const h = makeHass({
      failService: true,
      areas: [area('sala', 'Sala')],
      entities: [{ entity_id: 'light.sofa', area_id: 'sala', name: 'Sofá', state: 'on' }],
    });
    const el = await mount(h);
    ($(el, '.actions .primary') as HTMLButtonElement).click();
    await flush();
    const toast = $(el, 'hubb-toast') as HubbToast;
    await toast.updateComplete;
    expect(toast.shadowRoot!.querySelector('.toast')).toBeNull();
  });
});
