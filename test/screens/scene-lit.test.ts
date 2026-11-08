import { afterEach, describe, expect, it } from 'vitest';
import '../../src/screens/home-screen';
import '../../src/screens/room-screen';
import '../../src/screens/scenes-screen';
import { allLightIds, buildHouse } from '../../src/model/build-house';
import type { HubbConfig } from '../../src/model/types';
import type { HubbScreen } from '../../src/screens/base';
import { resetLayoutForTests } from '../../src/layout';
import { flush } from '../helpers/fake-dashboard';
import { area, makeHass, type FakeEntity } from '../helpers/fake-hass';

// The button of a scene lights up wherever it shows, and the home shows its four (spec Cenas no cômodo).

type Screen = HubbScreen & { setConfig(c: unknown): void };

const scene = (id: string, name: string): FakeEntity => ({ entity_id: `scene.${id}`, area_id: 'consultorio', name, state: 'scening', labels: ['hubb_cena'] });

function clinic(light: 'on' | 'off') {
  return makeHass({
    areas: [area('consultorio', 'Consultório 1')],
    entities: [
      { entity_id: 'light.teto', area_id: 'consultorio', name: 'Teto', state: light },
      scene('atendimento', 'Atendimento'),
      scene('limpeza', 'Limpeza'),
      scene('relaxar', 'Relaxar'),
      scene('fim', 'Fim do dia'),
      scene('preparo', 'Preparo'),
      scene('noite', 'Noite'),
    ],
  });
}
const CONFIG: HubbConfig = { entities: { 'scene.atendimento': { follows: 'light.teto', pinned: true }, 'scene.noite': { pinned: true } } };

async function mount(tag: string, config: Record<string, unknown>, h: ReturnType<typeof clinic>): Promise<Screen> {
  const el = document.createElement(tag) as Screen;
  el.setConfig({ type: `custom:${tag}`, ...config });
  el.hass = h;
  document.body.appendChild(el);
  await flush();
  await el.updateComplete;
  return el;
}

const lit = (el: Element) =>
  [...el.shadowRoot!.querySelectorAll('hubb-scene-button')].map((b) => [(b as unknown as { scene: { name: string } }).scene.name, b.hasAttribute('on')]);

describe('a lit scene', () => {
  afterEach(() => {
    resetLayoutForTests();
    document.body.replaceChildren();
  });

  it('lights up on the home, in its room and on Cenas while its light is on', async () => {
    const h = clinic('on');
    const house = buildHouse(h, CONFIG);
    const home = await mount('hubb-home-screen', { house, options: CONFIG }, h);
    expect(lit(home)).toEqual([
      ['Atendimento', true],
      ['Noite', false],
    ]);
    const room = await mount('hubb-room-screen', { room: house.rooms[0], lightIds: allLightIds(house), options: CONFIG }, h);
    expect(lit(room).find(([name]) => name === 'Atendimento')).toEqual(['Atendimento', true]);
    const cenas = await mount('hubb-scenes-screen', { scenes: house.scenes, lightIds: [], options: CONFIG }, h);
    expect(lit(cenas).filter(([, on]) => on)).toEqual([['Atendimento', true]]);
  });

  it('is plain everywhere while its light is off', async () => {
    const h = clinic('off');
    const house = buildHouse(h, CONFIG);
    for (const el of [
      await mount('hubb-home-screen', { house, options: CONFIG }, h),
      await mount('hubb-room-screen', { room: house.rooms[0], lightIds: allLightIds(house), options: CONFIG }, h),
      await mount('hubb-scenes-screen', { scenes: house.scenes, lightIds: [], options: CONFIG }, h),
    ]) {
      expect(lit(el).filter(([, on]) => on)).toEqual([]);
    }
  });
});
