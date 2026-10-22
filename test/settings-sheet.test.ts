import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setEditing } from '../src/editing';
import type { HubbToast } from '../src/elements/toast';
import { buildHouse } from '../src/model/build-house';
import '../src/screens/home-screen';
import type { HubbScreen } from '../src/screens/base';
import { admin, flush, USERS, withDashboard, withUsers } from './helpers/fake-dashboard';
import { area, makeHass, type FakeHass } from './helpers/fake-hass';

type Screen = HubbScreen & { setConfig(c: unknown): void };

function house(): FakeHass {
  const h = admin(
    makeHass({
      areas: [area('quarto', 'Quarto'), area('sala', 'Sala')],
      entities: [
        { entity_id: 'light.cama', area_id: 'quarto', name: 'Cama', state: 'off' },
        { entity_id: 'light.teto', area_id: 'sala', name: 'Teto', state: 'off' },
      ],
    }),
  );
  h.services = { notify: {} };
  return h;
}

async function mount(h: FakeHass): Promise<Screen> {
  const el = document.createElement('hubb-home-screen') as Screen;
  el.setConfig({ type: 'custom:hubb-home-screen', house: buildHouse(h), options: {} });
  el.hass = h;
  document.body.appendChild(el);
  await flush();
  await el.updateComplete;
  return el;
}

describe('Ajustes: the settings of the panel, in the edit mode', () => {
  beforeEach(() => history.replaceState(null, '', '/hubb-casa/home'));
  afterEach(() => {
    setEditing(false);
    for (const el of document.querySelectorAll('hubb-home-screen')) (el.shadowRoot?.querySelector('hubb-toast') as HubbToast | null)?.hide();
    document.body.replaceChildren();
  });

  it('lists the residents as wall tablets and saves the room of one, with Desfazer', async () => {
    const h = house();
    const saves = withDashboard(h, { strategy: { type: 'custom:hubb' } });
    withUsers(h, USERS);
    setEditing(true);
    const el = await mount(h);
    (el.shadowRoot!.querySelector('.settings-open') as HTMLButtonElement).click();
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('hubb-sheet.settings')!.hasAttribute('open')).toBe(true);
    const rows = [...el.shadowRoot!.querySelectorAll('.tablet-user')] as HTMLButtonElement[];
    expect(rows.map((r) => r.querySelector('.name')!.textContent)).toEqual(['Ana', 'Lia']);
    rows[1]!.click();
    await el.updateComplete;
    const editor = el.shadowRoot!.querySelector('hubb-sheet.settings hubb-tablet-editor')!;
    editor.dispatchEvent(new CustomEvent('hubb-tablet', { detail: { userId: 'u_lia', patch: { room: 'quarto' }, message: 'x' }, bubbles: true, composed: true }));
    await flush();
    await flush();
    expect(saves.at(-1)!.tablets).toEqual({ u_lia: { room: 'quarto' } });
    expect(el.shadowRoot!.querySelector('hubb-sheet.settings')!.hasAttribute('open')).toBe(true);
    const toast = el.shadowRoot!.querySelector('hubb-toast') as HubbToast;
    await toast.updateComplete;
    (toast.shadowRoot!.querySelector('button') as HTMLButtonElement).click();
    await flush();
    await flush();
    expect(saves.at(-1)!.tablets).toEqual({});
  });

  it('picks the power meter of the house, for the energy pill, with Desfazer', async () => {
    const h = house();
    h.states['sensor.consumo'] = { entity_id: 'sensor.consumo', state: '850', attributes: { device_class: 'power', unit_of_measurement: 'W' } };
    h.entities['sensor.consumo'] = { ...h.entities['light.cama']!, entity_id: 'sensor.consumo', area_id: null, name: 'Consumo da casa' };
    const saves = withDashboard(h, { strategy: { type: 'custom:hubb' } });
    withUsers(h, USERS);
    setEditing(true);
    const el = await mount(h);
    (el.shadowRoot!.querySelector('.settings-open') as HTMLButtonElement).click();
    await el.updateComplete;
    const select = el.shadowRoot!.querySelector('hubb-sheet.settings select.house-power') as HTMLSelectElement;
    expect([...select.options].map((o) => [o.value, o.textContent])).toEqual([
      ['', 'Nenhum'],
      ['sensor.consumo', 'Consumo da casa'],
    ]);
    select.value = 'sensor.consumo';
    select.dispatchEvent(new Event('change'));
    await flush();
    await flush();
    expect(saves.at(-1)!.house_power).toBe('sensor.consumo');
  });

  it('is only for an administrator in the edit mode', async () => {
    const h = house();
    withDashboard(h, { strategy: { type: 'custom:hubb' } });
    const el = await mount(h);
    expect(el.shadowRoot!.querySelector('.settings-open')).toBeNull();
  });
});
