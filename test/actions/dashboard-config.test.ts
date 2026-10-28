import { describe, expect, it, vi } from 'vitest';
import {
  dashboardPath,
  dropKeys,
  putBack,
  putBackRoot,
  putBackRooms,
  setEntity,
  setOrders,
  setRoles,
  setRooms,
  showEntity,
} from '../../src/actions/dashboard-config';
import { makeHass, type FakeHass } from '../helpers/fake-hass';

/** A Home Assistant whose dashboard holds `saved`; every save replaces it, the way the real one does. */
function withDashboard(saved: Record<string, unknown>): { h: FakeHass; saves: Record<string, unknown>[] } {
  const h = makeHass();
  const saves: Record<string, unknown>[] = [];
  let current = saved;
  h.callWS = vi.fn(async (msg: Record<string, unknown>) => {
    if (msg.type === 'lovelace/config') return structuredClone(current);
    if (msg.type === 'lovelace/config/save') {
      current = msg.config as Record<string, unknown>;
      saves.push({ url_path: msg.url_path, config: current });
      return null;
    }
    throw new Error(`unexpected ${String(msg.type)}`);
  }) as FakeHass['callWS'];
  return { h, saves };
}

const strategyOf = (save: Record<string, unknown>) => (save.config as { strategy: Record<string, unknown> }).strategy;
const entitiesOf = (save: Record<string, unknown>) => strategyOf(save).entities;
const roomsOf = (save: Record<string, unknown>) => strategyOf(save).rooms;

describe('dashboardPath', () => {
  it('reads the dashboard from the address, with none for the default one', () => {
    expect(dashboardPath('/hubb-casa/revisar')).toBe('hubb-casa');
    expect(dashboardPath('/lovelace/0')).toBeNull();
    expect(dashboardPath('/')).toBeNull();
  });
});

describe('setRoles and putBack', () => {
  it('writes the role into the dashboard configuration, keeping what the entry already had', async () => {
    const { h, saves } = withDashboard({
      strategy: { type: 'custom:hubb', name: 'Casa', entities: { 'switch.bomba': { name: 'Bomba', icon: 'mdi:pool' } } },
    });
    const before = await setRoles(h, 'hubb-casa', { 'switch.bomba': 'equipment', 'switch.jet_mode': 'hidden' });
    expect(saves).toEqual([
      {
        url_path: 'hubb-casa',
        config: {
          strategy: {
            type: 'custom:hubb',
            name: 'Casa',
            entities: {
              'switch.bomba': { name: 'Bomba', icon: 'mdi:pool', role: 'equipment' },
              'switch.jet_mode': { role: 'hidden' },
            },
          },
        },
      },
    ]);
    expect(before).toEqual({ 'switch.bomba': { name: 'Bomba', icon: 'mdi:pool' }, 'switch.jet_mode': null });
  });

  it('puts every entry back as it was, removing the ones that did not exist', async () => {
    const { h, saves } = withDashboard({ strategy: { type: 'custom:hubb', entities: { 'switch.bomba': { name: 'Bomba' } } } });
    const before = await setRoles(h, 'hubb-casa', { 'switch.bomba': 'equipment', 'switch.jet_mode': 'hidden' });
    await putBack(h, 'hubb-casa', before);
    expect(saves.at(-1)).toEqual({ url_path: 'hubb-casa', config: { strategy: { type: 'custom:hubb', entities: { 'switch.bomba': { name: 'Bomba' } } } } });
  });

  it('refuses a dashboard that is no longer a hubb strategy, and a Home Assistant without the socket', async () => {
    const { h, saves } = withDashboard({ views: [{ title: 'Casa' }] });
    await expect(setRoles(h, 'hubb-casa', { 'switch.jet_mode': 'hidden' })).rejects.toThrow('not a hubb dashboard');
    expect(saves).toEqual([]);
    await expect(setRoles(makeHass(), 'hubb-casa', { 'switch.jet_mode': 'hidden' })).rejects.toThrow('no websocket');
  });
});

