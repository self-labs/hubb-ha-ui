import { mdiHomeOutline, mdiOfficeBuildingOutline } from '@mdi/js';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setEditing } from '../src/editing';
import type { HubbNavBar } from '../src/elements/nav-bar';
import '../src/elements/place-picker';
import '../src/elements/status-strips';
import type { HubbToast } from '../src/elements/toast';
import { buildHouse } from '../src/model/build-house';
import { PROFILE_IDS, PROFILES } from '../src/model/profiles';
import '../src/screens/home-screen';
import type { HubbScreen } from '../src/screens/base';
import { generateDashboard } from '../src/strategy/generate';
import { HubbDashboardStrategy } from '../src/strategy/hubb-strategy';
import '../src/strategy/place-editor';
import { SECURITY, STRIP } from '../src/strings';
import { admin, flush, USERS, withDashboard, withUsers } from './helpers/fake-dashboard';
import { area, makeHass, type FakeHass } from './helpers/fake-hass';

type Screen = HubbScreen & { setConfig(c: unknown): void };

function clinic(): FakeHass {
  return makeHass({
    locationName: 'Clínica Exemplo',
    areas: [area('recepcao', 'Recepção')],
    entities: [{ entity_id: 'light.recepcao', area_id: 'recepcao', name: 'Teto', state: 'off' }],
  });
}

describe('a home or a business', () => {
  beforeEach(() => history.replaceState(null, '', '/hubb-casa/home'));
  afterEach(() => {
    setEditing(false);
    for (const el of document.querySelectorAll('hubb-home-screen')) (el.shadowRoot?.querySelector('hubb-toast') as HubbToast | null)?.hide();
    document.body.replaceChildren();
  });

  it('every kind of place but the home is a business, with a building on the first tab', () => {
    expect(PROFILES.home.place).toBe('home');
    expect(PROFILES.home.homeIcon).toBe(mdiHomeOutline);
    for (const id of PROFILE_IDS.filter((p) => p !== 'home')) {
      expect(PROFILES[id].place, id).toBe('business');
      expect(PROFILES[id].homeIcon, id).toBe(mdiOfficeBuildingOutline);
    }
  });

  it('a new dashboard is named after the place in Home Assistant, not "Casa", and asks the kind of place first', () => {
    expect(HubbDashboardStrategy.getCreateSuggestions(clinic())).toEqual({ title: 'Clínica Exemplo', icon: 'mdi:view-dashboard-outline' });
    expect(HubbDashboardStrategy.configRequired).toBe(true);
    expect((HubbDashboardStrategy.getConfigElement() as HTMLElement).localName).toBe('hubb-place-editor');
  });

  it('the editor of the creation sets the kind of place and keeps everything else', async () => {
    const el = document.createElement('hubb-place-editor') as HTMLElement & { hass: unknown; setConfig(c: unknown): void; updateComplete: Promise<unknown> };
    el.setConfig({ type: 'custom:hubb', entities: { 'light.x': { role: 'light' } } });
    el.hass = clinic();
    document.body.appendChild(el);
    await el.updateComplete;
    let sent: Record<string, unknown> | null = null;
    el.addEventListener('config-changed', (e) => (sent = (e as CustomEvent<{ config: Record<string, unknown> }>).detail.config));
    const picker = el.shadowRoot!.querySelector('hubb-place-picker') as HTMLElement & { updateComplete: Promise<unknown> };
    await picker.updateComplete;
    ([...picker.shadowRoot!.querySelectorAll('button')].find((b) => b.textContent!.trim() === 'Clínica') as HTMLButtonElement).click();
    expect(sent).toEqual({ type: 'custom:hubb', entities: { 'light.x': { role: 'light' } }, profile: 'clinic' });
    const name = el.shadowRoot!.querySelector('input.name') as HTMLInputElement;
    expect(name.placeholder).toBe('Clínica Exemplo');
    name.value = '  Clínica Centro ';
    name.dispatchEvent(new Event('change'));
    expect(sent).toEqual({ type: 'custom:hubb', entities: { 'light.x': { role: 'light' } }, profile: 'clinic', name: 'Clínica Centro' });
    name.value = '';
    name.dispatchEvent(new Event('change'));
    expect(sent).toEqual({ type: 'custom:hubb', entities: { 'light.x': { role: 'light' } }, profile: 'clinic' });
  });

  it('a clinic shows "Início" with a building on the bar, and says "local" where a home says "casa"', async () => {
    const h = clinic();
    const card = generateDashboard({ profile: 'clinic' }, h).views.find((v) => v.path === 'home')!.cards[0]!;
    const el = document.createElement('hubb-home-screen') as Screen;
    el.setConfig(card);
    el.hass = h;
    document.body.appendChild(el);
    await flush();
    await el.updateComplete;
    const nav = el.shadowRoot!.querySelector('hubb-nav-bar') as HubbNavBar;
    expect(nav.homeIcon).toBe(mdiOfficeBuildingOutline);
    expect(nav.homeLabel).toBe('Início');
    expect(STRIP.offline('business')).toBe('Sem conexão com o local. Tentando de novo…');
    expect(STRIP.offline('home')).toBe('Sem conexão com a casa. Tentando de novo…');
    expect(SECURITY.empty('business')).toContain('neste local');
  });

  it('Ajustes changes the kind of place, with Desfazer', async () => {
    const h = admin(clinic());
    h.services = { notify: {} };
    const saves = withDashboard(h, { strategy: { type: 'custom:hubb' } });
    withUsers(h, USERS);
    setEditing(true);
    const el = document.createElement('hubb-home-screen') as Screen;
    el.setConfig({ type: 'custom:hubb-home-screen', house: buildHouse(h), options: {} });
    el.hass = h;
    document.body.appendChild(el);
    await flush();
    await el.updateComplete;
    (el.shadowRoot!.querySelector('.settings-open') as HTMLButtonElement).click();
    await el.updateComplete;
    const picker = el.shadowRoot!.querySelector('hubb-sheet.settings hubb-place-picker')!;
    picker.dispatchEvent(new CustomEvent('hubb-place', { detail: { profile: 'clinic' }, bubbles: true, composed: true }));
    await flush();
    await flush();
    expect(saves.at(-1)!.profile).toBe('clinic');
    expect(el.shadowRoot!.querySelector('hubb-sheet.settings')!.hasAttribute('open')).toBe(true);
    const toast = el.shadowRoot!.querySelector('hubb-toast') as HubbToast;
    await toast.updateComplete;
    expect(toast.shadowRoot!.textContent).toContain('Tipo de lugar: Clínica.');
    (toast.shadowRoot!.querySelector('button') as HTMLButtonElement).click();
    await flush();
    await flush();
    expect(saves.at(-1)!.profile).toBeUndefined();
  });

  it('a business out of reach says "o local", not "a casa"', async () => {
    const h = clinic();
    h.connected = false;
    const card = generateDashboard({ profile: 'clinic' }, h).views.find((v) => v.path === 'home')!.cards[0]!;
    const el = document.createElement('hubb-home-screen') as Screen;
    el.setConfig(card);
    el.hass = h;
    document.body.appendChild(el);
    await flush();
    await el.updateComplete;
    const strips = el.shadowRoot!.querySelector('hubb-status-strips') as HTMLElement & { updateComplete: Promise<unknown> };
    await strips.updateComplete;
    expect(strips.shadowRoot!.querySelector('.offline')!.textContent!.trim()).toBe('Sem conexão com o local. Tentando de novo…');
  });
});
