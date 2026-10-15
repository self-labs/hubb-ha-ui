import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setEditing } from '../src/editing';
import type { HubbToast } from '../src/elements/toast';
import { allLightIds, buildHouse } from '../src/model/build-house';
import type { HubbConfig } from '../src/model/types';
import '../src/screens/home-screen';
import '../src/screens/room-screen';
import '../src/screens/scenes-screen';
import { sampleHouseHass } from './fixtures/sample-house';
import { admin, flush, USERS, withDashboard, withUsers } from './helpers/fake-dashboard';
import { area, makeHass, type FakeHass } from './helpers/fake-hass';

type Screen = HTMLElement & { hass: FakeHass; setConfig(c: unknown): void; updateComplete: Promise<unknown> };

async function mount(tag: string, config: Record<string, unknown>, h: FakeHass): Promise<Screen> {
  const el = document.createElement(tag) as Screen;
  el.setConfig({ type: `custom:${tag}`, ...config });
  el.hass = h;
  document.body.appendChild(el);
  await flush();
  await el.updateComplete;
  return el;
}

/** Home Assistant rebuilds the views after a save: the old screen goes, a new one comes. */
async function rebuild(old: Screen, tag: string, config: Record<string, unknown>, h: FakeHass): Promise<Screen> {
  old.remove();
  return mount(tag, config, h);
}

async function tapPerson(el: Screen, person: number): Promise<void> {
  const picker = el.shadowRoot!.querySelector('hubb-sheet.people hubb-people-picker, hubb-item-editor') as HTMLElement & {
    updateComplete: Promise<unknown>;
  };
  const inner = picker.localName === 'hubb-item-editor' ? (picker.shadowRoot!.querySelector('hubb-people-picker') as typeof picker) : picker;
  await flush();
  await inner.updateComplete;
  (inner.shadowRoot!.querySelectorAll('.person')[person] as HTMLButtonElement).click();
  await flush();
  await flush();
  await el.updateComplete;
}

const sheetOpen = (el: Screen, sel: string) => el.shadowRoot!.querySelector(sel)!.hasAttribute('open');

describe('the Quem vê sheet stays open while the installer taps one person after another', () => {
  beforeEach(() => history.replaceState(null, '', '/hubb-casa/home'));
  afterEach(() => {
    setEditing(false);
    for (const el of document.querySelectorAll('hubb-home-screen, hubb-room-screen, hubb-scenes-screen')) {
      (el.shadowRoot?.querySelector('hubb-toast') as HubbToast | null)?.hide();
    }
    document.body.replaceChildren();
  });

  it('on the home: the sheet of a room stays open after a tap and opens again on the rebuilt home', async () => {
    const h = admin(sampleHouseHass());
    withDashboard(h, { strategy: { type: 'custom:hubb' } });
    withUsers(h, USERS);
    setEditing(true);
    const config = { house: buildHouse(h, {}), options: {} };
    let el = await mount('hubb-home-screen', config, h);
    const room = [...el.shadowRoot!.querySelectorAll('.room-edit')].find((r) => r.getAttribute('data-name') === 'Cozinha')!;
    (room.querySelector('.tool.people') as HTMLButtonElement).click();
    await el.updateComplete;
    await tapPerson(el, 1);
    expect(sheetOpen(el, 'hubb-sheet.people')).toBe(true);
    el = await rebuild(el, 'hubb-home-screen', config, h);
    expect(sheetOpen(el, 'hubb-sheet.people')).toBe(true);
    expect(el.shadowRoot!.querySelector('hubb-sheet.people')!.getAttribute('subheading')).toBe('Cozinha');
  });

  it('on Cenas: the sheet of the tab opens again on the rebuilt screen', async () => {
    const h = admin(sampleHouseHass());
    withDashboard(h, { strategy: { type: 'custom:hubb' } });
    withUsers(h, USERS);
    setEditing(true);
    const config = { scenes: [], lightIds: [], options: {} as HubbConfig, candidates: [] };
    let el = await mount('hubb-scenes-screen', config, h);
    (el.shadowRoot!.querySelector('.tab-people') as HTMLButtonElement).click();
    await el.updateComplete;
    await tapPerson(el, 1);
    el = await rebuild(el, 'hubb-scenes-screen', config, h);
    expect(sheetOpen(el, 'hubb-sheet.people')).toBe(true);
    expect(el.shadowRoot!.querySelector('hubb-sheet.people')!.getAttribute('heading')).toBe('Quem vê esta aba');
  });

  it('on a room page: the editor of an item stays open after a Quem vê tap and opens again on the rebuilt page', async () => {
    const h = admin(
      makeHass({
        areas: [area('sala', 'Sala')],
        entities: [
          { entity_id: 'light.teto', area_id: 'sala', name: 'Teto', state: 'off' },
          { entity_id: 'light.abajur', area_id: 'sala', name: 'Abajur', state: 'off' },
        ],
      }),
    );
    withDashboard(h, { strategy: { type: 'custom:hubb' } });
    withUsers(h, USERS);
    setEditing(true);
    const house = buildHouse(h, {});
    const config = { room: house.rooms[0]!, lightIds: allLightIds(house), options: {} };
    let el = await mount('hubb-room-screen', config, h);
    const tile = [...el.shadowRoot!.querySelectorAll('.edit-tile')].find((t) => t.querySelector('.name')!.textContent === 'Abajur') as HTMLButtonElement;
    tile.click();
    await el.updateComplete;
    await tapPerson(el, 1);
    const editorSheet = () => [...el.shadowRoot!.querySelectorAll('hubb-sheet')].find((s) => s.querySelector('hubb-item-editor'));
    expect(editorSheet()?.hasAttribute('open')).toBe(true);
    el = await rebuild(el, 'hubb-room-screen', config, h);
    expect(editorSheet()?.getAttribute('heading')).toBe('Abajur');
  });

  it('forgets the sheet when the installer closes it, or leaves the edit mode', async () => {
    const h = admin(sampleHouseHass());
    withDashboard(h, { strategy: { type: 'custom:hubb' } });
    withUsers(h, USERS);
    setEditing(true);
    const config = { scenes: [], lightIds: [], options: {} as HubbConfig, candidates: [] };
    let el = await mount('hubb-scenes-screen', config, h);
    (el.shadowRoot!.querySelector('.tab-people') as HTMLButtonElement).click();
    await el.updateComplete;
    await tapPerson(el, 1);
    el.shadowRoot!.querySelector('hubb-sheet.people')!.dispatchEvent(new CustomEvent('hubb-close'));
    await el.updateComplete;
    el = await rebuild(el, 'hubb-scenes-screen', config, h);
    expect(sheetOpen(el, 'hubb-sheet.people')).toBe(false);
    (el.shadowRoot!.querySelector('.tab-people') as HTMLButtonElement).click();
    await el.updateComplete;
    setEditing(false);
    setEditing(true);
    el = await rebuild(el, 'hubb-scenes-screen', config, h);
    expect(sheetOpen(el, 'hubb-sheet.people')).toBe(false);
  });
});
