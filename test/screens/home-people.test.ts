import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { HubbToast } from '../../src/elements/toast';
import { setEditing } from '../../src/editing';
import { buildHouse } from '../../src/model/build-house';
import type { HubbConfig } from '../../src/model/types';
import '../../src/screens/home-screen';
import type { HubbHomeScreen } from '../../src/screens/home-screen';
import { sampleHouseHass } from '../fixtures/sample-house';
import { admin, flush, USERS, withDashboard, withUsers } from '../helpers/fake-dashboard';
import type { FakeHass } from '../helpers/fake-hass';

async function mountHome(h: FakeHass, options: HubbConfig): Promise<HubbHomeScreen> {
  const el = document.createElement('hubb-home-screen') as HubbHomeScreen;
  el.setConfig({ type: 'custom:hubb-home-screen', house: buildHouse(h, options), options });
  el.hass = h;
  document.body.appendChild(el);
  await flush();
  await el.updateComplete;
  return el;
}

const roomEdit = (el: HubbHomeScreen, name: string) =>
  [...el.shadowRoot!.querySelectorAll('.room-edit')].find((r) => r.getAttribute('data-name') === name)!;

describe('who sees a room', () => {
  beforeEach(() => history.replaceState(null, '', '/hubb-casa/home'));
  afterEach(() => {
    setEditing(false);
    (document.querySelector('hubb-home-screen')?.shadowRoot?.querySelector('hubb-toast') as HubbToast | null)?.hide();
    document.body.replaceChildren();
  });

  it('opens the people of a room from its card and saves who stops seeing it, with Desfazer', async () => {
    const h = admin(sampleHouseHass());
    const saves = withDashboard(h, { strategy: { type: 'custom:hubb' } });
    withUsers(h, USERS);
    setEditing(true);
    const el = await mountHome(h, {});
    (roomEdit(el, 'Cozinha').querySelector('.tool.people') as HTMLButtonElement).click();
    await el.updateComplete;
    const sheet = el.shadowRoot!.querySelector('hubb-sheet.people')!;
    expect([sheet.getAttribute('heading'), sheet.getAttribute('subheading')]).toEqual(['Quem vê este cômodo', 'Cozinha']);
    const picker = sheet.querySelector('hubb-people-picker')!;
    await flush();
    await (picker as unknown as { updateComplete: Promise<unknown> }).updateComplete;
    (picker.shadowRoot!.querySelectorAll('.person')[1] as HTMLButtonElement).click();
    await flush();
    await flush();
    expect(saves.at(-1)).toMatchObject({ rooms: { cozinha: { hidden_for: ['u_lia'] } } });
    const toast = el.shadowRoot!.querySelector('hubb-toast') as HubbToast;
    await toast.updateComplete;
    expect(toast.shadowRoot!.querySelector('.toast')!.textContent).toContain('Cozinha não aparece mais para Lia.');
  });

  it('tags a room hidden for someone', async () => {
    const h = admin(sampleHouseHass());
    withUsers(h, USERS);
    setEditing(true);
    const el = await mountHome(h, { rooms: { cozinha: { hidden_for: ['u_lia'] } } });
    const tag = roomEdit(el, 'Cozinha').querySelector('hubb-hidden-tag')!;
    await flush();
    await (tag as unknown as { updateComplete: Promise<unknown> }).updateComplete;
    expect(tag.shadowRoot!.textContent!.trim()).toBe('Oculto para Lia');
  });
});
