import { describe, expect, it } from 'vitest';
import { buildHouse } from '../src/model/build-house';
import { lightsOnByRoom, summarize } from '../src/summary';
import { area, makeHass, withState, type FakeHass } from './helpers/fake-hass';

function hass(): FakeHass {
  return makeHass({
    areas: [area('sala', 'Sala'), area('quarto', 'Quarto'), area('cozinha', 'Cozinha')],
    entities: [
      { entity_id: 'light.sofa', area_id: 'sala', name: 'Sofá', state: 'off' },
      { entity_id: 'light.lustre', area_id: 'sala', name: 'Lustre', state: 'off' },
      { entity_id: 'light.cama', area_id: 'quarto', name: 'Cama', state: 'off' },
      { entity_id: 'light.bancada', area_id: 'cozinha', name: 'Bancada', state: 'off' },
    ],
  });
}

describe('summarize', () => {
  it('does not mention the rest when the other rooms only have outlets', () => {
    const h = makeHass({
      areas: [area('sala', 'Sala'), area('lav', 'Lavanderia')],
      entities: [
        { entity_id: 'light.sofa', area_id: 'sala', state: 'on' },
        { entity_id: 'switch.secadora', area_id: 'lav', state: 'off', attributes: { device_class: 'outlet' } },
      ],
    });
    expect(summarize(buildHouse(h), h)).toEqual({ headline: 'Sala com 1 luz acesa.', detail: '', lightsOn: 1 });
  });

  it('says everything is off', () => {
    const h = hass();
    expect(summarize(buildHouse(h), h)).toEqual({ headline: 'Tudo apagado.', detail: '', lightsOn: 0 });
  });

  it('names the only room with lights on and says the rest is off', () => {
    let h = hass();
    const house = buildHouse(h);
    h = withState(withState(h, 'light.sofa', 'on'), 'light.lustre', 'on');
    expect(summarize(house, h)).toEqual({
      headline: 'Sala com 2 luzes acesas.',
      detail: 'O resto está apagado.',
      lightsOn: 2,
    });
    expect(summarize(house, withState(h, 'light.lustre', 'off')).headline).toBe('Sala com 1 luz acesa.');
  });

  it('counts rooms when lights are on in more than one', () => {
    let h = hass();
    const house = buildHouse(h);
    h = withState(withState(withState(h, 'light.sofa', 'on'), 'light.cama', 'on'), 'light.lustre', 'on');
    expect(summarize(house, h)).toEqual({ headline: '3 luzes acesas em 2 ambientes.', detail: 'Quarto e Sala.', lightsOn: 3 });
  });

  it('does not count unavailable lights, and skips "the rest" in a one-room house', () => {
    const h = makeHass({
      areas: [area('sala', 'Sala')],
      entities: [
        { entity_id: 'light.a', area_id: 'sala', state: 'on' },
        { entity_id: 'light.b', area_id: 'sala', state: 'unavailable' },
      ],
    });
    expect(summarize(buildHouse(h), h)).toEqual({ headline: 'Sala com 1 luz acesa.', detail: '', lightsOn: 1 });
  });

  it('groups the lights that are on by room, in room order', () => {
    let h = hass();
    const house = buildHouse(h);
    h = withState(withState(h, 'light.bancada', 'on'), 'light.sofa', 'on');
    expect(lightsOnByRoom(house, h).map((g) => [g.room.name, g.on])).toEqual([
      ['Cozinha', ['light.bancada']],
      ['Sala', ['light.sofa']],
    ]);
  });
});
