import { afterEach, describe, expect, it } from 'vitest';
import { setEditing } from '../src/editing';
import '../src/elements/item-editor';
import '../src/elements/nav-bar';
import { HubbNavBar } from '../src/elements/nav-bar';
import { HubbSceneButton } from '../src/elements/scene-button';
import type { HubbToast } from '../src/elements/toast';
import { buildHouse } from '../src/model/build-house';
import { readConfig } from '../src/model/config';
import { sizesFor } from '../src/model/sizes';
import type { HubbConfig } from '../src/model/types';
import { HubbRoomScreen } from '../src/screens/room-screen';
import '../src/screens/scenes-screen';
import { admin, flush, USERS, withDashboard, withUsers } from './helpers/fake-dashboard';
import { area, makeHass, type FakeHass } from './helpers/fake-hass';

const cssOf = (styles: unknown): string => ([] as unknown[]).concat(styles).map((s) => (s as { cssText: string }).cssText).join('\n');

function sala(): FakeHass {
  return admin(
    makeHass({
      areas: [area('sala', 'Sala')],
      entities: [
        { entity_id: 'light.teto', area_id: 'sala', name: 'Teto', state: 'off' },
        { entity_id: 'climate.ar', area_id: 'sala', name: 'Ar', state: 'off', attributes: { hvac_modes: ['off', 'cool'] } },
        { entity_id: 'scene.noite', area_id: 'sala', name: 'Noite', state: 'scening', labels: ['hubb_cena'] },
      ],
    }),
  );
}

async function editor(h: FakeHass, item: Record<string, unknown>, settings?: Record<string, unknown>) {
  const el = document.createElement('hubb-item-editor') as HTMLElement & { hass: FakeHass; item: unknown; roomAreaId: string; settings: unknown; updateComplete: Promise<unknown> };
  el.hass = h;
  el.item = item;
  el.roomAreaId = 'sala';
  el.settings = settings;
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}

describe('the review of the card sizes', () => {
  afterEach(() => {
    setEditing(false);
    for (const el of document.querySelectorAll('hubb-scenes-screen')) (el.shadowRoot?.querySelector('hubb-toast') as HubbToast | null)?.hide();
    document.body.replaceChildren();
  });

  it('keeps a small edit tile a third of the row: the span rule names the size, so the reset of the tile cannot undo it', () => {
    const css = cssOf(HubbRoomScreen.styles);
    expect(css).toMatch(/\.grid > \.size-small\s*\{[^}]*grid-column: span 2/);
    expect(css).not.toMatch(/\.grid > \*\s*\{/);
  });

  it('keeps cards with buttons or a slide on the whole row, and offers no size for them', async () => {
    expect(['climate', 'media', 'gate', 'lock', 'appliance'].map((k) => sizesFor(k as 'climate'))).toEqual([['large'], ['large'], ['large'], ['large'], ['large']]);
    const el = await editor(sala(), { entityId: 'climate.ar', name: 'Ar', kind: 'climate', siblings: ['climate.ar'] });
    expect(el.shadowRoot!.querySelector('button.size')).toBeNull();
    const bad = readConfig(sala(), { entities: { 'climate.ar': { size: 'small' } } } as unknown as HubbConfig);
    expect(bad.problems.map((p) => [p.key, p.message])).toEqual([['entities.climate.ar.size', 'size: small não cabe neste card: ele ocupa a linha toda.']]);
  });

  it('disables the size already chosen, and saves no size when the default is picked', async () => {
    const el = await editor(sala(), { entityId: 'light.teto', name: 'Teto', kind: 'light', siblings: ['light.teto'] }, { size: 'medium' });
    const sizes = [...el.shadowRoot!.querySelectorAll('button.size')] as HTMLButtonElement[];
    expect(sizes.map((b) => b.disabled)).toEqual([false, true, false]);
    let asked: unknown = null;
    el.addEventListener('hubb-edit', (e) => (asked = (e as CustomEvent).detail));
    sizes[0]!.click();
    expect(asked).toMatchObject({ patch: { size: undefined } });
  });

  it('labels the sizes of a scene on Cenas, and disables the one it has', async () => {
    history.replaceState(null, '', '/hubb-casa/scenes');
    const h = sala();
    withDashboard(h, { strategy: { type: 'custom:hubb' } });
    withUsers(h, USERS);
    setEditing(true);
    const built = buildHouse(h, {});
    const el = document.createElement('hubb-scenes-screen') as HTMLElement & { hass: FakeHass; setConfig(c: unknown): void; updateComplete: Promise<unknown> };
    el.setConfig({ type: 'custom:hubb-scenes-screen', scenes: built.scenes, lightIds: [], options: {}, candidates: [] });
    el.hass = h;
    document.body.appendChild(el);
    await flush();
    await el.updateComplete;
    const row = el.shadowRoot!.querySelector('.scene-edit .sizes')!;
    expect(row.querySelector('.label')!.textContent!.trim()).toBe('Tamanho');
    expect([...row.querySelectorAll('button.size')].map((b) => (b as HTMLButtonElement).disabled)).toEqual([false, true, false]);
  });

  it('gives the scenes of a row one height, and breaks a long word inside a small tile', () => {
    const css = cssOf(HubbSceneButton.styles);
    expect(css).toMatch(/\.tile,\s*\.row\s*\{[^}]*height: 100%/);
    expect(css).toMatch(/\.name\s*\{[^}]*overflow-wrap: anywhere/);
  });

  it('keeps the fade under the sidebar of Home Assistant, and takes the taps of the solid part', async () => {
    const css = cssOf(HubbNavBar.styles);
    expect(css).toMatch(/\.fade\s*\{[^}]*z-index: 5/);
    expect(css).toMatch(/\.shield\s*\{[^}]*position: fixed[^}]*z-index: 5[^}]*pointer-events: auto/);
    const nav = document.createElement('hubb-nav-bar') as HubbNavBar;
    document.body.appendChild(nav);
    await nav.updateComplete;
    expect(nav.shadowRoot!.querySelector('.shield')!.getAttribute('aria-hidden')).toBe('true');
  });
});
