import { describe, expect, it } from 'vitest';
import { readConfig } from '../../src/model/config';
import { isMaGroup, maPairs } from '../../src/model/ma-pair';
import type { HubbConfig } from '../../src/model/types';
import { device, makeHass, type FakeEntity, type FakeHass } from '../helpers/fake-hass';

/** A made-up house: a speaker of each kind, each with the device the integrations give it. */
function house(entities: FakeEntity[], devices = DEVICES): FakeHass {
  return makeHass({ devices, entities });
}

const DEVICES = [
  device('d_caixa', null, 'Caixa Sala'),
  device('d_caixa_ma', null, 'Caixa Sala'),
  { ...device('d_tv', null, 'TV Quarto'), model: '50UT' },
  device('d_tv_ir', null, 'TV Quarto'),
  { ...device('d_tv_ma', null, 'TV Quarto'), model: '50UT' },
];

const SPEAKER: FakeEntity = { entity_id: 'media_player.caixa_sala', device_id: 'd_caixa', platform: 'wiim', state: 'playing' };
const SPEAKER_MA: FakeEntity = { entity_id: 'media_player.caixa_sala_2', device_id: 'd_caixa_ma', platform: 'music_assistant', state: 'playing', attributes: { mass_player_type: 'player' } };
const TV: FakeEntity = { entity_id: 'media_player.tv_quarto', device_id: 'd_tv', platform: 'webostv', state: 'on' };
const TV_IR: FakeEntity = { entity_id: 'media_player.tv_quarto_2', device_id: 'd_tv_ir', platform: 'tasmota_ir', state: 'on' };
const TV_MA: FakeEntity = { entity_id: 'media_player.tv_quarto_3', device_id: 'd_tv_ma', platform: 'music_assistant', state: 'idle', attributes: { mass_player_type: 'player' } };

const pairsOf = (h: FakeHass, config: HubbConfig = {}) => Object.fromEntries(maPairs(h, readConfig(h, config)));

