import { describe, expect, it } from 'vitest';
import { buildHouse } from '../../src/model/build-house';
import type { HubbConfig, Shared } from '../../src/model/types';
import { generateDashboard } from '../../src/strategy/generate';
import { area, device, makeHass, type FakeEntity, type FakeHass } from '../helpers/fake-hass';

const LIA = 'u_lia';

/** A made-up living room: a speaker and its Music Assistant player, an Echo, a group, a lone player. */
function house(extra: FakeEntity[] = [], user?: { id: string; name: string; is_admin: boolean }): FakeHass {
  return makeHass({
    ...(user ? { user } : {}),
    areas: [area('sala', 'Sala'), area('quarto', 'Quarto')],
    devices: [
      device('d_caixa', 'sala', 'Caixa Sala'),
      device('d_caixa_ma', null, 'Caixa Sala'),
      device('d_radio_ma', 'quarto', 'Rádio Quarto'),
      device('d_grupo', 'sala', 'Casa toda'),
      device('d_echo', 'sala', 'Echo Sala'),
    ],
    entities: [
      { entity_id: 'media_player.caixa_sala', device_id: 'd_caixa', platform: 'wiim', state: 'playing' },
      { entity_id: 'media_player.caixa_sala_2', device_id: 'd_caixa_ma', platform: 'music_assistant', state: 'playing', attributes: { mass_player_type: 'player' } },
      { entity_id: 'media_player.radio_quarto', device_id: 'd_radio_ma', platform: 'music_assistant', state: 'idle', attributes: { mass_player_type: 'player' } },
      { entity_id: 'media_player.casa_toda', device_id: 'd_grupo', platform: 'music_assistant', state: 'idle', attributes: { mass_player_type: 'group' } },
      { entity_id: 'media_player.echo_sala', device_id: 'd_echo', platform: 'alexa_media', state: 'idle' },
      ...extra,
    ],
  });
}

const mediaOf = (h: FakeHass, config: HubbConfig = {}) =>
  Object.fromEntries(buildHouse(h, config).rooms.map((r) => [r.areaId, r.media.map((m) => ({ entityId: m.entityId, ma: m.ma }))]));

describe('one card per speaker on the panel', () => {
  it('drops the Music Assistant player of a paired speaker, keeps one card with ma set', () => {
    expect(mediaOf(house()).sala).toEqual([{ entityId: 'media_player.caixa_sala', ma: 'media_player.caixa_sala_2' }]);
  });

  it('keeps an unpaired Music Assistant player as its own card', () => {
    expect(mediaOf(house()).quarto).toEqual([{ entityId: 'media_player.radio_quarto', ma: null }]);
  });

  it('drops Music Assistant group players and every Echo', () => {
    const sala = mediaOf(house()).sala!.map((m) => m.entityId);
    expect(sala).not.toContain('media_player.casa_toda');
    expect(sala).not.toContain('media_player.echo_sala');
  });

  it('drops the Echo of the official Alexa Devices integration too', () => {
    // Home Assistant's own integration (alexa_devices) gives the same Echo a second player, seen on 23/10.
    const echo = { entity_id: 'media_player.sala_echo_dot', device_id: 'd_echo', platform: 'alexa_devices', state: 'idle' };
    expect(mediaOf(house([echo])).sala!.map((m) => m.entityId)).not.toContain('media_player.sala_echo_dot');
  });

  it('brings an Echo back with the media role', () => {
    expect(mediaOf(house(), { entities: { 'media_player.echo_sala': { role: 'media' } } }).sala!.map((m) => m.entityId)).toEqual([
      'media_player.caixa_sala',
      'media_player.echo_sala',
    ]);
  });

  it('hands the screens the pairs of what the resident sees', () => {
    const shared = (h: FakeHass, config: HubbConfig = {}) => generateDashboard(config, h).views[0]!.cards[0]!.shared as Shared;
    expect(shared(house()).mediaPairs).toEqual({ 'media_player.caixa_sala': 'media_player.caixa_sala_2' });
    const lia = house([], { id: LIA, name: 'Lia', is_admin: false });
    expect(shared(lia, { entities: { 'media_player.caixa_sala': { hidden_for: [LIA] } } }).mediaPairs).toEqual({});
  });
});
