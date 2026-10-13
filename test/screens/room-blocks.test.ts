import { afterEach, describe, expect, it } from 'vitest';
import '../../src/screens/room-screen';
import type { HubbRoomScreen } from '../../src/screens/room-screen';
import type { HubbSheet } from '../../src/elements/sheet';
import { allLightIds, buildHouse } from '../../src/model/build-house';
import type { HubbConfig } from '../../src/model/types';
import { CASA2_CONFIG, casa2Hass } from '../fixtures/casa-exemplo-2';
import { area, makeHass, type FakeHass } from '../helpers/fake-hass';

async function mountRoom(h: FakeHass, config: HubbConfig, areaId: string): Promise<HubbRoomScreen> {
  const house = buildHouse(h, config);
  const el = document.createElement('hubb-room-screen') as HubbRoomScreen;
  el.setConfig({ type: 'custom:hubb-room-screen', room: house.rooms.find((r) => r.areaId === areaId)!, lightIds: allLightIds(house) });
  el.hass = h;
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}

const headings = (el: HubbRoomScreen) => [...el.shadowRoot!.querySelectorAll('main h2')].map((h) => h.textContent);

describe('room page blocks', () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it('shows the blocks in their fixed order and leaves out the empty ones', async () => {
    const h = makeHass({
      areas: [area('area_externa', 'Área externa')],
      entities: [
        { entity_id: 'light.jardim', area_id: 'area_externa', name: 'Jardim', state: 'off' },
        { entity_id: 'switch.bomba', area_id: 'area_externa', name: 'Bomba', state: 'on' },
        { entity_id: 'switch.tomada', area_id: 'area_externa', name: 'Tomada', state: 'off', attributes: { device_class: 'outlet' } },
        { entity_id: 'button.toldo', area_id: 'area_externa', name: 'Abrir toldo', state: 'unknown' },
      ],
    });
    const el = await mountRoom(h, { entities: { 'switch.bomba': { role: 'equipment' }, 'button.toldo': { role: 'action' } } }, 'area_externa');
    expect(headings(el)).toEqual(['Luzes', 'Tomadas e equipamentos', 'Ações']);
    expect(el.shadowRoot!.querySelectorAll('hubb-outlet-tile')).toHaveLength(1);
    expect(el.shadowRoot!.querySelectorAll('hubb-equipment-tile')).toHaveLength(1);
    expect(el.shadowRoot!.querySelectorAll('hubb-action-button')).toHaveLength(1);
  });

  it('speaks about the outlets and the equipment of a room with no lights', async () => {
    const h = makeHass({
      areas: [area('rack', 'Rack')],
      entities: [
        { entity_id: 'switch.bomba', area_id: 'rack', name: 'Bomba', state: 'on' },
        { entity_id: 'switch.tomada', area_id: 'rack', name: 'Tomada', state: 'off', attributes: { device_class: 'outlet' } },
      ],
    });
    const el = await mountRoom(h, { entities: { 'switch.bomba': { role: 'equipment' } } }, 'rack');
    expect(el.shadowRoot!.querySelector('.hero p')!.textContent).toBe('1 de 2 ligados');
    expect(el.shadowRoot!.querySelector('.actions')).toBeNull();
  });

  it('turns off a switch with the light role through the switch domain', async () => {
    const h = casa2Hass();
    const el = await mountRoom(h, CASA2_CONFIG, 'escritorio');
    (el.shadowRoot!.querySelector('.actions .primary') as HTMLButtonElement).click();
    await Promise.resolve();
    expect(h.calls).toEqual([{ domain: 'switch', service: 'turn_off', data: undefined, target: { entity_id: ['switch.escritorio_luz'] } }]);
  });

  it('shows the appliances of the room and opens the sheet there', async () => {
    const h = casa2Hass('Running', '40');
    const el = await mountRoom(h, CASA2_CONFIG, 'terraco');
    expect(headings(el)).toEqual(['Luzes', 'Aparelhos']);
    const card = el.shadowRoot!.querySelector('hubb-appliance-card')!;
    await (card as unknown as { updateComplete: Promise<unknown> }).updateComplete;
    (card.shadowRoot!.querySelector('button') as HTMLButtonElement).click();
    await el.updateComplete;
    const sheet = el.shadowRoot!.querySelector('hubb-sheet.appliance') as HubbSheet;
    expect(sheet.open).toBe(true);
    expect(sheet.heading).toBe('Lavadora');
    expect(sheet.subheading).toBe('Terraço · colors');
    expect(sheet.querySelector('hubb-appliance-panel')).not.toBeNull();
  });
});