describe('setEntity, setOrders and the rooms', () => {
  it('changes one entry, and a key set to nothing goes back to the default', async () => {
    const { h, saves } = withDashboard({ strategy: { type: 'custom:hubb', entities: { 'switch.teto': { role: 'light', name: 'Paraíso' } } } });
    const before = await setEntity(h, 'hubb-casa', 'switch.teto', { name: 'Teto', area: 'sala' });
    expect(entitiesOf(saves.at(-1)!)).toEqual({ 'switch.teto': { role: 'light', name: 'Teto', area: 'sala' } });
    expect(before).toEqual({ 'switch.teto': { role: 'light', name: 'Paraíso' } });
    await setEntity(h, 'hubb-casa', 'switch.teto', { name: undefined, area: undefined, role: undefined });
    expect(entitiesOf(saves.at(-1)!)).toEqual({});
  });

  it('writes the order of several items in one save', async () => {
    const { h, saves } = withDashboard({ strategy: { type: 'custom:hubb', entities: { 'light.a': { name: 'A' } } } });
    await setOrders(h, 'hubb-casa', { 'light.a': 2, 'light.b': 1 });
    expect(saves).toHaveLength(1);
    expect(entitiesOf(saves[0]!)).toEqual({ 'light.a': { name: 'A', order: 2 }, 'light.b': { order: 1 } });
  });

  it('hides a room and puts it back', async () => {
    const { h, saves } = withDashboard({ strategy: { type: 'custom:hubb', rooms: { sala: { order: 1 } } } });
    const before = await setRooms(h, 'hubb-casa', { sala: { hidden: true }, quarto: { order: 2 } });
    expect(roomsOf(saves.at(-1)!)).toEqual({ sala: { order: 1, hidden: true }, quarto: { order: 2 } });
    await putBackRooms(h, 'hubb-casa', before);
    expect(roomsOf(saves.at(-1)!)).toEqual({ sala: { order: 1 } });
  });
});

