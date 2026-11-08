import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import '../../src/screens/scenes-screen';
import { setEditing } from '../../src/editing';
import type { HubbToast } from '../../src/elements/toast';
import { buildHouse } from '../../src/model/build-house';
import type { HubbConfig } from '../../src/model/types';
import type { HubbScreen } from '../../src/screens/base';
import { EDIT } from '../../src/strings';
import { admin, flush, withDashboard } from '../helpers/fake-dashboard';
import { area, makeHass, type FakeEntity, type FakeHass } from '../helpers/fake-hass';

// The room of a scene, the light it follows and the four of the home, chosen on Cenas in the edit
// mode (spec Cenas no cômodo, 07/11).

type Screen = HubbScreen & { setConfig(c: unknown): void };

const scene = (id: string, name: string): FakeEntity => ({ entity_id: `scene.${id}`, name, state: 'scening', labels: ['hubb_cena'] });

function clinic(): FakeHass {
  return admin(
    makeHass({
      areas: [area('recepcao', 'Recepção'), area('consultorio_1', 'Consultório 1')],
      entities: [
        { entity_id: 'light.teto', area_id: 'consultorio_1', name: 'Teto', state: 'off' },
        { entity_id: 'switch.spot', area_id: 'consultorio_1', name: 'Spot', state: 'off' },
        { entity_id: 'switch.escondido', area_id: 'consultorio_1', name: 'Escondido', state: 'off', hidden: true },
        { entity_id: 'switch.reiniciar', area_id: 'consultorio_1', name: 'Reiniciar', state: 'off', entity_category: 'config' },
        { entity_id: 'sensor.temp', area_id: 'consultorio_1', name: 'Temperatura', state: '24' },
        scene('atendimento', 'Atendimento'),
        scene('limpeza', 'Limpeza'),
        scene('relaxar', 'Relaxar'),
        scene('fim', 'Fim do dia'),
        scene('noite', 'Noite'),
      ],
    }),
  );
}

async function cenas(h: FakeHass, options: HubbConfig): Promise<Screen> {
  const house = buildHouse(h, options);
  const el = document.createElement('hubb-scenes-screen') as Screen;
  el.setConfig({ type: 'custom:hubb-scenes-screen', scenes: house.scenes, lightIds: [], options, candidates: house.sceneCandidates });
  el.hass = h;
  document.body.appendChild(el);
  await flush();
  await el.updateComplete;
  return el;
}

const rowOf = (el: Screen, name: string): Element =>
  [...el.shadowRoot!.querySelectorAll('.scene-edit')].find((r) => r.querySelector('strong')!.textContent === name)!;

async function pick(select: HTMLSelectElement, value: string): Promise<void> {
  select.value = value;
  select.dispatchEvent(new Event('change'));
  await flush();
  await flush();
}

const toastText = async (el: Screen): Promise<string> => {
  const toast = el.shadowRoot!.querySelector('hubb-toast') as HubbToast;
  await toast.updateComplete;
  return toast.shadowRoot!.querySelector('.toast span')?.textContent ?? '';
};

