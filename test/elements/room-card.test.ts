import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import '../../src/elements/room-card';
import { HubbRoomCard } from '../../src/elements/room-card';
import type { Room } from '../../src/model/types';
import { makeHass, type FakeHass } from '../helpers/fake-hass';

const SALA: Room = {
  areaId: 'sala_de_estar',
  path: 'sala_de_estar',
  name: 'Sala',
  photo: '/local/hubb/sala.jpg',
  icon: null,
  art: 'sala',
  floorId: null,
  lights: [
    { entityId: 'light.sofa', name: 'Sofá', dimmable: false },
    { entityId: 'light.lustre', name: 'Lustre', dimmable: false },
  ],
  outlets: [],
  equipment: [],
  appliances: [],
  actions: [],
  scenes: [],
};

async function mount(hass: FakeHass, room: Room = SALA): Promise<HubbRoomCard> {
  const el = document.createElement('hubb-room-card') as HubbRoomCard;
  el.hass = hass;
  el.room = room;
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}
const btn = (el: HubbRoomCard) => el.shadowRoot!.querySelector('button.room') as HTMLButtonElement;
const cssOf = (styles: unknown): string =>
  ([] as unknown[]).concat(styles).map((s) => (s as { cssText: string }).cssText).join('\n');

describe('hubb-room-card', () => {
  beforeEach(() => history.replaceState(null, '', '/hubb-casa/home'));
  afterEach(() => { document.body.replaceChildren(); });

  it('says Apagado when every light is off', async () => {
    const el = await mount(makeHass({ entities: [{ entity_id: 'light.sofa', state: 'off' }, { entity_id: 'light.lustre', state: 'off' }] }));
    expect(el.shadowRoot!.querySelector('.name')!.textContent).toBe('Sala');
    expect(el.shadowRoot!.querySelector('.status')!.textContent).toBe('Apagado');
    expect(btn(el).classList.contains('on')).toBe(false);
  });

  it('counts the lights that are on and glows', async () => {
    const el = await mount(makeHass({ entities: [{ entity_id: 'light.sofa', state: 'on' }, { entity_id: 'light.lustre', state: 'on' }] }));
    expect(el.shadowRoot!.querySelector('.status')!.textContent).toBe('2 acesas');
    expect(btn(el).classList.contains('on')).toBe(true);
  });

  it('uses the room photo', async () => {
    const el = await mount(makeHass());
    expect(btn(el).getAttribute('style')).toContain('/local/hubb/sala.jpg');
  });

  it('opens the room page, marking the entry so the room can go back to it', async () => {
    const el = await mount(makeHass());
    btn(el).click();
    expect(location.pathname).toBe('/hubb-casa/sala_de_estar');
    expect(history.state).toEqual({ hubbBack: true });
  });

  it('draws the room when the area has no photo, and lets a photo take its place', async () => {
    const plain = await mount(makeHass(), { ...SALA, photo: null });
    const art = plain.shadowRoot!.querySelector('svg.art');
    expect(art).not.toBeNull();
    expect(art!.querySelectorAll('path, rect, circle, ellipse').length).toBeGreaterThan(0);
    document.body.replaceChildren();
    const withPhoto = await mount(makeHass());
    expect(withPhoto.shadowRoot!.querySelector('svg.art')).toBeNull();
  });

  it('lights the lamp of the drawing while a light is on', async () => {
    const off = await mount(makeHass({ entities: [{ entity_id: 'light.sofa', state: 'off' }] }), { ...SALA, photo: null });
    expect(btn(off).classList.contains('lit')).toBe(false);
    document.body.replaceChildren();
    const on = await mount(makeHass({ entities: [{ entity_id: 'light.sofa', state: 'on' }] }), { ...SALA, photo: null });
    expect(btn(on).classList.contains('lit')).toBe(true);
    expect(cssOf(HubbRoomCard.styles)).toMatch(/\.lit\s*\{[^}]*--glow: var\(--hubb-art-glow\)/);
  });

  it('counts outlets that are on in a room with no lights, without the light glow', async () => {
    const lav: Room = { ...SALA, name: 'Lavanderia', photo: null, lights: [], outlets: [{ entityId: 'switch.secadora', name: 'Secadora' }] };
    const on = await mount(makeHass({ entities: [{ entity_id: 'switch.secadora', state: 'on' }] }), lav);
    expect(on.shadowRoot!.querySelector('.status')!.textContent).toBe('1 ligada');
    expect(btn(on).classList.contains('on')).toBe(false);
    document.body.replaceChildren();
    const off = await mount(makeHass({ entities: [{ entity_id: 'switch.secadora', state: 'off' }] }), lav);
    expect(off.shadowRoot!.querySelector('.status')!.textContent).toBe('Desligado');
  });
});
