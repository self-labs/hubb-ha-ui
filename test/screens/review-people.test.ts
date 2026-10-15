import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { HubbToast } from '../../src/elements/toast';
import type { HubbConfig } from '../../src/model/types';
import '../../src/screens/review-screen';
import { admin, flush, USERS, withDashboard, withUsers } from '../helpers/fake-dashboard';
import { area, makeHass, type FakeHass } from '../helpers/fake-hass';

const options: HubbConfig = {
  type: 'custom:hubb',
  rooms: { kitnet: { hidden_for: ['u_lia', 'u_saiu'] } },
  entities: { 'light.sala': { hidden_for: ['u_saiu'] } },
};

function house(fail = false): { h: FakeHass; saves: Record<string, unknown>[] } {
  const h = admin(
    makeHass({
      areas: [area('sala', 'Sala'), area('kitnet', 'Kitnet')],
      entities: [{ entity_id: 'light.sala', area_id: 'sala', name: 'Teto', state: 'off', attributes: { friendly_name: 'Teto da Sala' } }],
    }),
  );
  const saves = withDashboard(h, { strategy: options });
  withUsers(h, USERS, fail);
  return { h, saves };
}

async function mount(h: FakeHass) {
  const el = document.createElement('hubb-review-screen') as HTMLElement & { hass: FakeHass; setConfig(c: unknown): void; updateComplete: Promise<unknown> };
  el.setConfig({ type: 'custom:hubb-review-screen', options });
  el.hass = h;
  document.body.appendChild(el);
  await flush();
  await el.updateComplete;
  return el;
}

const group = (el: HTMLElement) => [...el.shadowRoot!.querySelectorAll('h2')].find((h2) => h2.textContent!.startsWith('Pessoas que não existem mais'));

describe('people who no longer exist', () => {
  beforeEach(() => history.replaceState(null, '', '/hubb-casa/revisar'));
  afterEach(() => {
    (document.querySelector('hubb-review-screen')?.shadowRoot?.querySelector('hubb-toast') as HubbToast | null)?.hide();
    document.body.replaceChildren();
  });

  it('lists each room and item hidden for a user Home Assistant no longer has, and cleans it', async () => {
    const { h, saves } = house();
    const el = await mount(h);
    expect(group(el)!.textContent).toBe('Pessoas que não existem mais (2)');
    const items = group(el)!.nextElementSibling!.querySelectorAll('li');
    expect([...items].map((li) => li.querySelector('strong')!.textContent)).toEqual(['Kitnet', 'Teto da Sala']);
    (items[0]!.querySelector('button.clean') as HTMLButtonElement).click();
    await flush();
    await flush();
    expect(saves.at(-1)).toMatchObject({ rooms: { kitnet: { hidden_for: ['u_lia'] } } });
    (items[1]!.querySelector('button.clean') as HTMLButtonElement).click();
    await flush();
    await flush();
    expect((saves.at(-1) as { entities?: Record<string, unknown> }).entities?.['light.sala']).toBeUndefined();
  });

  it('offers nothing to clean when it could not read the users', async () => {
    const { h } = house(true);
    const el = await mount(h);
    expect(group(el)).toBeUndefined();
  });
});