describe('showEntity', () => {
  it('takes an entity out of the hidden role and of hide_entities, and the undo puts both back', async () => {
    const { h, saves } = withDashboard({
      strategy: { type: 'custom:hubb', hide_entities: ['light.mesa', 'light.x'], entities: { 'switch.jet': { role: 'hidden', name: 'Jet' } } },
    });
    const undo = await showEntity(h, 'hubb-casa', 'switch.jet');
    expect(strategyOf(saves.at(-1)!)).toEqual({ type: 'custom:hubb', hide_entities: ['light.mesa', 'light.x'], entities: { 'switch.jet': { name: 'Jet' } } });
    const undoMesa = await showEntity(h, 'hubb-casa', 'light.mesa');
    expect(strategyOf(saves.at(-1)!).hide_entities).toEqual(['light.x']);
    await undoMesa(h);
    await undo(h);
    expect(strategyOf(saves.at(-1)!)).toEqual({
      type: 'custom:hubb',
      hide_entities: ['light.mesa', 'light.x'],
      entities: { 'switch.jet': { role: 'hidden', name: 'Jet' } },
    });
  });

  it('gives back the role the entity had before Não mostrar, with its sensor, and the undo hides it again', async () => {
    const gate = { role: 'gate', name: 'Portão', sensor: 'binary_sensor.porta' };
    const { h, saves } = withDashboard({ strategy: { type: 'custom:hubb', entities: { 'switch.portao': gate } } });
    await setEntity(h, 'hubb-casa', 'switch.portao', { role: 'hidden' });
    const hidden = { role: 'hidden', name: 'Portão', sensor: 'binary_sensor.porta', shown_as: 'gate' };
    expect(entitiesOf(saves.at(-1)!)).toEqual({ 'switch.portao': hidden });
    const undo = await showEntity(h, 'hubb-casa', 'switch.portao');
    expect(entitiesOf(saves.at(-1)!)).toEqual({ 'switch.portao': gate });
    await undo(h);
    expect(entitiesOf(saves.at(-1)!)).toEqual({ 'switch.portao': hidden });
  });

  it('remembers the role when Revisar hides, and not when there was none', async () => {
    const { h, saves } = withDashboard({ strategy: { type: 'custom:hubb', entities: { 'switch.bomba': { role: 'equipment' }, 'switch.x': { name: 'X' } } } });
    await setRoles(h, 'hubb-casa', { 'switch.bomba': 'hidden', 'switch.x': 'hidden' });
    expect(entitiesOf(saves.at(-1)!)).toEqual({ 'switch.bomba': { role: 'hidden', shown_as: 'equipment' }, 'switch.x': { name: 'X', role: 'hidden' } });
    await showEntity(h, 'hubb-casa', 'switch.x');
    expect(entitiesOf(saves.at(-1)!)).toEqual({ 'switch.bomba': { role: 'hidden', shown_as: 'equipment' }, 'switch.x': { name: 'X' } });
  });

  it('keeps the remembered role through a rename, and forgets it when a role is chosen by hand', async () => {
    const { h, saves } = withDashboard({ strategy: { type: 'custom:hubb', entities: { 'switch.portao': { role: 'hidden', shown_as: 'gate' } } } });
    await setEntity(h, 'hubb-casa', 'switch.portao', { name: 'Portão' });
    expect(entitiesOf(saves.at(-1)!)).toEqual({ 'switch.portao': { role: 'hidden', shown_as: 'gate', name: 'Portão' } });
    await setEntity(h, 'hubb-casa', 'switch.portao', { role: 'light' });
    expect(entitiesOf(saves.at(-1)!)).toEqual({ 'switch.portao': { role: 'light', name: 'Portão' } });
    await setEntity(h, 'hubb-casa', 'switch.portao', { role: 'hidden' });
    await setEntity(h, 'hubb-casa', 'switch.portao', { role: undefined });
    expect(entitiesOf(saves.at(-1)!)).toEqual({ 'switch.portao': { name: 'Portão' } });
  });
});

describe('dropKeys and putBackRoot', () => {
  const saved = {
    strategy: {
      type: 'custom:hubb',
      house_power: 'sensor.sumiu',
      entities: {
        'camera.frente_hd': { name: 'Frente' },
        'switch.portao': { role: 'gate', sensor: 'binary_sensor.sumiu' },
        'switch.bomba': { order: 'x' },
      },
      rooms: { sala: { art: 'nenhuma' } },
    },
  };

  it('takes every key named out in one save, and an entry or section left empty goes with it', async () => {
    const { h, saves } = withDashboard(structuredClone(saved));
    await dropKeys(h, 'hubb-casa', [
      ['entities', 'camera.frente_hd'],
      ['entities', 'switch.portao', 'sensor'],
      ['entities', 'switch.bomba', 'order'],
      ['rooms', 'sala', 'art'],
      ['house_power'],
    ]);
    expect(saves).toHaveLength(1);
    expect(strategyOf(saves[0]!)).toEqual({ type: 'custom:hubb', entities: { 'switch.portao': { role: 'gate' } } });
  });

  it('leaves alone a key that is no longer there', async () => {
    const { h, saves } = withDashboard(structuredClone(saved));
    await dropKeys(h, 'hubb-casa', [['entities', 'switch.nada'], ['tablets', 'u1']]);
    expect(strategyOf(saves[0]!)).toEqual(saved.strategy);
  });

  it('Desfazer puts back the sections as they were, and takes out one that did not exist', async () => {
    const { h, saves } = withDashboard(structuredClone(saved));
    const before = await dropKeys(h, 'hubb-casa', [['entities', 'camera.frente_hd'], ['house_power']]);
    await putBackRoot(h, 'hubb-casa', before);
    expect(strategyOf(saves.at(-1)!)).toEqual(saved.strategy);
  });
});
