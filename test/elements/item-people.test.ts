import { afterEach, describe, expect, it } from 'vitest';
import { setEditing } from '../../src/editing';
import '../../src/elements/item-editor';
import { allLightIds, buildHouse } from '../../src/model/build-house';
import '../../src/screens/room-screen';
import { admin, flush, USERS, withUsers } from '../helpers/fake-dashboard';
import { area, makeHass, type FakeHass } from '../helpers/fake-hass';

function sala(): FakeHass {
  const h = admin(
    makeHass({
      areas: [area('sala', 'Sala')],
      entities: [
        { entity_id: 'light.teto', area_id: 'sala', name: 'Teto', state: 'off' },
        { entity_id: 'light.abajur', area_id: 'sala', name: 'Abajur', state: 'off' },
      ],
    }),
  );
  withUsers(h, USERS);
  return h;
}

async function editor(h: FakeHass, hiddenFor?: string[]) {
  const el = document.createElement('hubb-item-editor') as HTMLElement & {
    hass: FakeHass;
    item: unknown;
    roomAreaId: string;
    settings: unknown;
    updateComplete: Promise<unknown>;
  };
  el.hass = h;
  el.item = { entityId: 'light.abajur', name: 'Abajur', kind: 'light', siblings: ['light.abajur', 'light.teto'] };
  el.roomAreaId = 'sala';
  el.settings = hiddenFor ? { hidden_for: hiddenFor } : undefined;
  document.body.appendChild(el);
  await el.updateComplete;
  const picker = el.shadowRoot!.querySelector('hubb-people-picker') as HTMLElement & { updateComplete: Promise<unknown> };
  await flush();
  await picker.updateComplete;
  return { el, picker };
}

describe('who sees an item', () => {
  afterEach(() => {
    setEditing(false);
    document.body.replaceChildren();
  });

  it('asks to hide the item from the person tapped, in plain words', async () => {
    const { el, picker } = await editor(sala());
    expect(el.shadowRoot!.textContent).toContain('Quem vê este item');
    let asked: unknown = null;
    el.addEventListener('hubb-edit', (e) => (asked = (e as CustomEvent).detail));
    (picker.shadowRoot!.querySelectorAll('.person')[1] as HTMLButtonElement).click();
    expect(asked).toEqual({ entityId: 'light.abajur', patch: { hidden_for: ['u_lia'] }, message: 'Abajur não aparece mais para Lia.' });
  });

  it('drops the list when everyone sees the item again', async () => {
    const { el, picker } = await editor(sala(), ['u_lia']);
    let asked: unknown = null;
    el.addEventListener('hubb-edit', (e) => (asked = (e as CustomEvent).detail));
    (picker.shadowRoot!.querySelectorAll('.person')[1] as HTMLButtonElement).click();
    expect(asked).toEqual({ entityId: 'light.abajur', patch: { hidden_for: undefined }, message: 'Abajur voltou a aparecer para Lia.' });
  });

  it('tags the edit tile of an item hidden for someone', async () => {
    const h = sala();
    const options = { entities: { 'light.abajur': { hidden_for: ['u_lia'] } } };
    const house = buildHouse(h, options);
    const room = document.createElement('hubb-room-screen') as HTMLElement & { hass: FakeHass; setConfig(c: unknown): void; updateComplete: Promise<unknown> };
    room.setConfig({ type: 'custom:hubb-room-screen', room: house.rooms[0]!, lightIds: allLightIds(house), options });
    room.hass = h;
    document.body.appendChild(room);
    await room.updateComplete;
    (room.shadowRoot!.querySelector('.edit') as HTMLButtonElement).click();
    await flush();
    await room.updateComplete;
    const tile = [...room.shadowRoot!.querySelectorAll('.edit-tile')].find((t) => t.querySelector('.name')!.textContent === 'Abajur')!;
    const tag = tile.querySelector('hubb-hidden-tag')!;
    await flush();
    await (tag as unknown as { updateComplete: Promise<unknown> }).updateComplete;
    expect(tag.shadowRoot!.textContent!.trim()).toBe('Oculto para Lia');
  });
});
