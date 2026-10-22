import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MEDIA_FEATURE } from '../../src/actions/media';
import type { HubbToast } from '../../src/elements/toast';
import { reportArea, resetLayoutForTests } from '../../src/layout';
import { allLightIds, buildHouse } from '../../src/model/build-house';
import '../../src/screens/home-screen';
import '../../src/screens/room-screen';
import type { HubbScreen } from '../../src/screens/base';
import { HubbRoomScreen } from '../../src/screens/room-screen';
import { resetSelectionForTests, selectedRoom } from '../../src/selection';
import { area, makeHass, type FakeEntity } from '../helpers/fake-hass';

const cssOf = (styles: unknown): string =>
  ([] as unknown[]).concat(styles).map((s) => (s as { cssText: string }).cssText).join('\n');

type Screen = HubbScreen & { setConfig(c: unknown): void };

function sala(withMedia = true) {
  const entities: FakeEntity[] = [
    { entity_id: 'light.teto', area_id: 'sala', name: 'Teto', state: 'on' },
    { entity_id: 'climate.ar', area_id: 'sala', name: 'Ar', state: 'cool', attributes: { hvac_modes: ['off', 'cool'], temperature: 23 } },
    { entity_id: 'scene.jantar', area_id: 'sala', name: 'Jantar', state: 'scening' },
  ];
  if (withMedia) {
    entities.push({ entity_id: 'media_player.tv', area_id: 'sala', name: 'TV', state: 'playing', attributes: { supported_features: MEDIA_FEATURE.play | MEDIA_FEATURE.pause } });
  }
  const h = makeHass({ areas: [area('sala', 'Sala')], entities });
  const house = buildHouse(h, { entities: { 'scene.jantar': { role: 'scene' } } });
  return { h, house, room: house.rooms[0]! };
}

async function room(embedded: boolean, withMedia = true): Promise<{ el: Screen; h: ReturnType<typeof sala>['h'] }> {
  const { h, house, room: r } = sala(withMedia);
  const el = document.createElement('hubb-room-screen') as Screen;
  el.setConfig({ type: 'custom:hubb-room-screen', room: r, lightIds: allLightIds(house) });
  el.embedded = embedded;
  el.hass = h;
  document.body.appendChild(el);
  await el.updateComplete;
  return { el, h };
}

describe('a room page drawn inside the wide home', () => {
  beforeEach(() => history.replaceState(null, '', '/hubb-casa/home'));
  afterEach(() => {
    resetLayoutForTests();
    resetSelectionForTests();
    for (const el of document.querySelectorAll('hubb-home-screen, hubb-room-screen')) {
      (el.shadowRoot?.querySelector('hubb-toast') as HubbToast | null)?.hide();
    }
    document.body.replaceChildren();
  });

  it('draws only the room: no strips, back arrow, pencil, undo or bar of its own', async () => {
    const { el } = await room(true);
    const root = el.shadowRoot!;
    expect(root.querySelector('.back')).toBeNull();
    expect(root.querySelector('hubb-nav-bar')).toBeNull();
    expect(root.querySelector('hubb-toast')).toBeNull();
    expect(root.querySelector('hubb-status-strips')).toBeNull();
    el.dispatchEvent(new CustomEvent('hubb-open-media', { detail: { entityId: 'media_player.tv' }, bubbles: true, composed: true }));
    await el.updateComplete;
    expect(root.querySelector('hubb-sheet.device')!.hasAttribute('open')).toBe(true);
  });

  it('wide, puts the air conditioner and the player side by side when the room has both', async () => {
    reportArea({ left: 0, top: 0, width: 1280, height: 800 }, 800);
    const both = (await room(true)).el.shadowRoot!.querySelector('.pair.both')!;
    expect([...both.querySelectorAll('h2')].map((h) => h.textContent)).toEqual(['Clima', 'Mídia']);
    document.body.replaceChildren();
    expect((await room(true, false)).el.shadowRoot!.querySelector('.pair')).toBeNull();
    expect(cssOf(HubbRoomScreen.styles)).toMatch(/:host\(\[screen-layout='wide'\]\) \.pair\.both\s*\{[^}]*grid-template-columns: 1fr 1fr/);
  });

  it('on a phone the blocks keep their order, with no pair', async () => {
    const { el } = await room(true);
    expect(el.shadowRoot!.querySelector('.pair')).toBeNull();
    expect([...el.shadowRoot!.querySelectorAll('main > h2')].map((h) => h.textContent)).toEqual(['Luzes', 'Clima', 'Mídia']);
  });

  it('a scene of the room runs once, not once for the room and once for the home around it', async () => {
    const { h, house, room: r } = sala();
    const home = document.createElement('hubb-home-screen') as Screen;
    home.setConfig({ type: 'custom:hubb-home-screen', house });
    home.hass = h;
    document.body.appendChild(home);
    await home.updateComplete;
    const inner = document.createElement('hubb-room-screen') as Screen;
    inner.setConfig({ type: 'custom:hubb-room-screen', room: r, lightIds: allLightIds(house) });
    inner.embedded = true;
    inner.hass = h;
    home.shadowRoot!.appendChild(inner);
    await inner.updateComplete;
    const chip = inner.shadowRoot!.querySelector('.actions hubb-scene-button') as HTMLElement & { updateComplete: Promise<unknown> };
    await chip.updateComplete;
    (chip.shadowRoot!.querySelector('button') as HTMLButtonElement).click();
    expect(h.calls.filter((c) => c.domain === 'scene').length).toBe(1);
  });

  it('opened by a link on a wide screen, the room shows on the right of the home', async () => {
    reportArea({ left: 0, top: 0, width: 1280, height: 800 }, 800);
    history.replaceState(null, '', '/hubb-casa/sala');
    await room(false);
    expect(location.pathname).toBe('/hubb-casa/home');
    expect(selectedRoom()).toBe('sala');
  });

  it('on a wide screen the header of the room is tall, with the drawing large', () => {
    expect(cssOf(HubbRoomScreen.styles)).toMatch(/:host\(\[screen-layout='wide'\]\) \.hero\s*\{[^}]*min-height: 160px/);
  });
});
