import { describe, expect, it } from 'vitest';
import { generateDashboard } from '../src/strategy/generate';
import { sampleHouseHass } from './fixtures/sample-house';
import { area, makeHass } from './helpers/fake-hass';

describe('generateDashboard', () => {
  it('makes a home, a scenes and one panel view per room', () => {
    const config = generateDashboard({ name: 'Casa Exemplo' }, sampleHouseHass());
    expect(config.title).toBe('Casa Exemplo');
    expect(config.views.map((v) => [v.path, v.type, v.subview ?? false])).toEqual([
      ['home', 'panel', false],
      ['scenes', 'panel', true],
      ['cozinha', 'panel', true],
      ['quarto', 'panel', true],
      ['sala_de_estar', 'panel', true],
    ]);
    expect(config.views[0]!.cards[0]!.type).toBe('custom:hubb-home-screen');
    expect(config.views[2]!.cards[0]).toMatchObject({ type: 'custom:hubb-room-screen', room: { name: 'Cozinha' } });
    expect(config.views[2]!.cards[0]!.lightIds as string[]).toHaveLength(18);
  });

  it('never repeats a view path, even for an area called home', () => {
    const h = makeHass({
      areas: [area('home', 'Home'), area('scenes', 'Cenas da casa')],
      entities: [
        { entity_id: 'light.a', area_id: 'home', state: 'off' },
        { entity_id: 'light.b', area_id: 'scenes', state: 'off' },
      ],
    });
    const paths = generateDashboard({}, h).views.map((v) => v.path);
    expect(new Set(paths).size).toBe(paths.length);
    expect(paths).toEqual(['home', 'scenes', 'area-scenes', 'area-home']);
  });

  it('turns a failure into an error card instead of a blank dashboard', () => {
    const broken = makeHass();
    Object.defineProperty(broken, 'entities', { get: () => { throw new Error('registry not loaded'); } });
    const config = generateDashboard({}, broken);
    expect(config.views).toHaveLength(1);
    expect(config.views[0]!.cards[0]).toEqual({
      type: 'custom:hubb-error-card',
      message: 'Não foi possível montar o painel.',
      detail: 'registry not loaded',
    });
  });
});
