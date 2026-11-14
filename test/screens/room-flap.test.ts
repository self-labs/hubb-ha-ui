import { afterEach, describe, expect, it } from 'vitest';
import { setEditing } from '../../src/editing';
import type { HubbCoverPanel } from '../../src/elements/cover-panel';
import type { HubbCoverTile } from '../../src/elements/cover-tile';
import type { HubbSheet } from '../../src/elements/sheet';
import { allLightIds, buildHouse } from '../../src/model/build-house';
import type { HubbConfig } from '../../src/model/types';
import '../../src/screens/room-screen';
import type { HubbRoomScreen } from '../../src/screens/room-screen';
import { admin, flush } from '../helpers/fake-dashboard';
import { area, makeHass, type FakeEntity, type FakeHass } from '../helpers/fake-hass';

// The flap of a ceiling TV is a cover the installer shows as Flap: its own block after Cortinas, its
// words and its icon, and "Mostrar como" offers it (Gustavo, 14/11).
function sala(extra: FakeEntity[] = []): FakeHass {
  return makeHass({
    areas: [area('sala', 'Sala')],
    entities: [
      { entity_id: 'light.teto', area_id: 'sala', name: 'Teto', state: 'off' },
      { entity_id: 'cover.cortina', area_id: 'sala', name: 'Cortina', state: 'closed', attributes: { device_class: 'curtain', supported_features: 15 } },
      { entity_id: 'cover.flap', area_id: 'sala', name: 'Flap', state: 'closed', attributes: { supported_features: 11 } },
      { entity_id: 'media_player.tv', area_id: 'sala', name: 'TV', state: 'off', attributes: { device_class: 'tv', supported_features: 128 | 256 } },
      ...extra,
    ],
  });
}

const CONFIG: HubbConfig = { entities: { 'cover.flap': { role: 'flap' } } };

async function mountRoom(h: FakeHass, options: HubbConfig = CONFIG): Promise<HubbRoomScreen> {
  const house = buildHouse(h, options);
  const el = document.createElement('hubb-room-screen') as HubbRoomScreen;
  el.setConfig({ type: 'custom:hubb-room-screen', room: house.rooms.find((r) => r.areaId === 'sala')!, lightIds: allLightIds(house), options });
  el.hass = h;
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}

const $ = (el: HubbRoomScreen, sel: string) => el.shadowRoot!.querySelector(sel);
const headings = (el: HubbRoomScreen) => [...el.shadowRoot!.querySelectorAll('main h2')].map((h) => h.textContent);
const tiles = (el: HubbRoomScreen) => [...el.shadowRoot!.querySelectorAll('hubb-cover-tile')] as HubbCoverTile[];

async function editorOf(el: HubbRoomScreen, name: string) {
  const tile = [...el.shadowRoot!.querySelectorAll('.edit-tile')].find((t) => t.querySelector('.name')!.textContent === name)!;
  (tile as HTMLButtonElement).click();
  await el.updateComplete;
  const editor = $(el, 'hubb-item-editor')!;
  await (editor as unknown as { updateComplete: Promise<unknown> }).updateComplete;
  return editor;
}
const roleButtons = (editor: Element) => [...editor.shadowRoot!.querySelectorAll('button.role')] as HTMLButtonElement[];

describe('the Flap block of a room page', () => {
  afterEach(() => {
    setEditing(false);
    document.body.replaceChildren();
  });

  it('comes after Cortinas and before Mídia, and the flap is not among the curtains', async () => {
    const el = await mountRoom(sala());
    expect(headings(el)).toEqual(['Luzes', 'Cortinas', 'Flap', 'Mídia']);
    expect(tiles(el).map((t) => [t.item!.entityId, t.kind])).toEqual([
      ['cover.cortina', 'cover'],
      ['cover.flap', 'flap'],
    ]);
  });

  it('keeps Flap after Cortinas on a wide room that pairs Clima and Mídia', async () => {
    const h = sala([{ entity_id: 'climate.ar', area_id: 'sala', name: 'Ar', state: 'off', attributes: { hvac_modes: ['off', 'cool'], supported_features: 1 } }]);
    const el = await mountRoom(h);
    el.screenLayout = 'wide';
    await el.updateComplete;
    const order = [...$(el, 'main')!.children].map((c) => (c.tagName === 'H2' ? c.textContent : c.className));
    expect(order.indexOf('pair both')).toBeGreaterThan(-1);
    expect(order.indexOf('pair both')).toBeLessThan(order.indexOf('Cortinas'));
    expect(order.indexOf('Cortinas')).toBeLessThan(order.indexOf('Flap'));
  });

  it('opens the sheet of the flap in its own words, under its own name', async () => {
    const el = await mountRoom(sala());
    const flap = tiles(el).find((t) => t.item!.entityId === 'cover.flap')!;
    flap.dispatchEvent(new CustomEvent('hubb-open-cover', { detail: { entityId: 'cover.flap' }, bubbles: true, composed: true }));
    await el.updateComplete;
    const sheet = $(el, 'hubb-sheet.device') as HubbSheet;
    expect(sheet.open).toBe(true);
    expect(sheet.heading).toBe('Flap');
    expect(($(el, 'hubb-cover-panel') as HubbCoverPanel).kind).toBe('flap');
  });
});

describe('Mostrar como, with the Flap', () => {
  afterEach(() => {
    setEditing(false);
    document.body.replaceChildren();
  });

  async function editing(): Promise<HubbRoomScreen> {
    const el = await mountRoom(admin(sala()));
    ($(el, '.edit') as HTMLButtonElement).click();
    await flush();
    await el.updateComplete;
    return el;
  }

  it('offers Cortina, Flap, Portão and Não mostrar to a flap and to a curtain', async () => {
    const el = await editing();
    expect(roleButtons(await editorOf(el, 'Flap')).map((b) => b.textContent!.trim())).toEqual(['Cortina', 'Flap', 'Portão', 'Não mostrar']);
    ($(el, 'hubb-sheet.item-sheet') as HubbSheet).dispatchEvent(new CustomEvent('hubb-close'));
    await el.updateComplete;
    expect(roleButtons(await editorOf(el, 'Cortina')).map((b) => b.textContent!.trim())).toEqual(['Cortina', 'Flap', 'Portão', 'Não mostrar']);
  });

  it('saves the flap role from a curtain, and clears it to go back to a curtain', async () => {
    const el = await editing();
    const asked: Array<{ entityId: string; patch: unknown }> = [];
    const editor = await editorOf(el, 'Cortina');
    editor.addEventListener('hubb-edit', (e) => asked.push((e as CustomEvent).detail));
    roleButtons(editor).find((b) => b.textContent!.trim() === 'Flap')!.click();
    expect(asked.map((a) => [a.entityId, a.patch])).toEqual([['cover.cortina', { role: 'flap' }]]);
    ($(el, 'hubb-sheet.item-sheet') as HubbSheet).dispatchEvent(new CustomEvent('hubb-close'));
    await el.updateComplete;
    const flapEditor = await editorOf(el, 'Flap');
    flapEditor.addEventListener('hubb-edit', (e) => asked.push((e as CustomEvent).detail));
    roleButtons(flapEditor).find((b) => b.textContent!.trim() === 'Cortina')!.click();
    expect(asked.map((a) => [a.entityId, a.patch])[1]).toEqual(['cover.flap', { role: undefined }]);
  });
});
