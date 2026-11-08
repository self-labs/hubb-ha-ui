import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import '../../src/screens/room-screen';
import { allLightIds, buildHouse } from '../../src/model/build-house';
import { HubbRoomScreen } from '../../src/screens/room-screen';
import type { HubbScreen } from '../../src/screens/base';
import { reportArea, resetLayoutForTests } from '../../src/layout';
import { setEditing } from '../../src/editing';
import { flush } from '../helpers/fake-dashboard';
import { area, makeHass, type FakeEntity } from '../helpers/fake-hass';

// The scenes of a room in one strip that scrolls sideways (spec Cenas no cômodo, opção C, 07/11).

type Screen = HubbScreen & { setConfig(c: unknown): void };

const scene = (id: string, name: string): FakeEntity => ({ entity_id: `scene.${id}`, area_id: 'consultorio', name, state: 'scening', labels: ['hubb_cena'] });
const TETO: FakeEntity = { entity_id: 'light.teto', area_id: 'consultorio', name: 'Teto', state: 'on' };
const THREE = [scene('atendimento', 'Atendimento'), scene('limpeza', 'Limpeza'), scene('relaxar', 'Relaxar')];

async function room(entities: FakeEntity[], installer = false): Promise<Screen> {
  const user = installer ? { id: 'u_gustavo', name: 'Gustavo', is_admin: true } : undefined;
  const h = makeHass({ user, areas: [area('consultorio', 'Consultório 1')], entities });
  const house = buildHouse(h, { scenes: THREE.map((s) => s.entity_id) });
  const el = document.createElement('hubb-room-screen') as Screen;
  el.setConfig({ type: 'custom:hubb-room-screen', room: house.rooms[0]!, lightIds: allLightIds(house), options: {} });
  el.hass = h;
  document.body.appendChild(el);
  await flush();
  await el.updateComplete;
  return el;
}

const names = (root: Element | null) =>
  [...(root?.querySelectorAll('hubb-scene-button') ?? [])].map((b) => (b as unknown as { scene: { name: string } }).scene.name);
const cssOf = (styles: unknown): string =>
  ([] as unknown[]).concat(styles).map((s) => (s as { cssText: string }).cssText).join('\n');

describe('the scene strip of a room', () => {
  beforeEach(() => history.replaceState(null, '', '/hubb-casa/consultorio'));
  afterEach(() => {
    setEditing(false);
    resetLayoutForTests();
    document.body.replaceChildren();
  });

  it('holds the scenes, in their order, apart from Apagar tudo', async () => {
    const el = await room([TETO, ...THREE]);
    const actions = el.shadowRoot!.querySelector('.actions')!;
    expect(actions.querySelector('button.primary')).not.toBeNull();
    expect(names(actions)).toEqual([]);
    expect(names(el.shadowRoot!.querySelector('.scene-strip'))).toEqual(['Atendimento', 'Limpeza', 'Relaxar']);
  });

  it('stands alone in a room with no lights', async () => {
    const el = await room(THREE);
    expect(el.shadowRoot!.querySelector('button.primary')).toBeNull();
    expect(names(el.shadowRoot!.querySelector('.scene-strip'))).toEqual(['Atendimento', 'Limpeza', 'Relaxar']);
  });

  it('is not there in a room with no scenes, nor in the edit mode', async () => {
    expect((await room([TETO])).shadowRoot!.querySelector('.scene-strip')).toBeNull();
    document.body.replaceChildren();
    setEditing(true);
    expect((await room([TETO, ...THREE], true)).shadowRoot!.querySelector('.scene-strip')).toBeNull();
  });

  it('sits in the header on the tablet lying down', async () => {
    reportArea({ left: 0, top: 0, width: 1280, height: 800 }, 800);
    const el = await room([TETO, ...THREE]);
    expect(el.getAttribute('screen-layout')).toBe('wide');
    expect(names(el.shadowRoot!.querySelector('header.hero .scene-strip'))).toEqual(['Atendimento', 'Limpeza', 'Relaxar']);
  });

  it('is one line that scrolls sideways, with no bar, and its buttons never shrink', () => {
    const css = cssOf(HubbRoomScreen.styles);
    const strip = css.match(/\.scene-strip\s*\{[^}]*\}/)![0];
    expect(strip).toContain('flex-wrap: nowrap');
    expect(strip).toContain('overflow-x: auto');
    expect(strip).toContain('scrollbar-width: none');
    expect(strip).toContain('overscroll-behavior-x: contain');
    expect(css).toMatch(/\.scene-strip > hubb-scene-button\s*\{[^}]*flex: none/);
  });
});
