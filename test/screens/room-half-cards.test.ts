import { afterEach, describe, expect, it } from 'vitest';
import { allLightIds, buildHouse } from '../../src/model/build-house';
import '../../src/screens/room-screen';
import { HubbRoomScreen } from '../../src/screens/room-screen';
import { area, makeHass, type FakeHass } from '../helpers/fake-hass';

// On a tablet or a computer the gate, the lock and the speaker of a room are not a strip across the whole
// pane, with the name at one end and the slide or the buttons at the other (Gustavo, 14/11): they take half a
// row there. The phone keeps the whole row, and the air conditioner and the appliances are left as they were.
function sala(): FakeHass {
  return makeHass({
    areas: [area('sala', 'Sala')],
    entities: [
      { entity_id: 'cover.portao', area_id: 'sala', name: 'Portão', state: 'closed', attributes: { device_class: 'gate', supported_features: 3 } },
      { entity_id: 'lock.porta', area_id: 'sala', name: 'Porta', state: 'locked', attributes: { supported_features: 0 } },
      { entity_id: 'media_player.tv', area_id: 'sala', name: 'TV', state: 'playing', attributes: { supported_features: 0 } },
      { entity_id: 'climate.ar', area_id: 'sala', name: 'Ar', state: 'cool', attributes: { hvac_modes: ['cool', 'off'], supported_features: 1 } },
      { entity_id: 'light.mesa', area_id: 'sala', name: 'Mesa', state: 'on', attributes: { supported_color_modes: ['onoff'] } },
    ],
  });
}

async function mountRoom(layout: 'phone' | 'roomy' | 'wide'): Promise<HubbRoomScreen> {
  const h = sala();
  const house = buildHouse(h, {});
  const el = document.createElement('hubb-room-screen') as HubbRoomScreen;
  el.setConfig({ type: 'custom:hubb-room-screen', room: house.rooms.find((r) => r.areaId === 'sala')!, lightIds: allLightIds(house), options: {} });
  el.hass = h;
  el.setAttribute('screen-layout', layout);
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}

const classesOf = (el: Element, tag: string): string[] => [...el.shadowRoot!.querySelector(tag)!.classList];
const cssOf = (styles: unknown): string => ([] as unknown[]).concat(styles).map((s) => (s as { cssText: string }).cssText).join('\n');

describe('the gate, the lock and the speaker of a room', () => {
  afterEach(() => document.body.replaceChildren());

  it('carry the mark that makes them half a row on a tablet, still a whole row by size', async () => {
    const el = await mountRoom('wide');
    for (const tag of ['hubb-access-tile', 'hubb-media-card']) {
      expect(classesOf(el, tag)).toEqual(expect.arrayContaining(['size-large', 'tablet-half']));
    }
    const locks = [...el.shadowRoot!.querySelectorAll('hubb-access-tile')];
    expect(locks).toHaveLength(2);
    for (const tile of locks) expect(tile.classList.contains('tablet-half')).toBe(true);
  });

  it('leave the air conditioner and the lights as they were', async () => {
    const el = await mountRoom('wide');
    expect(classesOf(el, 'hubb-climate-card')).not.toContain('tablet-half');
    expect(classesOf(el, 'hubb-light-tile')).not.toContain('tablet-half');
  });
});

describe('the rules for that mark', () => {
  const css = cssOf(HubbRoomScreen.styles);

  it('give half of the twelve columns on a roomy or wide screen, and nothing on a phone', () => {
    expect(css).toMatch(
      /:host\(\[screen-layout='roomy'\]\) \.grid > \.size-large\.tablet-half,\s*:host\(\[screen-layout='wide'\]\) \.grid > \.size-large\.tablet-half\s*\{[^}]*grid-column: span 6/,
    );
    expect(css).not.toMatch(/(^|\})\s*\.grid > \.size-large\.tablet-half/);
  });

  it('leave the speaker whole inside the half row it shares with the air conditioner', () => {
    expect(css).toMatch(/:host\(\[screen-layout='wide'\]\) \.pair\.both \.grid > \.size-large\.tablet-half\s*\{[^}]*grid-column: 1 \/ -1/);
  });
});
