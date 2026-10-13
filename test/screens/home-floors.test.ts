import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { HubbFloorTabs } from '../../src/elements/floor-tabs';
import type { HubbNavBar } from '../../src/elements/nav-bar';
import '../../src/screens/home-screen';
import type { HubbHomeScreen } from '../../src/screens/home-screen';
import { buildHouse } from '../../src/model/build-house';
import type { HubbConfig } from '../../src/model/types';
import { CLINIC_CONFIG, clinicHass } from '../fixtures/clinic';
import { sampleHouseHass } from '../fixtures/sample-house';
import type { FakeHass } from '../helpers/fake-hass';

async function mountHome(h: FakeHass, config: HubbConfig): Promise<HubbHomeScreen> {
  const el = document.createElement('hubb-home-screen') as HubbHomeScreen;
  el.setConfig({ type: 'custom:hubb-home-screen', house: buildHouse(h, config) });
  el.hass = h;
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}

const roomNames = async (el: HubbHomeScreen): Promise<string[]> => {
  const cards = [...el.shadowRoot!.querySelectorAll('.rooms hubb-room-card')];
  await Promise.all(cards.map((c) => (c as unknown as { updateComplete: Promise<unknown> }).updateComplete));
  return cards.map((c) => c.shadowRoot!.querySelector('.name')!.textContent!);
};

const floorTabs = (el: HubbHomeScreen) => el.shadowRoot!.querySelector('hubb-floor-tabs') as HubbFloorTabs | null;

describe('the home, one floor at a time', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 12, 9, 0, 0));
    history.replaceState(null, '', '/hubb-clinica/home');
    localStorage.clear();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    document.body.replaceChildren();
  });

  it('opens on the lowest floor and shows only its rooms, with the sentence still about the whole place', async () => {
    const el = await mountHome(clinicHass(), CLINIC_CONFIG);
    expect(floorTabs(el)!.current).toBe('terreo');
    expect(await roomNames(el)).toEqual(['Espera', 'Recepção']);
    expect(el.shadowRoot!.querySelector('.headline')!.textContent!.replace(/\s+/g, ' ').trim()).toBe(
      '3 luzes acesas em 2 ambientes. Recepção e Sala 1.',
    );
    expect(el.shadowRoot!.querySelector('.chips .chip')!.textContent!.trim()).toBe('3 acesas');
  });

  it('switches floor on a tap and remembers it on the device', async () => {
    const el = await mountHome(clinicHass(), CLINIC_CONFIG);
    const tabs = floorTabs(el)!;
    await tabs.updateComplete;
    (tabs.shadowRoot!.querySelectorAll('button')[1] as HTMLButtonElement).click();
    await el.updateComplete;
    expect(await roomNames(el)).toEqual(['Consultório 3', 'Esterilização', 'Sala 1', 'Sala 2']);
    expect(localStorage.getItem('hubb-floor:/hubb-clinica')).toBe('primeiro');
    document.body.replaceChildren();
    const again = await mountHome(clinicHass(), CLINIC_CONFIG);
    expect(floorTabs(again)!.current).toBe('primeiro');
  });

  it('opens on the first tab when the remembered floor is gone', async () => {
    localStorage.setItem('hubb-floor:/hubb-clinica', 'apagado');
    const el = await mountHome(clinicHass(), CLINIC_CONFIG);
    expect(floorTabs(el)!.current).toBe('terreo');
    expect(await roomNames(el)).toEqual(['Espera', 'Recepção']);
  });

  it('opens on the first tab when the browser keeps no storage', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    const el = await mountHome(clinicHass(), CLINIC_CONFIG);
    expect(floorTabs(el)!.current).toBe('terreo');
  });

  it('keeps a single list, under Ambientes, when the rooms are not on two or more floors', async () => {
    const el = await mountHome(sampleHouseHass(), {});
    expect(floorTabs(el)).toBeNull();
    expect([...el.shadowRoot!.querySelectorAll('main h2')].map((h) => h.textContent)).toContain('Ambientes');
    expect(await roomNames(el)).toEqual(['Cozinha', 'Quarto', 'Sala']);
  });

  it('names the first tab of the bottom bar after the place', async () => {
    const el = await mountHome(clinicHass(), CLINIC_CONFIG);
    expect((el.shadowRoot!.querySelector('hubb-nav-bar') as HubbNavBar).homeLabel).toBe('Início');
  });
});
