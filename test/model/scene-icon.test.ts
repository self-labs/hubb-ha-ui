import { mdiCreationOutline, mdiDoorOpen, mdiExitRun, mdiMovieOpenOutline, mdiPartyPopper, mdiSilverwareForkKnife, mdiWeatherNight, mdiWeatherSunny } from '@mdi/js';
import { afterEach, describe, expect, it } from 'vitest';
import '../../src/elements/scene-button';
import { buildHouse } from '../../src/model/build-house';
import { sceneIconPath } from '../../src/model/scene-icon';
import type { SceneItem } from '../../src/model/types';
import { makeHass } from '../helpers/fake-hass';

describe('the icon of a scene', () => {
  afterEach(() => document.body.replaceChildren());

  it.each([
    ['Chegar em casa', mdiDoorOpen],
    ['Jantar em família', mdiSilverwareForkKnife],
    ['Cinema', mdiMovieOpenOutline],
    ['Hora da TV', mdiMovieOpenOutline],
    ['Dormir', mdiWeatherNight],
    ['Boa noite', mdiWeatherNight],
    ['Saindo', mdiExitRun],
    ['Bom dia', mdiWeatherSunny],
    ['Festa', mdiPartyPopper],
    ['Anime', mdiCreationOutline],
  ])('%s', (name, path) => expect(sceneIconPath(name)).toBe(path));

  it('the icon Home Assistant gives the scene wins, drawn by its own ha-icon', async () => {
    const h = makeHass({ entities: [{ entity_id: 'scene.sofa', name: 'Sofá', state: 'scening', attributes: { icon: 'mdi:sofa' } }] });
    const scene = buildHouse(h, { entities: { 'scene.sofa': { role: 'scene' } } }).scenes[0]!;
    expect(scene.icon).toBe('mdi:sofa');
    const el = document.createElement('hubb-scene-button') as HTMLElement & { scene: SceneItem; updateComplete: Promise<unknown> };
    el.scene = scene;
    document.body.appendChild(el);
    await el.updateComplete;
    expect((el.shadowRoot!.querySelector('ha-icon') as HTMLElement & { icon: string }).icon).toBe('mdi:sofa');
  });
});
