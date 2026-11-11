import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { HubbRoomScreen } from '../../src/screens/room-screen';
import { allLightIds, buildHouse } from '../../src/model/build-house';
import type { HubbScreen } from '../../src/screens/base';
import { reportArea, resetLayoutForTests } from '../../src/layout';
import { flush } from '../helpers/fake-dashboard';
import { area, makeHass } from '../helpers/fake-hass';

// Only the name of the room sits beside the back arrow: its status and its buttons start at the edge,
// with the blocks under them, and not pushed in by the arrow (Gustavo, 08/11).

type Screen = HubbScreen & { setConfig(c: unknown): void };

async function room(embedded = false): Promise<Screen> {
  const h = makeHass({
    areas: [area('sala', 'Sala')],
    entities: [
      { entity_id: 'light.teto', area_id: 'sala', name: 'Teto', state: 'on' },
      { entity_id: 'scene.cinema', area_id: 'sala', name: 'Cinema', state: 'scening', labels: ['hubb_cena'] },
    ],
  });
  const b = buildHouse(h);
  const el = document.createElement('hubb-room-screen') as Screen;
  el.setConfig({ type: 'custom:hubb-room-screen', room: b.rooms[0]!, lightIds: allLightIds(b) });
  el.embedded = embedded;
  el.hass = h;
  document.body.appendChild(el);
  await flush();
  await el.updateComplete;
  return el;
}

describe('the header of a room', () => {
  beforeEach(() => history.replaceState(null, '', '/hubb-ui/sala'));
  afterEach(() => {
    resetLayoutForTests();
    document.body.replaceChildren();
  });

  it('puts only the name beside the back arrow', async () => {
    const hero = (await room()).shadowRoot!.querySelector('header.hero')!;
    expect(hero.querySelector('.head .back')).not.toBeNull();
    expect(hero.querySelector('.head h1')!.textContent).toBe('Sala');
    expect(hero.querySelector('.head p')).toBeNull();
    expect(hero.querySelector('.under p')!.textContent).toBe('1 de 1 luz acesa');
  });

  it('keeps the pencil at the far edge of the line of the name', () => {
    const css = ([] as unknown[]).concat(HubbRoomScreen.styles).map((x) => (x as { cssText: string }).cssText).join('\n');
    expect(css).toMatch(/\.head\s*\{[^}]*[^-]width: 100%/);
    expect(css).toMatch(/\.hero \.edit\s*\{[^}]*margin-left: auto/);
  });

  it('has no arrow drawn inside the wide home, with its buttons under the name', async () => {
    reportArea({ left: 0, top: 0, width: 1280, height: 800 }, 800);
    const hero = (await room(true)).shadowRoot!.querySelector('header.hero')!;
    expect(hero.querySelector('.back')).toBeNull();
    expect(hero.querySelector('.head h1')).not.toBeNull();
    expect(hero.querySelector('.under .actions .scene-strip')).not.toBeNull();
  });
});