describe('the pair of a speaker and its Music Assistant player', () => {
  it('pairs a speaker with the Music Assistant player of the device with its name', () => {
    expect(pairsOf(house([SPEAKER, SPEAKER_MA]))).toEqual({ 'media_player.caixa_sala': 'media_player.caixa_sala_2' });
  });

  it('prefers the device with the same model when names repeat', () => {
    expect(pairsOf(house([TV, TV_IR, TV_MA]))).toEqual({ 'media_player.tv_quarto': 'media_player.tv_quarto_3' });
  });

  it('leaves an ambiguous name unpaired', () => {
    const devices = [device('d_a', null, 'Caixa'), device('d_b', null, 'Caixa'), device('d_m', null, 'Caixa')];
    const h = house(
      [
        { entity_id: 'media_player.caixa_a', device_id: 'd_a', platform: 'wiim', state: 'idle' },
        { entity_id: 'media_player.caixa_b', device_id: 'd_b', platform: 'linkplay', state: 'idle' },
        { entity_id: 'media_player.caixa_m', device_id: 'd_m', platform: 'music_assistant', state: 'idle', attributes: { mass_player_type: 'player' } },
      ],
      devices,
    );
    expect(pairsOf(h)).toEqual({});
  });

  it('never pairs an Echo, a Spotify, a Browser Mod or a group player', () => {
    const devices = [device('d_echo', null, 'Sala'), device('d_ma', null, 'Sala'), device('d_grp', null, 'Caixa Sala')];
    const h = house(
      [
        { entity_id: 'media_player.echo_sala', device_id: 'd_echo', platform: 'alexa_media', state: 'idle' },
        { entity_id: 'media_player.spotify_sala', device_id: 'd_echo', platform: 'spotify', state: 'idle' },
        { entity_id: 'media_player.browser_sala', device_id: 'd_echo', platform: 'browser_mod', state: 'idle' },
        { entity_id: 'media_player.sala_ma', device_id: 'd_ma', platform: 'music_assistant', state: 'idle', attributes: { mass_player_type: 'player' } },
        SPEAKER,
        { entity_id: 'media_player.casa_toda', device_id: 'd_grp', platform: 'music_assistant', state: 'idle', attributes: { mass_player_type: 'group' } },
      ],
      [...DEVICES, ...devices],
    );
    expect(pairsOf(h)).toEqual({});
    expect(isMaGroup(h, 'media_player.casa_toda')).toBe(true);
    expect(isMaGroup(h, 'media_player.sala_ma')).toBe(false);
  });

  it('knows a group of Music Assistant while it is down, by the id Music Assistant gave it', () => {
    // Unavailable, the player loses `mass_player_type`; its device keeps the player id of Music Assistant.
    const devices = [
      { ...device('d_sync', null, 'Casa Toda'), identifiers: [['music_assistant', 'syncgroup_3kx9']] as [string, string][] },
      { ...device('d_ugp', null, 'Térreo'), identifiers: [['music_assistant', 'ugp_terreo']] as [string, string][] },
      { ...device('d_player', null, 'Caixa Sala'), identifiers: [['music_assistant', 'RINCON_123']] as [string, string][] },
    ];
    const down = (entity_id: string, device_id: string): FakeEntity => ({ entity_id, device_id, platform: 'music_assistant', state: 'unavailable', attributes: {} });
    const h = house([down('media_player.casa_toda', 'd_sync'), down('media_player.terreo', 'd_ugp'), down('media_player.caixa_sala_2', 'd_player')], devices);
    expect(isMaGroup(h, 'media_player.casa_toda')).toBe(true);
    expect(isMaGroup(h, 'media_player.terreo')).toBe(true);
    expect(isMaGroup(h, 'media_player.caixa_sala_2')).toBe(false);
  });

  it('follows the editor', () => {
    const other: FakeEntity = { entity_id: 'media_player.outro_ma', platform: 'music_assistant', state: 'idle', attributes: { mass_player_type: 'player' } };
    const h = house([SPEAKER, SPEAKER_MA, other]);
    expect(pairsOf(h, { entities: { 'media_player.caixa_sala': { music_assistant: '' } } })).toEqual({});
    expect(pairsOf(h, { entities: { 'media_player.caixa_sala': { music_assistant: 'media_player.outro_ma' } } })).toEqual({
      'media_player.caixa_sala': 'media_player.outro_ma',
    });
  });

  it('pairs even a Music Assistant player that was hidden', () => {
    expect(pairsOf(house([SPEAKER, { ...SPEAKER_MA, hidden: true }]))).toEqual({ 'media_player.caixa_sala': 'media_player.caixa_sala_2' });
    expect(pairsOf(house([SPEAKER, SPEAKER_MA]), { entities: { 'media_player.caixa_sala_2': { role: 'hidden' } } })).toEqual({
      'media_player.caixa_sala': 'media_player.caixa_sala_2',
    });
  });
});

describe('the music_assistant key of an item', () => {
  it('reads an empty value or a Music Assistant player, and reports anything else', () => {
    const h = house([SPEAKER, SPEAKER_MA, TV]);
    const ok = readConfig(h, { entities: { 'media_player.caixa_sala': { music_assistant: 'media_player.caixa_sala_2' }, 'media_player.tv_quarto': { music_assistant: '' } } });
    expect(ok.entities['media_player.caixa_sala']?.musicAssistant).toBe('media_player.caixa_sala_2');
    expect(ok.entities['media_player.tv_quarto']?.musicAssistant).toBe('');
    expect(ok.problems).toEqual([]);
    const bad = readConfig(h, { entities: { 'media_player.caixa_sala': { music_assistant: 'media_player.tv_quarto' } } });
    expect(bad.entities['media_player.caixa_sala']?.musicAssistant).toBeUndefined();
    expect(bad.problems.map((p) => p.key)).toEqual(['entities.media_player.caixa_sala.music_assistant']);
  });
});
