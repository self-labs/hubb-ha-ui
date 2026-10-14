import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { HubbSheet } from '../../src/elements/sheet';
import type { HubbToast } from '../../src/elements/toast';
import { setEditing } from '../../src/editing';
import '../../src/screens/room-screen';
import type { HubbRoomScreen } from '../../src/screens/room-screen';
import { allLightIds, buildHouse } from '../../src/model/build-house';
import type { HubbConfig } from '../../src/model/types';
import { CASA2_CONFIG, casa2Hass } from '../fixtures/casa-exemplo-2';
import { admin, flush, withDashboard } from '../helpers/fake-dashboard';
import { area, makeHass, type FakeHass } from '../helpers/fake-hass';

async function mountRoom(h: FakeHass, options: HubbConfig, areaId: string): Promise<HubbRoomScreen> {
  const house = buildHouse(h, options);
  const el = document.createElement('hubb-room-screen') as HubbRoomScreen;
  el.setConfig({ type: 'custom:hubb-room-screen', room: house.rooms.find((r) => r.areaId === areaId)!, lightIds: allLightIds(house), options });
  el.hass = h;
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}

async function tap(el: HubbRoomScreen, button: Element | null | undefined): Promise<void> {
  (button as HTMLElement).click();
  await flush();
  await flush();
  await el.updateComplete;
}

const editor = (el: HubbRoomScreen) => el.shadowRoot!.querySelector('hubb-item-editor')!;
const $e = (el: HubbRoomScreen, sel: string) => editor(el).shadowRoot!.querySelector(sel);
const toastText = async (el: HubbRoomScreen): Promise<string> => {
  const toast = el.shadowRoot!.querySelector('hubb-toast') as HubbToast;
  await toast.updateComplete;
  return toast.shadowRoot!.querySelector('.toast')?.textContent ?? '';
};

async function openEditor(el: HubbRoomScreen, name: string): Promise<void> {
  const tile = [...el.shadowRoot!.querySelectorAll('.edit-tile')].find((t) => t.querySelector('.name')!.textContent === name)!;
  await tap(el, tile);
  await (editor(el) as unknown as { updateComplete: Promise<unknown> }).updateComplete;
}

describe('editing a room', () => {
  beforeEach(() => {
    history.replaceState(null, '', '/hubb-casa/escritorio');
  });
  afterEach(() => {
    setEditing(false);
    (document.querySelector('hubb-room-screen')?.shadowRoot?.querySelector('hubb-toast') as HubbToast | null)?.hide();
    document.body.replaceChildren();
  });

  it('shows Editar to an administrator, and in the edit mode an item opens its editor instead of switching', async () => {
    const resident = await mountRoom(casa2Hass(), CASA2_CONFIG, 'escritorio');
    expect(resident.shadowRoot!.querySelector('.edit')).toBeNull();
    document.body.replaceChildren();
    const h = admin(casa2Hass());
    const el = await mountRoom(h, CASA2_CONFIG, 'escritorio');
    await tap(el, el.shadowRoot!.querySelector('.edit'));
    expect(el.shadowRoot!.querySelectorAll('hubb-light-tile')).toHaveLength(0);
    await openEditor(el, 'Teto');
    const sheet = el.shadowRoot!.querySelector('hubb-sheet.item-sheet') as HubbSheet;
    expect(sheet.open).toBe(true);
    expect(sheet.heading).toBe('Teto');
    expect(h.calls).toEqual([]);
  });

  it('renames an item', async () => {
    const h = admin(casa2Hass());
    const saves = withDashboard(h, { strategy: { type: 'custom:hubb', ...CASA2_CONFIG } });
    setEditing(true);
    const el = await mountRoom(h, CASA2_CONFIG, 'escritorio');
    await openEditor(el, 'Teto');
    ($e(el, 'input.name') as HTMLInputElement).value = 'Luz do teto';
    await tap(el, $e(el, '.save-name'));
    expect((saves.at(-1)!.entities as Record<string, unknown>)['switch.escritorio_luz']).toEqual({ role: 'light', name: 'Luz do teto' });
    expect(await toastText(el)).toContain('Agora se chama Luz do teto.');
  });

  it('moves an item to another room', async () => {
    const h = admin(casa2Hass());
    const saves = withDashboard(h, { strategy: { type: 'custom:hubb', ...CASA2_CONFIG } });
    setEditing(true);
    const el = await mountRoom(h, CASA2_CONFIG, 'escritorio');
    await openEditor(el, 'Teto');
    const select = $e(el, 'select.room') as HTMLSelectElement;
    select.value = 'terraco';
    select.dispatchEvent(new Event('change'));
    await flush();
    await flush();
    expect((saves.at(-1)!.entities as Record<string, unknown>)['switch.escritorio_luz']).toEqual({ role: 'light', area: 'terraco' });
    expect(await toastText(el)).toContain('Teto foi para Terraço.');
  });

  it('shows an item as something else, or not at all', async () => {
    const h = admin(casa2Hass());
    const saves = withDashboard(h, { strategy: { type: 'custom:hubb', ...CASA2_CONFIG } });
    setEditing(true);
    const el = await mountRoom(h, CASA2_CONFIG, 'escritorio');
    await openEditor(el, 'Teto');
    const roles = [...editor(el).shadowRoot!.querySelectorAll('.role')];
    expect(roles.map((b) => b.textContent!.trim())).toEqual(['Luz', 'Tomada', 'Equipamento', 'Portão', 'Não mostrar']);
    expect(roles.filter((b) => b.classList.contains('current')).map((b) => b.textContent!.trim())).toEqual(['Luz']);
    await tap(el, roles[4]);
    expect((saves.at(-1)!.entities as Record<string, unknown>)['switch.escritorio_luz']).toEqual({ role: 'hidden' });
    expect(await toastText(el)).toContain('Teto não aparece mais no painel.');
  });

  it('changes the place of an item in its block', async () => {
    const h = admin(
      makeHass({
        areas: [area('escritorio', 'Escritório')],
        entities: [
          { entity_id: 'light.a', area_id: 'escritorio', name: 'Abajur', state: 'off' },
          { entity_id: 'light.b', area_id: 'escritorio', name: 'Teto', state: 'off' },
        ],
      }),
    );
    const saves = withDashboard(h, { strategy: { type: 'custom:hubb' } });
    setEditing(true);
    const el = await mountRoom(h, {}, 'escritorio');
    await openEditor(el, 'Teto');
    await tap(el, $e(el, '.before'));
    expect(saves.at(-1)!.entities).toEqual({ 'light.b': { order: 1 }, 'light.a': { order: 2 } });
    expect(await toastText(el)).toContain('Teto mudou de lugar.');
  });

  it('brings back what the configuration hides in the room', async () => {
    const h = admin(casa2Hass());
    const options: HubbConfig = { entities: { ...CASA2_CONFIG.entities, 'switch.jet_mode': { role: 'hidden' } } };
    const saves = withDashboard(h, { strategy: { type: 'custom:hubb', ...options } });
    setEditing(true);
    const el = await mountRoom(h, options, 'escritorio');
    const hidden = el.shadowRoot!.querySelector('.hidden-items')!;
    expect(hidden.textContent).toContain('Jet mode');
    await tap(el, hidden.querySelector('button'));
    expect(saves.at(-1)!.entities).toEqual(CASA2_CONFIG.entities);
    expect(await toastText(el)).toContain('Jet mode voltou para o painel.');
  });
});
