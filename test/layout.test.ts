import { afterEach, describe, expect, it } from 'vitest';
import '../src/elements/room-card';
import { HubbRoomCard } from '../src/elements/room-card';
import '../src/screens/home-screen';
import '../src/screens/room-screen';
import { HubbHomeScreen } from '../src/screens/home-screen';
import { HubbRoomScreen } from '../src/screens/room-screen';
import { HubbScreen } from '../src/screens/base';
import { allLightIds, buildHouse } from '../src/model/build-house';
import type { Room } from '../src/model/types';
import { area, makeHass, withState, type FakeHass } from './helpers/fake-hass';

const cssOf = (styles: unknown): string =>
  ([] as unknown[]).concat(styles).map((s) => (s as { cssText: string }).cssText).join('\n');

function sala(): FakeHass {
  return makeHass({
    areas: [area('sala', 'Sala'), area('quarto', 'Quarto')],
    entities: [
      { entity_id: 'light.sofa', area_id: 'sala', name: 'Sofá', state: 'off' },
      { entity_id: 'light.cama', area_id: 'quarto', name: 'Cama', state: 'off' },
    ],
  });
}

describe('nothing jumps when a light turns on', () => {
  afterEach(() => { document.body.replaceChildren(); });

  it('the room keeps its "Apagar tudo" slot while everything is off, disabled and invisible', async () => {
    const h = sala();
    const house = buildHouse(h);
    const el = document.createElement('hubb-room-screen') as HubbRoomScreen;
    el.setConfig({ type: 'custom:hubb-room-screen', room: house.rooms.find((r) => r.areaId === 'sala')!, lightIds: allLightIds(house) });
    el.hass = h;
    document.body.appendChild(el);
    await el.updateComplete;
    const off = el.shadowRoot!.querySelector('.actions .primary') as HTMLButtonElement;
    expect(off).not.toBeNull();
    expect(off.disabled).toBe(true);
    expect(off.classList.contains('idle')).toBe(true);
    el.hass = withState(h, 'light.sofa', 'on');
    await el.updateComplete;
    const on = el.shadowRoot!.querySelector('.actions .primary') as HTMLButtonElement;
    expect(on.disabled).toBe(false);
    expect(on.classList.contains('idle')).toBe(false);
    expect(cssOf(HubbRoomScreen.styles)).toMatch(/\.primary\.idle\s*\{[^}]*visibility: hidden/);
  });

  it('the home keeps the chip row and two lines of headline even when everything is off', async () => {
    const h = sala();
    const el = document.createElement('hubb-home-screen') as HubbHomeScreen;
    el.setConfig({ type: 'custom:hubb-home-screen', house: buildHouse(h) });
    el.hass = h;
    document.body.appendChild(el);
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.chips')).not.toBeNull();
    const css = cssOf(HubbHomeScreen.styles);
    expect(css).toMatch(/\.chips\s*\{[^}]*min-height: 44px/);
    // The chip is a touch target too: 44 px, like every other button.
    expect(css).toMatch(/\.chip\s*\{[^}]*min-height: 44px/);
    expect(css).toMatch(/\.headline\s*\{[^}]*min-height: calc\(2 \* 1\.3em\)/);
  });
});

describe('top spacing', () => {
  it('leaves the status bar to Home Assistant instead of adding the safe area a second time', () => {
    expect(cssOf(HubbScreen.baseStyles)).not.toContain('safe-area-inset-top');
    expect(cssOf(HubbRoomScreen.styles)).not.toContain('safe-area-inset-top');
  });
});

describe('room card shading', () => {
  afterEach(() => { document.body.replaceChildren(); });

  const room = (photo: string | null): Room => ({
    areaId: 'sala',
    path: 'sala',
    name: 'Sala',
    photo,
    icon: null,
    art: 'sala',
    floorId: null,
    lights: [{ entityId: 'light.sofa', name: 'Sofá', dimmable: false }],
    outlets: [],
    equipment: [],
    appliances: [],
    actions: [],
    climate: [],
    covers: [],
    media: [],
    access: [],
    scenes: [],
    hidden: [],
    openings: [],
    presence: [],
    temperature: null,
    humidity: null,
    sensors: [],
    hiddenFor: [],
  });

  it('darkens the bottom only over a photo, so dark text on the plain Areia card stays readable', async () => {
    for (const [photo, expected] of [['/local/sala.jpg', true], [null, false]] as const) {
      const el = document.createElement('hubb-room-card') as HubbRoomCard;
      el.hass = sala();
      el.room = room(photo);
      document.body.appendChild(el);
      await el.updateComplete;
      expect(el.shadowRoot!.querySelector('button.room')!.classList.contains('photo')).toBe(expected);
    }
    const css = cssOf(HubbRoomCard.styles);
    expect(css).toMatch(/\.room\s*\{[^}]*background: var\(--hubb-surface\)/);
    expect(css).toMatch(/\.room\.photo\s*\{[^}]*rgba\(0, 0, 0/);
  });
});

describe('appliances fit on a phone', () => {
  it('lets the appliance card span two of the three columns, so its state line does not wrap', async () => {
    const { HubbRoomScreen: Screen } = await import('../src/screens/room-screen');
    expect(cssOf(Screen.styles)).toMatch(/hubb-appliance-card\s*\{[^}]*grid-column: span 2/);
  });

  it('lays the options of the appliance sheet in two columns, so their names fit', async () => {
    const { HubbAppliancePanel } = await import('../src/elements/appliance-panel');
    expect(cssOf(HubbAppliancePanel.styles)).toMatch(/\.options\s*\{[^}]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  });

  it('fits the arrows and Esconder under a half-width room card in the edit mode', async () => {
    const { HubbHomeScreen: Home } = await import('../src/screens/home-screen');
    expect(cssOf(Home.styles)).toMatch(/\.room-tools\s*\{[^}]*grid-template-columns: 40px 40px minmax\(0, 1fr\)/);
  });
});
