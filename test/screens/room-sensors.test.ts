import { afterEach, describe, expect, it } from 'vitest';
import '../../src/elements/room-card';
import '../../src/screens/home-screen';
import '../../src/screens/room-screen';
import type { HubbHomeScreen } from '../../src/screens/home-screen';
import type { HubbRoomScreen } from '../../src/screens/room-screen';
import { allLightIds, buildHouse } from '../../src/model/build-house';
import { openingWord, roomClimate } from '../../src/summary';
import { setEditing } from '../../src/editing';
import { admin, flush } from '../helpers/fake-dashboard';
import { area, makeHass, type FakeHass } from '../helpers/fake-hass';

function h(window = 'on', motion = 'on', temp = '24.4', hum = '61'): FakeHass {
  return makeHass({
    areas: [area('quarto', 'Quarto')],
    entities: [
      { entity_id: 'light.quarto', area_id: 'quarto', name: 'Teto', state: 'off' },
      { entity_id: 'binary_sensor.janela', area_id: 'quarto', name: 'Janela', state: window, attributes: { device_class: 'window' } },
      { entity_id: 'binary_sensor.porta', area_id: 'quarto', name: 'Porta', state: 'off', attributes: { device_class: 'door' } },
      { entity_id: 'binary_sensor.movimento', area_id: 'quarto', name: 'Movimento', state: motion, attributes: { device_class: 'motion' } },
      { entity_id: 'sensor.temp', area_id: 'quarto', name: 'Temperatura', state: temp, attributes: { device_class: 'temperature' } },
      { entity_id: 'sensor.umid', area_id: 'quarto', name: 'Umidade', state: hum, attributes: { device_class: 'humidity' } },
    ],
  });
}

async function room(hass: FakeHass): Promise<HubbRoomScreen> {
  const house = buildHouse(hass);
  const el = document.createElement('hubb-room-screen') as HubbRoomScreen;
  el.setConfig({ type: 'custom:hubb-room-screen', room: house.rooms[0]!, lightIds: allLightIds(house) });
  el.hass = hass;
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}

const texts = (el: Element, sel: string) => [...el.shadowRoot!.querySelectorAll(sel)].map((c) => c.textContent!.replace(/\s+/g, ' ').trim());

describe('room sensors', () => {
  afterEach(() => document.body.replaceChildren());

  it('shows the temperature and the humidity in the header, and nothing for a sensor that is down', async () => {
    const hass = h();
    expect(roomClimate(hass, buildHouse(hass).rooms[0]!)).toBe('24° · 61%');
    const down = h('on', 'on', 'unavailable', '61');
    expect(roomClimate(down, buildHouse(down).rooms[0]!)).toBe('61%');
    expect(texts(await room(hass), '.hero .climate')).toEqual(['24° · 61%']);
  });

  it('shows each sensor as a card in its own block, with what it reads, and no row of words under the header', async () => {
    const el = await room(h());
    expect(texts(el, 'main h2')).toContain('Sensores');
    expect(el.shadowRoot!.querySelector('.facts')).toBeNull();
    const cards = [...el.shadowRoot!.querySelectorAll('hubb-sensor-tile')];
    for (const c of cards) await (c as unknown as { updateComplete: Promise<unknown> }).updateComplete;
    expect(cards.map((c) => [c.shadowRoot!.querySelector('.name')!.textContent, c.shadowRoot!.querySelector('.state')!.textContent])).toEqual([
      ['Janela', 'Aberta'],
      ['Movimento', 'Ocupado'],
      ['Porta', 'Fechada'],
      ['Temperatura', '24,4°'],
      ['Umidade', '61%'],
    ]);
    expect(openingWord({ entityId: 'x', name: 'Basculante', kind: 'opening', roomName: null, path: null })).toBe('Aberto: Basculante');
  });

  it('says Sem resposta on a sensor that is down, and opens its history in Home Assistant on a tap', async () => {
    const el = await room(h('unavailable', 'unknown'));
    const card = el.shadowRoot!.querySelector('hubb-sensor-tile')!;
    await (card as unknown as { updateComplete: Promise<unknown> }).updateComplete;
    expect(card.shadowRoot!.querySelector('.state')!.textContent).toBe('Sem resposta');
    let opened: unknown = null;
    el.addEventListener('hass-more-info', (e) => (opened = (e as CustomEvent).detail));
    (card.shadowRoot!.querySelector('button') as HTMLButtonElement).click();
    expect(opened).toEqual({ entityId: 'binary_sensor.janela' });
  });

  it('puts what is open on the home chips and Ocupado on the room card', async () => {
    const hass = h();
    const el = document.createElement('hubb-home-screen') as HubbHomeScreen;
    el.setConfig({ type: 'custom:hubb-home-screen', house: buildHouse(hass) });
    el.hass = hass;
    document.body.appendChild(el);
    await el.updateComplete;
    expect(texts(el, '.chips .chip.open')).toEqual(['Janela aberta · Quarto']);
    // An icon says it is a sensor, not a button of the house (Gustavo, 14/10).
    expect(el.shadowRoot!.querySelector('.chips .chip.open svg')).not.toBeNull();
    const card = el.shadowRoot!.querySelector('hubb-room-card')!;
    await (card as unknown as { updateComplete: Promise<unknown> }).updateComplete;
    expect(card.shadowRoot!.textContent).toContain('Ocupado · ');
  });

  it('lets the installer edit each sensor like any item: its kind on the tile, Não mostrar in the editor', async () => {
    const hass = admin(h());
    const house = buildHouse(hass);
    const el = document.createElement('hubb-room-screen') as HubbRoomScreen;
    el.setConfig({ type: 'custom:hubb-room-screen', room: house.rooms[0]!, lightIds: allLightIds(house), options: {} });
    el.hass = hass;
    document.body.appendChild(el);
    await el.updateComplete;
    (el.shadowRoot!.querySelector('.edit') as HTMLButtonElement).click();
    await flush();
    await el.updateComplete;
    const kinds = Object.fromEntries(
      [...el.shadowRoot!.querySelectorAll('.edit-tile')].map((t) => [t.querySelector('.name')!.textContent, t.querySelector('.kind')!.textContent]),
    );
    expect(kinds).toMatchObject({ Janela: 'Janela', Movimento: 'Presença', Porta: 'Porta', Temperatura: 'Temperatura', Umidade: 'Umidade' });
    const tile = [...el.shadowRoot!.querySelectorAll('.edit-tile')].find((t) => t.querySelector('.name')!.textContent === 'Janela')!;
    (tile as HTMLButtonElement).click();
    await el.updateComplete;
    const editor = el.shadowRoot!.querySelector('hubb-item-editor')!;
    await (editor as unknown as { updateComplete: Promise<unknown> }).updateComplete;
    expect([...editor.shadowRoot!.querySelectorAll('button.role')].map((b) => b.textContent!.trim())).toEqual(['Janela', 'Não mostrar']);
    setEditing(false);
  });
});
