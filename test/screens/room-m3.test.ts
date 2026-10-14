import { afterEach, describe, expect, it } from 'vitest';
import type { HubbSheet } from '../../src/elements/sheet';
import { setEditing } from '../../src/editing';
import '../../src/screens/room-screen';
import type { HubbRoomScreen } from '../../src/screens/room-screen';
import { allLightIds, buildHouse } from '../../src/model/build-house';
import type { HubbConfig } from '../../src/model/types';
import { admin, flush } from '../helpers/fake-dashboard';
import { area, makeHass, type FakeHass } from '../helpers/fake-hass';

function sala(): FakeHass {
  return makeHass({
    areas: [area('sala', 'Sala')],
    entities: [
      { entity_id: 'light.teto', area_id: 'sala', name: 'Teto', state: 'off' },
      { entity_id: 'cover.portao', area_id: 'sala', name: 'Portão', state: 'closed', attributes: { device_class: 'gate', supported_features: 3 } },
      { entity_id: 'lock.porta', area_id: 'sala', name: 'Porta', state: 'locked' },
      { entity_id: 'climate.ar', area_id: 'sala', name: 'Ar', state: 'off', attributes: { hvac_modes: ['off', 'cool'], supported_features: 1 } },
      { entity_id: 'fan.teto', area_id: 'sala', name: 'Ventilador', state: 'off', attributes: { supported_features: 1 | 16 | 32 } },
      { entity_id: 'cover.cortina', area_id: 'sala', name: 'Cortina', state: 'closed', attributes: { device_class: 'curtain', supported_features: 15 } },
      { entity_id: 'media_player.tv', area_id: 'sala', name: 'TV', state: 'off', attributes: { device_class: 'tv', supported_features: 128 | 256 } },
      { entity_id: 'switch.tomada', area_id: 'sala', name: 'Tomada', state: 'off', attributes: { device_class: 'outlet' } },
      { entity_id: 'button.toldo', area_id: 'sala', name: 'Abrir toldo', state: 'unknown' },
    ],
  });
}

const CONFIG: HubbConfig = { entities: { 'button.toldo': { role: 'action' } } };

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

async function ask(el: HubbRoomScreen, from: string, event: string, entityId: string): Promise<HubbSheet> {
  $(el, from)!.dispatchEvent(new CustomEvent(event, { detail: { entityId }, bubbles: true, composed: true }));
  await el.updateComplete;
  return [...el.shadowRoot!.querySelectorAll('hubb-sheet')].find((s) => (s as HubbSheet).open) as HubbSheet;
}

