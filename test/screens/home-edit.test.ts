import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { HubbToast } from '../../src/elements/toast';
import { isEditing, setEditing } from '../../src/editing';
import '../../src/screens/home-screen';
import type { HubbHomeScreen } from '../../src/screens/home-screen';
import { buildHouse } from '../../src/model/build-house';
import type { HubbConfig } from '../../src/model/types';
import { sampleHouseHass } from '../fixtures/sample-house';
import { admin, flush, withDashboard } from '../helpers/fake-dashboard';
import type { FakeHass } from '../helpers/fake-hass';

async function mountHome(h: FakeHass, options: HubbConfig = {}): Promise<HubbHomeScreen> {
  const el = document.createElement('hubb-home-screen') as HubbHomeScreen;
  el.setConfig({ type: 'custom:hubb-home-screen', house: buildHouse(h, options), options });
  el.hass = h;
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}

async function tap(el: HubbHomeScreen, button: Element | null | undefined): Promise<void> {
  (button as HTMLButtonElement).click();
  await flush();
  await flush();
  await el.updateComplete;
}

const toastText = async (el: HubbHomeScreen): Promise<string> => {
  const toast = el.shadowRoot!.querySelector('hubb-toast') as HubbToast;
  await toast.updateComplete;
  return toast.shadowRoot!.querySelector('.toast')?.textContent ?? '';
};

const roomTools = (el: HubbHomeScreen, name: string) =>
  [...el.shadowRoot!.querySelectorAll('.room-edit')].find((r) => r.getAttribute('data-name') === name)!;

describe('editing the home', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 13, 15, 0, 0));
    history.replaceState(null, '', '/hubb-casa/home');
  });
  afterEach(() => {
    setEditing(false);
    (document.querySelector('hubb-home-screen')?.shadowRoot?.querySelector('hubb-toast') as HubbToast | null)?.hide();
    vi.useRealTimers();
    document.body.replaceChildren();
  });

  it('shows Editar to an administrator only, and switches the edit mode on and off', async () => {
    const resident = await mountHome(sampleHouseHass());
    expect(resident.shadowRoot!.querySelector('.edit')).toBeNull();
    document.body.replaceChildren();
    const el = await mountHome(admin(sampleHouseHass()));
    const edit = el.shadowRoot!.querySelector('.edit')!;
    expect(edit.getAttribute('aria-label')).toBe('Editar');
    await tap(el, edit);
    expect(isEditing()).toBe(true);
    expect(el.shadowRoot!.querySelector('.edit')!.getAttribute('aria-label')).toBe('Pronto');
    expect(el.shadowRoot!.querySelector('.hint')!.textContent).toContain('setas');
    await tap(el, el.shadowRoot!.querySelector('.edit'));
    expect(isEditing()).toBe(false);
  });

  it('moves a room one place later and saves the order of every room', async () => {
    const h = admin(sampleHouseHass());
    const saves = withDashboard(h, { strategy: { type: 'custom:hubb' } });
    setEditing(true);
    const el = await mountHome(h);
    await tap(el, roomTools(el, 'Cozinha').querySelector('.after'));
    expect(saves.at(-1)!.rooms).toEqual({ quarto: { order: 1 }, cozinha: { order: 2 }, sala_de_estar: { order: 3 } });
    expect(await toastText(el)).toContain('Cozinha mudou de lugar.');
  });

  it('hides a room from the home', async () => {
    const h = admin(sampleHouseHass());
    const saves = withDashboard(h, { strategy: { type: 'custom:hubb' } });
    setEditing(true);
    const el = await mountHome(h);
    await tap(el, roomTools(el, 'Sala').querySelector('.hide'));
    expect(saves.at(-1)!.rooms).toEqual({ sala_de_estar: { hidden: true } });
    expect(await toastText(el)).toContain('Sala não aparece mais na home.');
  });

  it('lists the hidden rooms with a button that brings them back', async () => {
    const h = admin(sampleHouseHass());
    const options: HubbConfig = { rooms: { quarto: { hidden: true } } };
    const saves = withDashboard(h, { strategy: { type: 'custom:hubb', ...options } });
    setEditing(true);
    const el = await mountHome(h, options);
    const hidden = el.shadowRoot!.querySelector('.hidden-rooms')!;
    expect(hidden.textContent).toContain('Quarto');
    await tap(el, hidden.querySelector('button'));
    expect(saves.at(-1)!.rooms).toEqual({});
    expect(await toastText(el)).toContain('Quarto voltou para a home.');
  });

  it('says so when Home Assistant refuses the save', async () => {
    const h = admin(sampleHouseHass());
    withDashboard(h, { strategy: { type: 'custom:hubb' } }, true);
    setEditing(true);
    const el = await mountHome(h);
    await tap(el, roomTools(el, 'Sala').querySelector('.hide'));
    expect(el.shadowRoot!.querySelector('.hint')!.textContent).toContain('Não deu para salvar');
  });
});
