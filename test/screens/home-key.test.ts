import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '../../src/screens/home-screen';
import type { HubbHomeScreen } from '../../src/screens/home-screen';
import { buildHouse } from '../../src/model/build-house';
import type { HubbConfig } from '../../src/model/types';
import { CASA2_CONFIG, casa2Hass } from '../fixtures/casa-exemplo-2';
import type { FakeHass } from '../helpers/fake-hass';

async function mountHome(h: FakeHass, options: HubbConfig): Promise<HubbHomeScreen> {
  const el = document.createElement('hubb-home-screen') as HubbHomeScreen;
  el.setConfig({ type: 'custom:hubb-home-screen', house: buildHouse(h, options), options });
  el.hass = h;
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}

function admin(h: FakeHass): FakeHass {
  h.user = { id: 'u1', name: 'Gustavo Exemplo', is_admin: true };
  return h;
}

describe('the review key on the home', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 12, 15, 0, 0));
    history.replaceState(null, '', '/hubb-casa/home');
  });
  afterEach(() => {
    vi.useRealTimers();
    document.body.replaceChildren();
  });

  it('shows the key with the number of items to an administrator, and opens the review', async () => {
    const el = await mountHome(admin(casa2Hass()), CASA2_CONFIG);
    const key = el.shadowRoot!.querySelector('.key') as HTMLButtonElement;
    expect(key.querySelector('.badge')!.textContent).toBe('1');
    expect(key.getAttribute('aria-label')).toBe('Revisar o painel: 1 pendência');
    key.click();
    expect(location.pathname).toBe('/hubb-casa/revisar');
  });

  it('shows the key with no number when there is nothing to review', async () => {
    const el = await mountHome(admin(casa2Hass()), { entities: { ...CASA2_CONFIG.entities, 'switch.jet_mode': { role: 'hidden' } } });
    const key = el.shadowRoot!.querySelector('.key')!;
    expect(key.querySelector('.badge')).toBeNull();
    expect(key.getAttribute('aria-label')).toBe('Revisar o painel');
  });

  it('shows no key to a resident', async () => {
    const el = await mountHome(casa2Hass(), CASA2_CONFIG);
    expect(el.shadowRoot!.querySelector('.key')).toBeNull();
  });

  it('shows no key on a dashboard frozen before the review existed, which has no review view', async () => {
    const h = admin(casa2Hass());
    const el = document.createElement('hubb-home-screen') as HubbHomeScreen;
    el.setConfig({ type: 'custom:hubb-home-screen', house: buildHouse(h, CASA2_CONFIG) });
    el.hass = h;
    document.body.appendChild(el);
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.key')).toBeNull();
  });
});
