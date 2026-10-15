import { describe, expect, it } from 'vitest';
import { generateDashboard } from '../src/strategy/generate';
import { CLINIC_CONFIG, clinicHass } from './fixtures/clinic';
import { sampleHouseHass } from './fixtures/sample-house';
import { area, makeHass } from './helpers/fake-hass';

describe('generateDashboard', () => {
  it('makes a home, a scenes and one panel view per room', () => {
    const config = generateDashboard({ name: 'Casa Exemplo' }, sampleHouseHass());
    expect(config.title).toBe('Casa Exemplo');
    expect(config.views.map((v) => [v.path, v.type, v.subview ?? false])).toEqual([
      ['home', 'panel', false],
      ['scenes', 'panel', true],
      ['seguranca', 'panel', true],
      ['cozinha', 'panel', true],
      ['quarto', 'panel', true],
      ['sala_de_estar', 'panel', true],
    ]);
    expect(config.views[0]!.cards[0]!.type).toBe('custom:hubb-home-screen');
    expect(config.views[3]!.cards[0]).toMatchObject({ type: 'custom:hubb-room-screen', room: { name: 'Cozinha' } });
    expect(config.views[3]!.cards[0]!.lightIds as string[]).toHaveLength(18);
  });

  it('never repeats a view path, even for an area called home', () => {
    const h = makeHass({
      areas: [area('home', 'Home'), area('scenes', 'Cenas da casa'), area('seguranca', 'Segurança')],
      entities: [
        { entity_id: 'light.a', area_id: 'home', state: 'off' },
        { entity_id: 'light.b', area_id: 'scenes', state: 'off' },
        { entity_id: 'light.c', area_id: 'seguranca', state: 'off' },
      ],
    });
    const paths = generateDashboard({}, h).views.map((v) => v.path);
    expect(new Set(paths).size).toBe(paths.length);
    expect(paths).toEqual(['home', 'scenes', 'seguranca', 'area-home', 'area-scenes', 'area-seguranca']);
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

  it('names the first tab after the place and tells every screen', () => {
    // An administrator: a resident with no scene gets no Cenas screen (visibility, Section 8).
    const clinic = clinicHass();
    clinic.user = { id: 'u1', name: 'Gustavo Exemplo', is_admin: true };
    const config = generateDashboard(CLINIC_CONFIG, clinic);
    expect(config.views[0]!.title).toBe('Início');
    expect(config.views[1]!.cards[0]).toMatchObject({ type: 'custom:hubb-scenes-screen', homeLabel: 'Início' });
    expect(config.views[2]!.cards[0]).toMatchObject({ type: 'custom:hubb-security-screen', homeLabel: 'Início' });
    expect(config.views.find((v) => v.path !== 'revisar' && v.subview && v.cards[0]!.type === 'custom:hubb-room-screen')!.cards[0]).toMatchObject({ homeLabel: 'Início' });
    expect(generateDashboard({}, sampleHouseHass()).views[0]!.title).toBe('Casa');
  });

  it('adds "Revisar o painel" for an administrator only, and hands the configuration to the home', () => {
    const config = { name: 'Casa Exemplo' };
    const h = sampleHouseHass();
    h.user = { id: 'u1', name: 'Gustavo Exemplo', is_admin: true };
    const views = generateDashboard(config, h).views;
    expect(views.find((v) => v.path === 'revisar')).toEqual({
      title: 'Revisar o painel',
      path: 'revisar',
      type: 'panel',
      subview: true,
      cards: [{ type: 'custom:hubb-review-screen', options: config, homeLabel: 'Casa', shared: { alerts: [], security: false, scenes: true } }],
    });
    expect(views[0]!.cards[0]).toMatchObject({ type: 'custom:hubb-home-screen', options: config });
    expect(generateDashboard(config, sampleHouseHass()).views.some((v) => v.path === 'revisar')).toBe(false);
  });

  it('keeps an area called revisar off the path of the review', () => {
    const h = makeHass({
      user: { id: 'u1', name: 'Gustavo Exemplo', is_admin: true },
      areas: [area('revisar', 'Revisar')],
      entities: [{ entity_id: 'light.a', area_id: 'revisar', state: 'off' }],
    });
    const paths = generateDashboard({}, h).views.map((v) => v.path);
    expect(paths).toEqual(['home', 'scenes', 'seguranca', 'revisar', 'area-revisar']);
  });

  it('keeps every view in its place when a room appears or goes, so Home Assistant stays on the same screen after a save', () => {
    const h = makeHass({
      user: { id: 'u1', name: 'Gustavo Exemplo', is_admin: true },
      areas: [area('cozinha', 'Cozinha'), area('entrada', 'Entrada'), area('quarto', 'Quarto')],
      entities: [
        { entity_id: 'light.cozinha', area_id: 'cozinha', state: 'off' },
        { entity_id: 'switch.escada', area_id: 'entrada', state: 'off' },
      ],
    });
    const before = generateDashboard({}, h).views.map((v) => v.path);
    const after = generateDashboard({ entities: { 'switch.escada': { role: 'light' } }, rooms: { quarto: { hidden: true } } }, h).views.map((v) => v.path);
    expect(before).toEqual(['home', 'scenes', 'seguranca', 'revisar', 'cozinha', 'entrada', 'quarto']);
    expect(after).toEqual(before);
  });
});