describe('the blocks of M3 on a room page', () => {
  afterEach(() => {
    setEditing(false);
    document.body.replaceChildren();
  });

  it('shows Acesso first and the new blocks between the lights and the outlets', async () => {
    const el = await mountRoom(sala());
    expect(headings(el)).toEqual(['Acesso', 'Luzes', 'Clima', 'Cortinas', 'Mídia', 'Tomadas e equipamentos', 'Ações']);
    expect(el.shadowRoot!.querySelectorAll('hubb-access-tile')).toHaveLength(2);
    expect(el.shadowRoot!.querySelectorAll('hubb-climate-card')).toHaveLength(1);
    expect(el.shadowRoot!.querySelectorAll('hubb-fan-tile')).toHaveLength(1);
    expect(el.shadowRoot!.querySelectorAll('hubb-cover-tile')).toHaveLength(1);
    expect(el.shadowRoot!.querySelectorAll('hubb-media-card')).toHaveLength(1);
  });

  it('opens the sheet of an air conditioner, a fan, a curtain and a TV', async () => {
    const el = await mountRoom(sala());
    let sheet = await ask(el, 'hubb-climate-card', 'hubb-open-climate', 'climate.ar');
    expect(sheet.heading).toBe('Ar');
    expect(sheet.subheading).toBe('Sala');
    expect((sheet.querySelector('hubb-climate-panel') as unknown as { entityId: string }).entityId).toBe('climate.ar');
    sheet.dispatchEvent(new CustomEvent('hubb-close'));
    await el.updateComplete;

    sheet = await ask(el, 'hubb-fan-tile', 'hubb-open-climate', 'fan.teto');
    expect(sheet.heading).toBe('Ventilador');
    expect((sheet.querySelector('hubb-climate-panel') as unknown as { entityId: string }).entityId).toBe('fan.teto');
    sheet.dispatchEvent(new CustomEvent('hubb-close'));
    await el.updateComplete;

    sheet = await ask(el, 'hubb-cover-tile', 'hubb-open-cover', 'cover.cortina');
    expect(sheet.heading).toBe('Cortina');
    expect((sheet.querySelector('hubb-cover-panel') as unknown as { entityId: string }).entityId).toBe('cover.cortina');
    sheet.dispatchEvent(new CustomEvent('hubb-close'));
    await el.updateComplete;

    sheet = await ask(el, 'hubb-media-card', 'hubb-open-media', 'media_player.tv');
    expect(sheet.heading).toBe('TV');
    expect((sheet.querySelector('hubb-media-panel') as unknown as { entityId: string }).entityId).toBe('media_player.tv');
    sheet.dispatchEvent(new CustomEvent('hubb-close'));
    await el.updateComplete;
    expect([...el.shadowRoot!.querySelectorAll('hubb-sheet')].some((s) => (s as HubbSheet).open)).toBe(false);
  });

  it('names each new kind in the edit mode, and its editor offers what fits', async () => {
    const el = await mountRoom(admin(sala()));
    ($(el, '.edit') as HTMLButtonElement).click();
    await flush();
    await el.updateComplete;
    const kinds = Object.fromEntries(
      [...el.shadowRoot!.querySelectorAll('.edit-tile')].map((t) => [t.querySelector('.name')!.textContent, t.querySelector('.kind')!.textContent]),
    );
    expect(kinds).toMatchObject({
      Portão: 'Portão',
      Porta: 'Fechadura',
      Ar: 'Ar-condicionado',
      Ventilador: 'Ventilador',
      Cortina: 'Cortina',
      TV: 'Mídia',
    });

    const roles = async (name: string): Promise<string[]> => {
      const tile = [...el.shadowRoot!.querySelectorAll('.edit-tile')].find((t) => t.querySelector('.name')!.textContent === name)!;
      (tile as HTMLButtonElement).click();
      await el.updateComplete;
      const editor = $(el, 'hubb-item-editor')!;
      await (editor as unknown as { updateComplete: Promise<unknown> }).updateComplete;
      const labels = [...editor.shadowRoot!.querySelectorAll('button.role')].map((b) => b.textContent!.trim());
      ($(el, 'hubb-sheet.item-sheet') as HubbSheet).dispatchEvent(new CustomEvent('hubb-close'));
      await el.updateComplete;
      return labels;
    };
    expect(await roles('Ar')).toEqual(['Ar-condicionado', 'Não mostrar']);
    expect(await roles('Cortina')).toEqual(['Cortina', 'Portão', 'Não mostrar']);
    expect(await roles('Porta')).toEqual(['Fechadura', 'Não mostrar']);
    expect(await roles('TV')).toEqual(['Mídia', 'Não mostrar']);
    expect(await roles('Portão')).toEqual(['Portão', 'Não mostrar']);
  });

  it('lets a curtain made a gate by hand go back to Cortinas', async () => {
    const h = admin(sala());
    const el = await mountRoom(h, { entities: { 'cover.cortina': { role: 'gate' } } });
    expect(el.shadowRoot!.querySelectorAll('hubb-access-tile')).toHaveLength(3);
    ($(el, '.edit') as HTMLButtonElement).click();
    await flush();
    await el.updateComplete;
    const tile = [...el.shadowRoot!.querySelectorAll('.edit-tile')].find((t) => t.querySelector('.name')!.textContent === 'Cortina')!;
    (tile as HTMLButtonElement).click();
    await el.updateComplete;
    const editor = $(el, 'hubb-item-editor')!;
    await (editor as unknown as { updateComplete: Promise<unknown> }).updateComplete;
    const buttons = [...editor.shadowRoot!.querySelectorAll('button.role')] as HTMLButtonElement[];
    expect(buttons.map((b) => b.textContent!.trim())).toEqual(['Cortina', 'Portão', 'Não mostrar']);
    const asked: unknown[] = [];
    editor.addEventListener('hubb-edit', (e) => asked.push((e as CustomEvent).detail));
    buttons[0]!.click();
    expect(asked).toEqual([{ entityId: 'cover.cortina', patch: { role: undefined }, message: 'Cortina agora aparece como Cortina.' }]);
  });
});
