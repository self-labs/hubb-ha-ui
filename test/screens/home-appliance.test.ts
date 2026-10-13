import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { HubbRoomCard } from '../../src/elements/room-card';
import type { HubbSheet } from '../../src/elements/sheet';
import '../../src/screens/home-screen';
import type { HubbHomeScreen } from '../../src/screens/home-screen';
import { buildHouse } from '../../src/model/build-house';
import { CASA2_CONFIG, casa2Hass } from '../fixtures/casa-exemplo-2';
import type { FakeHass } from '../helpers/fake-hass';

async function mountHome(h: FakeHass): Promise<HubbHomeScreen> {
  const el = document.createElement('hubb-home-screen') as HubbHomeScreen;
  el.setConfig({ type: 'custom:hubb-home-screen', house: buildHouse(h, CASA2_CONFIG) });
  el.hass = h;
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}

const chips = (el: HubbHomeScreen) => [...el.shadowRoot!.querySelectorAll('.chips .chip')].map((c) => c.textContent!.trim());

async function cardStatus(el: HubbHomeScreen, name: string): Promise<string> {
  for (const card of el.shadowRoot!.querySelectorAll('hubb-room-card')) {
    await (card as HubbRoomCard).updateComplete;
    if (card.shadowRoot!.querySelector('.name')!.textContent === name) return card.shadowRoot!.querySelector('.status')!.textContent!;
  }
  return '';
}

describe('the appliance on the home', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 12, 15, 0, 0));
    history.replaceState(null, '', '/hubb-casa/home');
  });
  afterEach(() => {
    vi.useRealTimers();
    document.body.replaceChildren();
  });

  it('shows a working appliance next to the lights chip, and opens its sheet on the home', async () => {
    const el = await mountHome(casa2Hass('Running', '40'));
    expect(chips(el)).toEqual(['1 acesa', 'Lavadora · 40 min']);
    expect(await cardStatus(el, 'Terraço')).toBe('Lavadora · 40 min');
    (el.shadowRoot!.querySelectorAll('.chips .chip')[1] as HTMLButtonElement).click();
    await el.updateComplete;
    const sheet = el.shadowRoot!.querySelector('hubb-sheet.appliance') as HubbSheet;
    expect(sheet.open).toBe(true);
    expect(sheet.heading).toBe('Lavadora');
    expect(sheet.querySelector('hubb-appliance-panel')).not.toBeNull();
  });

  it('shows no appliance chip while it is stopped', async () => {
    const el = await mountHome(casa2Hass('Idle', '80'));
    expect(chips(el)).toEqual(['1 acesa']);
    expect(await cardStatus(el, 'Terraço')).toBe('Apagado');
  });
});
