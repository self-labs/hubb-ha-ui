import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setEditing } from '../src/editing';
import '../src/elements/item-editor';
import type { HubbToast } from '../src/elements/toast';
import { allLightIds, buildHouse } from '../src/model/build-house';
import { readConfig } from '../src/model/config';
import { sizeOf, sizesFor } from '../src/model/sizes';
import type { HubbConfig } from '../src/model/types';
import '../src/screens/room-screen';
import { HubbRoomScreen } from '../src/screens/room-screen';
import '../src/screens/scenes-screen';
import { HubbScenesScreen } from '../src/screens/scenes-screen';
import { admin, flush, USERS, withDashboard, withUsers } from './helpers/fake-dashboard';
import { area, makeHass, type FakeHass } from './helpers/fake-hass';

const cssOf = (styles: unknown): string => ([] as unknown[]).concat(styles).map((s) => (s as { cssText: string }).cssText).join('\n');

function sala(): FakeHass {
  return admin(
    makeHass({
      areas: [area('sala', 'Sala')],
      entities: [
        { entity_id: 'light.teto', area_id: 'sala', name: 'Teto', state: 'off' },
        { entity_id: 'light.abajur', area_id: 'sala', name: 'Abajur', state: 'off' },
        { entity_id: 'climate.ar', area_id: 'sala', name: 'Ar', state: 'off', attributes: { hvac_modes: ['off', 'cool'] } },
        { entity_id: 'scene.noite', area_id: 'sala', name: 'Noite', state: 'scening', labels: ['hubb_cena'] },
        { entity_id: 'scene.cinema', area_id: 'sala', name: 'Cinema', state: 'scening', labels: ['hubb_cena'] },
      ],
    }),
  );
}

type Screen = HTMLElement & { hass: FakeHass; setConfig(c: unknown): void; updateComplete: Promise<unknown> };

async function room(h: FakeHass, options: HubbConfig): Promise<Screen> {
  const house = buildHouse(h, options);
  const el = document.createElement('hubb-room-screen') as Screen;
  el.setConfig({ type: 'custom:hubb-room-screen', room: house.rooms[0]!, lightIds: allLightIds(house), options });
  el.hass = h;
  document.body.appendChild(el);
  await flush();
  await el.updateComplete;
  return el;
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

const sizeClass = (el: Element | null | undefined) => [...(el?.classList ?? [])].find((c) => c.startsWith('size-'));

describe('the size of each card', () => {
  beforeEach(() => history.replaceState(null, '', '/hubb-casa/sala'));
  afterEach(() => {
    setEditing(false);
    for (const el of document.querySelectorAll('hubb-room-screen, hubb-scenes-screen')) (el.shadowRoot?.querySelector('hubb-toast') as HubbToast | null)?.hide();
    document.body.replaceChildren();
  });

  it('keeps today\'s look without a choice, and offers the sizes that fit each kind', () => {
    expect([sizeOf({}, 'light.teto', 'light'), sizeOf({}, 'climate.ar', 'climate'), sizeOf({}, 'scene.noite', 'scene')]).toEqual(['small', 'large', 'medium']);
    expect(sizesFor('light')).toEqual(['small', 'medium', 'large']);
    // A card with buttons or a slide takes the whole row: on half a phone row its text runs under them.
    expect(sizesFor('climate')).toEqual(['large']);
    const options = { entities: { 'light.teto': { size: 'large' }, 'climate.ar': { size: 'small' } } } as HubbConfig;
    expect([sizeOf(options, 'light.teto', 'light'), sizeOf(options, 'climate.ar', 'climate')]).toEqual(['large', 'large']);
  });

  it('says so when the YAML asks for a size that does not exist', () => {
    const r = readConfig(sala(), { entities: { 'light.teto': { size: 'enorme' } } } as unknown as HubbConfig);
    expect(r.problems.map((p) => [p.key, p.message])).toEqual([['entities.light.teto.size', 'size: enorme não existe. Use small, medium ou large.']]);
  });

  it('lays the cards of a room on six columns: a third, half or the whole row', async () => {
    const el = await room(sala(), { entities: { 'light.abajur': { size: 'medium' } } } as HubbConfig);
    const tiles = [...el.shadowRoot!.querySelectorAll('hubb-light-tile')];
    expect(tiles.map((t) => sizeClass(t))).toEqual(['size-medium', 'size-small']);
    expect(sizeClass(el.shadowRoot!.querySelector('hubb-climate-card'))).toBe('size-large');
    const css = cssOf(HubbRoomScreen.styles);
    expect(css).toMatch(/\.grid\s*\{[^}]*grid-template-columns: repeat\(6, minmax\(0, 1fr\)\)/);
    expect(css).toMatch(/\.size-medium\s*\{[^}]*grid-column: span 3/);
  });

  it('lets the installer pick the size in the editor of an item', async () => {
    const h = sala();
    const editor = document.createElement('hubb-item-editor') as HTMLElement & { hass: FakeHass; item: unknown; roomAreaId: string; settings: unknown; updateComplete: Promise<unknown> };
    editor.hass = h;
    editor.item = { entityId: 'light.teto', name: 'Teto', kind: 'light', siblings: ['light.teto', 'light.abajur'] };
    editor.roomAreaId = 'sala';
    document.body.appendChild(editor);
    await editor.updateComplete;
    const sizes = [...editor.shadowRoot!.querySelectorAll('button.size')] as HTMLButtonElement[];
    expect(sizes.map((b) => [b.textContent!.trim(), b.getAttribute('aria-pressed')])).toEqual([
      ['Pequeno', 'true'],
      ['Médio', 'false'],
      ['Grande', 'false'],
    ]);
    let asked: unknown = null;
    editor.addEventListener('hubb-edit', (e) => (asked = (e as CustomEvent).detail));
    sizes[1]!.click();
    expect(asked).toEqual({ entityId: 'light.teto', patch: { size: 'medium' }, message: 'Teto: tamanho médio.' });
  });

  it('shows the scenes of Cenas two to a row, a small one as a tile, and the installer picks the size', async () => {
    const h = sala();
    const saves = withDashboard(h, { strategy: { type: 'custom:hubb' } });
    withUsers(h, USERS);
    const el = await cenas(h, { entities: { 'scene.noite': { size: 'small' } } } as HubbConfig);
    const buttons = [...el.shadowRoot!.querySelectorAll('hubb-scene-button')];
    expect(buttons.map((b) => [b.getAttribute('variant'), sizeClass(b)])).toEqual([
      ['row', 'size-medium'],
      ['tile', 'size-small'],
    ]);
    expect(cssOf(HubbScenesScreen.styles)).toMatch(/\.list\s*\{[^}]*grid-template-columns: repeat\(6, minmax\(0, 1fr\)\)/);
    el.remove();
    setEditing(true);
    const edit = await cenas(h, {});
    const row = [...edit.shadowRoot!.querySelectorAll('.scene-edit')].find((r) => r.querySelector('strong')!.textContent === 'Noite')!;
    (row.querySelectorAll('button.size')[2] as HTMLButtonElement).click();
    await flush();
    await flush();
    expect(saves.at(-1)).toMatchObject({ entities: { 'scene.noite': { size: 'large' } } });
  });
});
