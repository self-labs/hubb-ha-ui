import { afterEach, describe, expect, it } from 'vitest';
import '../src/elements/item-editor';
import { setEditing } from '../src/editing';
import { allLightIds, buildHouse } from '../src/model/build-house';
import { originOf } from '../src/model/origin';
import { reviewItems } from '../src/model/review';
import '../src/screens/room-screen';
import { admin, flush } from './helpers/fake-dashboard';
import { area, device, makeHass, type FakeHass } from './helpers/fake-hass';

/** The office of the owner's house: one air conditioner seen by two integrations. */
function office(): FakeHass {
  return makeHass({
    areas: [area('escritorio', 'Escritório')],
    devices: [device('d_ar', 'escritorio', 'Ar do Escritório')],
    entities: [
      { entity_id: 'light.escritorio', area_id: 'escritorio', name: 'Teto', state: 'off' },
      { entity_id: 'climate.ar_escritorio', device_id: 'd_ar', state: 'off', platform: 'lg_thinq', attributes: { friendly_name: 'Ar do Escritório' } },
      { entity_id: 'climate.ar_escritorio_1', device_id: 'd_ar', state: 'off', platform: 'smartthinq_sensors', attributes: { friendly_name: 'Ar do Escritório' } },
      { entity_id: 'media_player.som', area_id: 'escritorio', name: 'Som', state: 'off', platform: 'uma_integracao_nova' },
    ],
  });
}

async function mountRoom(h: FakeHass) {
  const house = buildHouse(h, {});
  const el = document.createElement('hubb-room-screen') as HTMLElement & { hass: FakeHass; setConfig(c: unknown): void; updateComplete: Promise<unknown> };
  el.setConfig({ type: 'custom:hubb-room-screen', room: house.rooms[0]!, lightIds: allLightIds(house), options: {} });
  el.hass = h;
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}

describe('where each item comes from', () => {
  afterEach(() => {
    setEditing(false);
    document.body.replaceChildren();
  });

  it('names the integration in plain words, and its id when the panel does not know it', () => {
    const h = office();
    expect([originOf(h, 'climate.ar_escritorio'), originOf(h, 'climate.ar_escritorio_1'), originOf(h, 'media_player.som')]).toEqual([
      'LG ThinQ',
      'SmartThinQ',
      'uma_integracao_nova',
    ]);
    expect(originOf(h, 'light.escritorio')).toBeNull();
  });

  it('says it on the edit tiles, so two items with the same name can be told apart', async () => {
    const el = await mountRoom(admin(office()));
    (el.shadowRoot!.querySelector('.edit') as HTMLButtonElement).click();
    await flush();
    await el.updateComplete;
    const kinds = [...el.shadowRoot!.querySelectorAll('.edit-tile')].map((t) => [
      t.querySelector('.kind')!.textContent!.trim(),
      t.querySelector('.origin')?.textContent?.trim() ?? null,
    ]);
    // On its own line: "Ar-condicionado · LG ThinQ" broke over three lines on a phone.
    expect(kinds).toContainEqual(['Ar-condicionado', 'LG ThinQ']);
    expect(kinds).toContainEqual(['Ar-condicionado', 'SmartThinQ']);
  });

  it('shows the integration, the entity id and the name from Home Assistant in the editor', async () => {
    const h = office();
    const editor = document.createElement('hubb-item-editor') as HTMLElement & { hass: FakeHass; item: unknown; roomAreaId: string; updateComplete: Promise<unknown> };
    editor.hass = h;
    editor.item = { entityId: 'climate.ar_escritorio_1', name: 'Ar', kind: 'climate', siblings: ['climate.ar_escritorio', 'climate.ar_escritorio_1'] };
    editor.roomAreaId = 'escritorio';
    document.body.appendChild(editor);
    await editor.updateComplete;
    const origin = editor.shadowRoot!.querySelector('.origin')!.textContent!.replace(/\s+/g, ' ').trim();
    expect(origin).toBe('Origem SmartThinQ · climate.ar_escritorio_1 · no Home Assistant: Ar do Escritório');
  });

  it('lists the items with the same name in the same room on the review, with where each comes from', () => {
    const items = reviewItems(office(), {}).filter((i) => i.group === 'duplicate');
    expect(items.map((i) => [i.entityId, i.name, i.areaName, i.reason, i.roles])).toEqual([
      ['climate.ar_escritorio', 'Ar', 'Escritório', 'Outro item deste cômodo tem o mesmo nome. Este vem de LG ThinQ.', ['hidden']],
      ['climate.ar_escritorio_1', 'Ar', 'Escritório', 'Outro item deste cômodo tem o mesmo nome. Este vem de SmartThinQ.', ['hidden']],
    ]);
  });
});
