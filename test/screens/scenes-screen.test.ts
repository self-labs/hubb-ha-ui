import { afterEach, describe, expect, it } from 'vitest';
import '../../src/screens/scenes-screen';
import type { HubbScenesScreen } from '../../src/screens/scenes-screen';
import type { SceneItem } from '../../src/model/types';
import { makeHass } from '../helpers/fake-hass';

const SCENES: SceneItem[] = [
  { entityId: 'script.chegar', name: 'Chegar', areaId: null, description: null },
  { entityId: 'scene.cinema', name: 'Cinema', areaId: 'sala', description: 'Sala' },
];

async function mount(scenes: SceneItem[], admin = false): Promise<HubbScenesScreen> {
  const el = document.createElement('hubb-scenes-screen') as HubbScenesScreen;
  el.setConfig({ type: 'custom:hubb-scenes-screen', scenes, lightIds: [] });
  el.hass = makeHass({ user: { id: 'u', name: 'Ana', is_admin: admin } });
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}

describe('hubb-scenes-screen', () => {
  afterEach(() => { document.body.replaceChildren(); });

  it('refuses a config with no scenes list', () => {
    const el = document.createElement('hubb-scenes-screen') as HubbScenesScreen;
    expect(() => el.setConfig({ type: 'custom:hubb-scenes-screen' } as never)).toThrow('hubb-scenes-screen: missing scenes');
  });

  it('lists every scene as a row and marks Cenas in the bar', async () => {
    const el = await mount(SCENES);
    expect(el.shadowRoot!.querySelector('h1')!.textContent).toBe('Cenas');
    expect(el.shadowRoot!.querySelectorAll('.list hubb-scene-button[variant="row"]')).toHaveLength(2);
    expect(el.shadowRoot!.querySelector('hubb-nav-bar')!.getAttribute('current')).toBe('scenes');
  });

  it('explains how to create a scene, to admins only', async () => {
    const resident = await mount([]);
    expect(resident.shadowRoot!.querySelector('.empty strong')!.textContent).toBe('Nenhuma cena ainda.');
    expect(resident.shadowRoot!.querySelector('.empty span')).toBeNull();
    document.body.replaceChildren();
    const admin = await mount([], true);
    expect(admin.shadowRoot!.querySelector('.empty span')!.textContent).toContain('hubb_cena');
  });
});
