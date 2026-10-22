import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import '../../src/elements/room-card';
import type { HubbRoomCard } from '../../src/elements/room-card';
import { buildHouse } from '../../src/model/build-house';
import { rememberedRoom, resetSelectionForTests, selectRoom, selectedRoom } from '../../src/selection';
import { area, makeHass } from '../helpers/fake-hass';

function sala() {
  const h = makeHass({
    areas: [area('sala', 'Sala')],
    entities: [
      { entity_id: 'light.teto', area_id: 'sala', name: 'Teto', state: 'on' },
      { entity_id: 'sensor.temp_sala', area_id: 'sala', name: 'Temperatura', state: '24.3', attributes: { device_class: 'temperature', unit_of_measurement: '°C' } },
    ],
  });
  return { h, room: buildHouse(h).rooms[0]! };
}

async function row(selected = false): Promise<HubbRoomCard> {
  const { h, room } = sala();
  const el = document.createElement('hubb-room-card') as HubbRoomCard;
  el.hass = h;
  el.room = room;
  el.variant = 'row';
  el.selected = selected;
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}

describe('a room as a row of the wide home', () => {
  beforeEach(() => history.replaceState(null, '', '/hubb-casa/home'));
  afterEach(() => {
    resetSelectionForTests();
    document.body.replaceChildren();
  });

  it('a tap picks the room for the right side, without leaving the page', async () => {
    const el = await row();
    let picked: string | null = null;
    el.addEventListener('hubb-select-room', (e) => (picked = (e as CustomEvent<{ areaId: string }>).detail.areaId));
    (el.shadowRoot!.querySelector('button') as HTMLButtonElement).click();
    expect(picked).toBe('sala');
    expect(location.pathname).toBe('/hubb-casa/home');
  });

  it('shows the temperature of the room and whether it is the one open', async () => {
    const el = await row(true);
    expect(el.getAttribute('variant')).toBe('row');
    expect(el.hasAttribute('selected')).toBe(true);
    expect(el.shadowRoot!.querySelector('.temp')!.textContent).toBe('24°');
  });

  it('the room picked is remembered on this device, for the next time the panel opens', () => {
    selectRoom('quarto');
    expect(selectedRoom()).toBe('quarto');
    expect(rememberedRoom()).toBe('quarto');
  });
});
