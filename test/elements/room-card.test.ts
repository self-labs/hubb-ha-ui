import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import '../../src/elements/room-card';
import type { HubbRoomCard } from '../../src/elements/room-card';
import type { Room } from '../../src/model/types';
import { makeHass, type FakeHass } from '../helpers/fake-hass';

const SALA: Room = {
  areaId: 'sala_de_estar',
  path: 'sala_de_estar',
  name: 'Sala',
  photo: '/local/hubb/sala.jpg',
  icon: null,
  lights: [
    { entityId: 'light.sofa', name: 'Sofá', dimmable: false },
    { entityId: 'light.lustre', name: 'Lustre', dimmable: false },
  ],
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
});
