import { afterEach, describe, expect, it } from 'vitest';
import '../../src/elements/people-picker';
import { admin, flush, USERS, withUsers } from '../helpers/fake-dashboard';
import { makeHass, type FakeHass } from '../helpers/fake-hass';

function installer(users = USERS, fail = false): FakeHass {
  const h = admin(makeHass({}));
  withUsers(h, users, fail);
  return h;
}

async function picker(h: FakeHass, hiddenFor: string[]) {
  const el = document.createElement('hubb-people-picker') as HTMLElement & { hass: FakeHass; hiddenFor: string[]; updateComplete: Promise<unknown> };
  el.hass = h;
  el.hiddenFor = hiddenFor;
  document.body.appendChild(el);
  await flush();
  await el.updateComplete;
  return el;
}

async function tag(h: FakeHass, ids: string[]) {
  const el = document.createElement('hubb-hidden-tag') as HTMLElement & { hass: FakeHass; ids: string[]; updateComplete: Promise<unknown> };
  el.hass = h;
  el.ids = ids;
  document.body.appendChild(el);
  await flush();
  await el.updateComplete;
  return el.shadowRoot!.textContent!.replace(/\s+/g, ' ').trim();
}

const people = (el: HTMLElement) => [...el.shadowRoot!.querySelectorAll('.person')].map((b) => [b.textContent!.trim(), b.getAttribute('aria-pressed')]);

describe('choosing who sees a room or an item', () => {
  afterEach(() => document.body.replaceChildren());

  it('offers the residents only: administrators always see everything, disabled and system users are no one', async () => {
    const el = await picker(installer(), ['u_lia']);
    expect(people(el)).toEqual([
      ['Ana', 'true'],
      ['Lia', 'false'],
    ]);
  });

  it('asks to save the new list on each tap, and says who changed', async () => {
    const el = await picker(installer(), ['u_lia']);
    const asked: unknown[] = [];
    el.addEventListener('hubb-people', (e) => asked.push((e as CustomEvent).detail));
    (el.shadowRoot!.querySelectorAll('.person')[0] as HTMLButtonElement).click();
    await el.updateComplete;
    (el.shadowRoot!.querySelectorAll('.person')[1] as HTMLButtonElement).click();
    expect(asked).toEqual([
      { hiddenFor: ['u_lia', 'u_ana'], person: 'Ana', sees: false },
      { hiddenFor: ['u_ana'], person: 'Lia', sees: true },
    ]);
  });

  it('says so when the house has administrators only', async () => {
    const el = await picker(installer([USERS[0]!]), []);
    expect(el.shadowRoot!.querySelector('.hint')!.textContent!.trim()).toBe('Nesta casa só há administradores, e eles sempre veem tudo.');
  });

  it('tags what is hidden, by name, by count, and for a user that no longer exists', async () => {
    expect(await tag(installer(), ['u_lia'])).toBe('Oculto para Lia');
    expect(await tag(installer(), ['u_lia', 'u_ana'])).toBe('Oculto para 2 pessoas');
    expect(await tag(installer(), ['u_saiu'])).toBe('Oculto para 1 pessoa');
    expect(await tag(installer(), [])).toBe('');
  });
});
