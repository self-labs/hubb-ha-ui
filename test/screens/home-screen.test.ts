import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '../../src/screens/home-screen';
import type { HubbHomeScreen } from '../../src/screens/home-screen';
import type { HubbRoomCard } from '../../src/elements/room-card';
import type { HubbSheet } from '../../src/elements/sheet';
import type { HubbToast } from '../../src/elements/toast';
import { buildHouse } from '../../src/model/build-house';
import { sampleHouseHass } from '../fixtures/sample-house';
import { area, makeHass, type FakeHass } from '../helpers/fake-hass';

async function mount(h: FakeHass, config = {}): Promise<HubbHomeScreen> {
  const el = document.createElement('hubb-home-screen') as HubbHomeScreen;
  el.setConfig({ type: 'custom:hubb-home-screen', house: buildHouse(h, config) });
  el.hass = h;
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}
const $ = (el: HubbHomeScreen, sel: string) => el.shadowRoot!.querySelector(sel);

describe('hubb-home-screen', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 9, 20, 0, 0));
    history.replaceState(null, '', '/hubb-casa/home');
  });
  afterEach(() => {
    vi.useRealTimers();
    document.body.replaceChildren();
  });

  it('refuses a config with no house', () => {
    const el = document.createElement('hubb-home-screen') as HubbHomeScreen;
    expect(() => el.setConfig({ type: 'custom:hubb-home-screen' } as never)).toThrow('hubb-home-screen: missing house');
  });

  it('greets the resident, names the house and shows the outside temperature', async () => {
    const el = await mount(sampleHouseHass(), { name: 'Casa Exemplo' });
    expect($(el, 'header h1')!.textContent).toBe('Boa noite, Ana');
    expect($(el, '.house')!.textContent).toBe('Casa Exemplo');
    expect($(el, '.weather')!.textContent).toBe('24°');
  });

  it('summarizes the house and lists every room', async () => {
    const el = await mount(sampleHouseHass());
    expect($(el, '.headline')!.textContent!.replace(/\s+/g, ' ').trim()).toBe('Cozinha com 1 luz acesa. O resto está apagado.');
    expect(el.shadowRoot!.querySelectorAll('.rooms hubb-room-card')).toHaveLength(3);
    expect($(el, '.chips .chip')!.textContent!.trim()).toBe('1 acesa');
  });

  it('opens the lights that are on, and turns them all off with undo', async () => {
    const h = sampleHouseHass();
    const el = await mount(h);
    ($(el, '.chips .chip') as HTMLButtonElement).click();
    await el.updateComplete;
    const sheet = $(el, 'hubb-sheet') as HubbSheet;
    expect(sheet.open).toBe(true);
    expect(sheet.heading).toBe('Luzes acesas');
    expect(sheet.querySelectorAll('hubb-light-tile')).toHaveLength(1);
    (sheet.querySelector('.primary.wide') as HTMLButtonElement).click();
    await Promise.resolve();
    expect(h.calls[0]).toEqual({ domain: 'light', service: 'turn_off', data: undefined, target: { entity_id: ['light.hubb_m1_saida_7'] } });
    await el.updateComplete;
    expect(sheet.open).toBe(false);
    const toast = $(el, 'hubb-toast') as HubbToast;
    await toast.updateComplete;
    expect(toast.shadowRoot!.querySelector('.toast span')!.textContent).toBe('1 luz apagada');
  });

  it('Apagar todas turns off only lights, even with an outlet on in the same room', async () => {
    const h = makeHass({
      areas: [area('cozinha', 'Cozinha')],
      entities: [
        { entity_id: 'light.bancada', area_id: 'cozinha', name: 'Bancada', state: 'on' },
        { entity_id: 'switch.geladeira', area_id: 'cozinha', name: 'Geladeira', state: 'on', attributes: { device_class: 'outlet' } },
      ],
    });
    const el = await mount(h);
    ($(el, '.chips .chip') as HTMLButtonElement).click();
    await el.updateComplete;
    const sheet = $(el, 'hubb-sheet') as HubbSheet;
    expect(sheet.querySelectorAll('hubb-outlet-tile')).toHaveLength(0);
    (sheet.querySelector('.primary.wide') as HTMLButtonElement).click();
    await Promise.resolve();
    expect(h.calls).toEqual([{ domain: 'light', service: 'turn_off', data: undefined, target: { entity_id: ['light.bancada'] } }]);
  });

  it('shows at most four scenes', async () => {
    const entities = ['a', 'b', 'c', 'd', 'e'].map((x) => ({ entity_id: `scene.${x}`, name: `Cena ${x}`, labels: ['hubb_cena'], state: 'unknown' }));
    const h = makeHass({
      areas: [area('sala', 'Sala')],
      entities: [{ entity_id: 'light.a', area_id: 'sala', state: 'off' }, ...entities],
    });
    const el = await mount(h);
    expect(el.shadowRoot!.querySelectorAll('.scenes hubb-scene-button')).toHaveLength(4);
  });

  it('shows an empty state when the house has no rooms, with the hint only for admins', async () => {
    const resident = await mount(makeHass({ entities: [{ entity_id: 'light.solta', state: 'off' }] }));
    expect($(resident, '.empty strong')!.textContent).toBe('Nenhum ambiente por aqui ainda.');
    expect($(resident, '.empty span')).toBeNull();
    document.body.replaceChildren();
    const admin = await mount(makeHass({ user: { id: 'a', name: 'Gustavo', is_admin: true } }));
    expect($(admin, '.empty span')!.textContent).toContain('Configurações');
  });

  it('still shows a house saved by 2026.10.2, before drawings and outlets existed', async () => {
    const h = sampleHouseHass();
    const house = buildHouse(h);
    const rooms = house.rooms.map((r) => {
      const old: Record<string, unknown> = { ...r };
      delete old.art;
      delete old.outlets;
      return old;
    });
    const el = document.createElement('hubb-home-screen') as HubbHomeScreen;
    el.setConfig({ type: 'custom:hubb-home-screen', house: { ...house, rooms: rooms as never } });
    el.hass = h;
    document.body.appendChild(el);
    await el.updateComplete;
    const cards = [...el.shadowRoot!.querySelectorAll('hubb-room-card')] as HubbRoomCard[];
    expect(cards).toHaveLength(3);
    await cards[0]!.updateComplete;
    expect(cards[0]!.shadowRoot!.querySelectorAll('svg.art path, svg.art rect, svg.art circle').length).toBeGreaterThan(0);
    expect(cards[0]!.shadowRoot!.querySelector('.status')!.textContent).toBe('1 acesa');
  });
});