describe('a scene in the edit mode of Cenas', () => {
  beforeEach(() => {
    history.replaceState(null, '', '/hubb-casa/scenes');
    setEditing(true);
  });
  afterEach(() => {
    setEditing(false);
    for (const el of document.querySelectorAll('hubb-scenes-screen')) (el.shadowRoot?.querySelector('hubb-toast') as HubbToast | null)?.hide();
    document.body.replaceChildren();
  });

  it('offers the room of Home Assistant, none, then the rooms by name, and saves the pick', async () => {
    const h = clinic();
    const saves = withDashboard(h, { strategy: { type: 'custom:hubb' } });
    const el = await cenas(h, {});
    const select = rowOf(el, 'Atendimento').querySelector('select.scene-room') as HTMLSelectElement;
    expect([...select.options].map((o) => [o.value, o.textContent!.trim()])).toEqual([
      ['', 'Padrão (sem cômodo)'],
      ['none', EDIT.sceneRoomNone],
      ['consultorio_1', 'Consultório 1'],
      ['recepcao', 'Recepção'],
    ]);
    await pick(select, 'consultorio_1');
    expect(saves.at(-1)).toMatchObject({ entities: { 'scene.atendimento': { area: 'consultorio_1' } } });
    expect(await toastText(el)).toBe(EDIT.movedTo('Atendimento', 'Consultório 1'));
  });

  it('says which room Padrão is: the one the scene has in Home Assistant', async () => {
    const h = admin(
      makeHass({
        areas: [area('recepcao', 'Recepção')],
        entities: [{ ...scene('atendimento', 'Atendimento'), area_id: 'recepcao' }],
      }),
    );
    withDashboard(h, { strategy: { type: 'custom:hubb' } });
    const el = await cenas(h, {});
    const select = rowOf(el, 'Atendimento').querySelector('select.scene-room') as HTMLSelectElement;
    expect(select.options[0]!.textContent!.trim()).toBe('Padrão (Recepção)');
  });

  it('saves none, and Padrão takes the pick away', async () => {
    const h = clinic();
    const saves = withDashboard(h, { strategy: { type: 'custom:hubb', entities: { 'scene.atendimento': { area: 'recepcao' } } } });
    const el = await cenas(h, { entities: { 'scene.atendimento': { area: 'recepcao' } } });
    const select = () => rowOf(el, 'Atendimento').querySelector('select.scene-room') as HTMLSelectElement;
    // happy-dom misreads the value of a select whose options Lit marks selected; the attribute is what a browser reads.
    expect([...select().options].filter((o) => o.hasAttribute('selected')).map((o) => o.value)).toEqual(['recepcao']);
    await pick(select(), 'none');
    expect(saves.at(-1)).toMatchObject({ entities: { 'scene.atendimento': { area: 'none' } } });
    expect(await toastText(el)).toBe(EDIT.sceneRoomOff('Atendimento'));
    await pick(select(), '');
    expect((saves.at(-1)!.entities as Record<string, unknown> | undefined)?.['scene.atendimento']).toBeUndefined();
    expect(await toastText(el)).toBe(EDIT.sceneRoomBack('Atendimento'));
  });

  it('warns that whoever cannot see the room stops seeing the scene', async () => {
    const h = clinic();
    const options: HubbConfig = { rooms: { consultorio_1: { hidden_for: ['u2'] } } };
    withDashboard(h, { strategy: { type: 'custom:hubb', ...options } });
    const el = await cenas(h, options);
    await pick(rowOf(el, 'Atendimento').querySelector('select.scene-room') as HTMLSelectElement, 'consultorio_1');
    expect(await toastText(el)).toBe(`${EDIT.movedTo('Atendimento', 'Consultório 1')} ${EDIT.sceneRoomHiddenFor('Consultório 1')}`);
  });

  it('offers only the lights and switches of the panel to follow, and saves the pick', async () => {
    const h = clinic();
    const saves = withDashboard(h, { strategy: { type: 'custom:hubb' } });
    const el = await cenas(h, {});
    const select = () => rowOf(el, 'Atendimento').querySelector('select.scene-follows') as HTMLSelectElement;
    expect([...select().options].map((o) => o.value)).toEqual(['', 'switch.spot', 'light.teto']);
    expect(select().options[0]!.textContent!.trim()).toBe(EDIT.followsNone);
    await pick(select(), 'light.teto');
    expect(saves.at(-1)).toMatchObject({ entities: { 'scene.atendimento': { follows: 'light.teto' } } });
    expect(await toastText(el)).toBe(EDIT.followsSaved('Atendimento', 'Teto'));
    await pick(select(), '');
    expect((saves.at(-1)!.entities as Record<string, unknown> | undefined)?.['scene.atendimento']).toBeUndefined();
    expect(await toastText(el)).toBe(EDIT.followsCleared('Atendimento'));
  });

  it('names each light with the panel name and its room', async () => {
    const h = clinic();
    withDashboard(h, { strategy: { type: 'custom:hubb' } });
    const el = await cenas(h, { entities: { 'light.teto': { name: 'Luz geral' } } });
    const select = rowOf(el, 'Atendimento').querySelector('select.scene-follows') as HTMLSelectElement;
    expect([...select.options].slice(1).map((o) => [o.value, o.textContent!.trim()])).toEqual([
      ['light.teto', 'Luz geral · Consultório 1'],
      ['switch.spot', 'Spot · Consultório 1'],
    ]);
  });

  it('shows a light or a room that no longer exists, so None can still be picked to clear it', async () => {
    const h = clinic();
    const options: HubbConfig = { entities: { 'scene.atendimento': { follows: 'light.removida', area: 'area_removida' } } };
    const saves = withDashboard(h, { strategy: { type: 'custom:hubb', ...options } });
    const el = await cenas(h, options);
    const follows = () => rowOf(el, 'Atendimento').querySelector('select.scene-follows') as HTMLSelectElement;
    const first = follows().options[0]!;
    expect([first.disabled, first.hasAttribute('selected'), first.textContent!.trim()]).toEqual([true, true, 'light.removida']);
    const room = rowOf(el, 'Atendimento').querySelector('select.scene-room') as HTMLSelectElement;
    expect([room.options[0]!.disabled, room.options[0]!.textContent!.trim()]).toEqual([true, 'area_removida']);
    const none = [...follows().options].findIndex((o) => o.textContent!.trim() === EDIT.followsNone);
    follows().selectedIndex = none;
    follows().dispatchEvent(new Event('change'));
    await flush();
    await flush();
    expect((saves.at(-1)!.entities as Record<string, Record<string, unknown>>)['scene.atendimento']).toEqual({ area: 'area_removida' });
  });

  it('pins a scene to the home and takes it off', async () => {
    const h = clinic();
    const saves = withDashboard(h, { strategy: { type: 'custom:hubb' } });
    const el = await cenas(h, {});
    const pin = () => rowOf(el, 'Atendimento').querySelector('button.pin') as HTMLButtonElement;
    expect(pin().getAttribute('aria-pressed')).toBe('false');
    pin().click();
    await flush();
    await flush();
    expect(saves.at(-1)).toMatchObject({ entities: { 'scene.atendimento': { pinned: true } } });
    expect(await toastText(el)).toBe(EDIT.pinnedOn('Atendimento'));
    el.remove();
    const again = await cenas(h, { entities: { 'scene.atendimento': { pinned: true } } });
    const pinned = rowOf(again, 'Atendimento').querySelector('button.pin') as HTMLButtonElement;
    expect(pinned.getAttribute('aria-pressed')).toBe('true');
    pinned.click();
    await flush();
    await flush();
    expect((saves.at(-1)!.entities as Record<string, unknown> | undefined)?.['scene.atendimento']).toBeUndefined();
    expect(await toastText(again)).toBe(EDIT.pinnedOff('Atendimento'));
  });

  it('keeps a fifth scene from the home while four are pinned, and says why', async () => {
    const h = clinic();
    withDashboard(h, { strategy: { type: 'custom:hubb' } });
    const four = ['scene.atendimento', 'scene.limpeza', 'scene.relaxar', 'scene.fim'];
    const el = await cenas(h, { entities: Object.fromEntries(four.map((id) => [id, { pinned: true }])) });
    const row = rowOf(el, 'Noite');
    expect((row.querySelector('button.pin') as HTMLButtonElement).disabled).toBe(true);
    expect(row.querySelector('.pin-full')?.textContent?.trim()).toBe(EDIT.pinFull);
    expect((rowOf(el, 'Limpeza').querySelector('button.pin') as HTMLButtonElement).disabled).toBe(false);
  });

  it('puts the scene back where it was with Desfazer', async () => {
    const h = clinic();
    const saves = withDashboard(h, { strategy: { type: 'custom:hubb' } });
    const el = await cenas(h, {});
    await pick(rowOf(el, 'Atendimento').querySelector('select.scene-room') as HTMLSelectElement, 'consultorio_1');
    const toast = el.shadowRoot!.querySelector('hubb-toast') as HubbToast;
    await toast.updateComplete;
    (toast.shadowRoot!.querySelector('.toast button') as HTMLButtonElement).click();
    await flush();
    await flush();
    expect((saves.at(-1)!.entities as Record<string, unknown> | undefined)?.['scene.atendimento']).toBeUndefined();
  });
});
