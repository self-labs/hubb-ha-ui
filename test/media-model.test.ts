import { describe, expect, it } from 'vitest';
import { MEDIA_FEATURE, mediaLine } from '../src/actions/media';
import { classify, classifyContext } from '../src/model/classify';
import { readConfig } from '../src/model/config';
import { channelSelect, commandTarget, groupCandidates, groupOf, linkedSpotify, mediaView, musicEntity } from '../src/model/media';
import { area, device, makeHass, type FakeEntity, type FakeHass } from './helpers/fake-hass';

const SPEAKER = MEDIA_FEATURE.pause | MEDIA_FEATURE.play | MEDIA_FEATURE.volumeSet | MEDIA_FEATURE.grouping;
const SPOTIFY = MEDIA_FEATURE.pause | MEDIA_FEATURE.play | MEDIA_FEATURE.next | MEDIA_FEATURE.previous | MEDIA_FEATURE.shuffle;

function house(extra: { sala?: Record<string, unknown>; cozinha?: Record<string, unknown>; spotify?: Record<string, unknown>; spotifyState?: string } = {}, more: FakeEntity[] = []): FakeHass {
  return makeHass({
    areas: [area('sala', 'Sala'), area('cozinha', 'Cozinha')],
    devices: [device('d_sala', 'sala', 'Caixa Sala'), device('d_cozinha', 'cozinha', 'Caixa Cozinha'), device('d_spot', 'sala', 'Spotify Lia')],
    entities: [
      { entity_id: 'media_player.caixa_sala', device_id: 'd_sala', platform: 'wiim', name: 'Caixa Sala', state: 'playing', attributes: { supported_features: SPEAKER, ...extra.sala } },
      { entity_id: 'media_player.caixa_cozinha', device_id: 'd_cozinha', platform: 'wiim', name: 'Caixa Cozinha', state: 'idle', attributes: { supported_features: SPEAKER, ...extra.cozinha } },
      { entity_id: 'media_player.spotify_lia', device_id: 'd_spot', platform: 'spotify', name: 'Spotify Lia', state: extra.spotifyState ?? 'playing', attributes: { supported_features: SPOTIFY, ...extra.spotify } },
      ...more,
    ],
  });
}

describe('the view of a speaker', () => {
  it('links the Spotify playing on it by the device name or the entity name, ignoring case and spaces', () => {
    expect(linkedSpotify(house({ spotify: { source: ' caixa sala' } }), 'media_player.caixa_sala')).toBe('media_player.spotify_lia');
    const byEntity = house({ spotify: { source: 'Sala Speaker' }, sala: { friendly_name: 'Sala Speaker' } });
    expect(linkedSpotify(byEntity, 'media_player.caixa_sala')).toBe('media_player.spotify_lia');
    expect(linkedSpotify(house({ spotify: { source: 'Caixa Cozinha' } }), 'media_player.caixa_sala')).toBeNull();
    expect(linkedSpotify(house({ spotifyState: 'idle' }), 'media_player.caixa_sala')).toBeNull();
  });

  it('leaves a paused Spotify out of a speaker that has moved on to something else', () => {
    const paused = { spotifyState: 'paused', spotify: { source: 'Caixa Sala', media_title: 'Antiga' } };
    expect(linkedSpotify(house(paused), 'media_player.caixa_sala')).toBeNull();
    expect(mediaView(house(paused), 'media_player.caixa_sala').title).toBeNull();
    const both = makeHass({
      devices: [device('d_sala', 'sala', 'Caixa Sala')],
      entities: [
        { entity_id: 'media_player.caixa_sala', device_id: 'd_sala', platform: 'wiim', name: 'Caixa Sala', state: 'paused', attributes: { supported_features: SPEAKER } },
        { entity_id: 'media_player.spotify_lia', platform: 'spotify', name: 'Spotify', state: 'paused', attributes: { supported_features: SPOTIFY, source: 'Caixa Sala' } },
      ],
    });
    expect(linkedSpotify(both, 'media_player.caixa_sala')).toBe('media_player.spotify_lia');
  });

  it('takes what the speaker says, and fills the rest from Spotify', () => {
    const h = house({
      sala: { media_title: 'Da caixa', entity_picture: '/api/caixa.jpg', media_position: 34, media_position_updated_at: '2026-10-19T12:00:00Z' },
      spotify: { source: 'Caixa Sala', media_title: 'Do Spotify', media_artist: 'Artista', media_album_name: 'Álbum', entity_picture: '/api/spot.jpg', media_duration: 192, shuffle: true, repeat: 'all' },
    });
    expect(mediaView(h, 'media_player.caixa_sala')).toEqual({
      entityId: 'media_player.caixa_sala',
      state: 'playing',
      title: 'Da caixa',
      artist: 'Artista',
      album: 'Álbum',
      picture: '/api/caixa.jpg',
      duration: 192,
      position: 34,
      positionAt: Date.parse('2026-10-19T12:00:00Z'),
      shuffle: true,
      repeat: 'all',
      spotify: 'media_player.spotify_lia',
    });
    const bare = mediaView(house(), 'media_player.caixa_sala');
    expect([bare.title, bare.picture, bare.positionAt, bare.spotify]).toEqual([null, null, null, null]);
  });

  it('sends a command to the speaker when it has it, else to the Spotify on it, else nowhere', () => {
    const h = house({ spotify: { source: 'Caixa Sala' } });
    const view = mediaView(h, 'media_player.caixa_sala');
    expect(commandTarget(h, view, MEDIA_FEATURE.pause)).toBe('media_player.caixa_sala');
    expect(commandTarget(h, view, MEDIA_FEATURE.next)).toBe('media_player.spotify_lia');
    expect(commandTarget(h, view, MEDIA_FEATURE.seek)).toBeNull();
    expect(commandTarget(house(), mediaView(house(), 'media_player.caixa_sala'), MEDIA_FEATURE.next)).toBeNull();
  });

  it('says the song and the artist while playing, with no "Tocando" before them', () => {
    const h = house({ sala: { media_title: 'Música', media_artist: 'Banda' } });
    expect(mediaLine(mediaView(h, 'media_player.caixa_sala'), h.states['media_player.caixa_sala'])).toBe('Música · Banda');
  });

  it('says "Tocando" only when there is nothing else to say: the card already shows it plays (Gustavo, 21/10)', () => {
    const h = house({ sala: {} });
    expect(mediaLine(mediaView(h, 'media_player.caixa_sala'), h.states['media_player.caixa_sala'])).toBe('Tocando');
  });
});

describe('the group of a speaker', () => {
  it('is alone with no members, an empty list, or only itself', () => {
    for (const members of [null, [], ['media_player.caixa_sala']]) {
      expect(groupOf(house({ sala: { group_members: members } }), 'media_player.caixa_sala')).toEqual({ leader: null, members: [] });
    }
  });

  it('names the leader and the others, seen from any of them', () => {
    const both = ['media_player.caixa_sala', 'media_player.caixa_cozinha'];
    const h = house({ sala: { group_members: both }, cozinha: { group_members: both } });
    expect(groupOf(h, 'media_player.caixa_sala')).toEqual({ leader: 'media_player.caixa_sala', members: ['media_player.caixa_cozinha'] });
    expect(groupOf(h, 'media_player.caixa_cozinha')).toEqual({ leader: 'media_player.caixa_sala', members: ['media_player.caixa_sala'] });
  });

  it('names the leader by the role the integration gives, whatever the order of the list', () => {
    const both = ['media_player.caixa_cozinha', 'media_player.caixa_sala'];
    const h = house({ sala: { group_members: both, group_role: 'master' }, cozinha: { group_members: both, group_role: 'slave' } });
    expect(groupOf(h, 'media_player.caixa_sala').leader).toBe('media_player.caixa_sala');
    expect(groupOf(h, 'media_player.caixa_cozinha').leader).toBe('media_player.caixa_sala');
  });

  it('finds the channel select on the device of the speaker by its translation key', () => {
    const channel: FakeEntity = { entity_id: 'select.qualquer_nome', device_id: 'd_sala', platform: 'wiim', translation_key: 'output_channel', state: 'Left', attributes: { options: ['Stereo', 'Left', 'Right'] } };
    const other: FakeEntity = { entity_id: 'select.caixa_sala_eq', device_id: 'd_sala', platform: 'wiim', translation_key: 'equalizer', state: 'Pop', attributes: {} };
    expect(channelSelect(house({}, [channel, other]), 'media_player.caixa_sala')).toBe('select.qualquer_nome');
    expect(channelSelect(house({}, [channel]), 'media_player.caixa_cozinha')).toBeNull();
  });

  it('offers the visible speakers of the same integration that can group', () => {
    const echo: FakeEntity = { entity_id: 'media_player.echo', area_id: 'sala', platform: 'alexa_media', name: 'Echo', state: 'idle', attributes: { supported_features: SPEAKER } };
    const h = house({ sala: { group_members: ['media_player.caixa_sala', 'media_player.caixa_cozinha'] } }, [echo]);
    expect(groupCandidates(h, 'media_player.caixa_sala', ['media_player.caixa_sala', 'media_player.caixa_cozinha', 'media_player.echo'])).toEqual([
      { entityId: 'media_player.caixa_cozinha', name: 'Caixa Cozinha', areaName: 'Cozinha', joined: true, off: false },
    ]);
    expect(groupCandidates(h, 'media_player.caixa_sala', ['media_player.caixa_sala'])).toEqual([]);
  });
});

describe('Spotify on the panel', () => {
  it('is never a card of its own', () => {
    const h = house();
    const ctx = classifyContext(h, readConfig(h, {}), undefined);
    expect(classify(h, 'media_player.spotify_lia', ctx).block).toBeNull();
    expect(classify(h, 'media_player.caixa_sala', ctx).block).toBe('media');
  });

  it('never shows the group player WiiM adds to a leader, which repeats the leader', () => {
    const master: FakeEntity = {
      entity_id: 'media_player.caixa_sala_group_master',
      device_id: 'd_sala',
      platform: 'wiim',
      name: 'Caixa Sala Group Master',
      state: 'playing',
      attributes: { supported_features: SPEAKER, group_leader: 'Caixa Sala', group_status: 'active' },
    };
    const h = house({}, [master]);
    const ctx = classifyContext(h, readConfig(h, {}), undefined);
    expect(classify(h, 'media_player.caixa_sala_group_master', ctx).block).toBeNull();
    // Unavailable it loses its attributes; its id still says what it is.
    const down = house({}, [{ ...master, state: 'unavailable', attributes: {} }]);
    expect(classify(down, 'media_player.caixa_sala_group_master', classifyContext(down, readConfig(down, {}), undefined)).block).toBeNull();
  });
});

describe('where the music of a speaker comes from', () => {
  const pair = (speaker: string, ma: string | null) =>
    makeHass({
      entities: [
        { entity_id: 'media_player.caixa', platform: 'wiim', state: speaker },
        ...(ma === null ? [] : [{ entity_id: 'media_player.caixa_ma', platform: 'music_assistant', state: ma, attributes: { mass_player_type: 'player' } }]),
      ],
    });

  it('takes the music from Music Assistant while it plays', () => {
    expect(musicEntity(pair('playing', 'playing'), 'media_player.caixa', 'media_player.caixa_ma')).toBe('media_player.caixa_ma');
  });

  it('keeps a paused Music Assistant only while the speaker plays nothing else', () => {
    expect(musicEntity(pair('paused', 'paused'), 'media_player.caixa', 'media_player.caixa_ma')).toBe('media_player.caixa_ma');
    expect(musicEntity(pair('idle', 'paused'), 'media_player.caixa', 'media_player.caixa_ma')).toBe('media_player.caixa_ma');
    // The TV plays on the speaker: the paused queue of Music Assistant is an old song.
    expect(musicEntity(pair('playing', 'paused'), 'media_player.caixa', 'media_player.caixa_ma')).toBe('media_player.caixa');
  });

  it('leaves a paused Music Assistant behind a TV that is on by itself, or a speaker that is off', () => {
    // webOS and Denon say `on` while they show their own channel or input: the paused song is an old one.
    expect(musicEntity(pair('on', 'paused'), 'media_player.caixa', 'media_player.caixa_ma')).toBe('media_player.caixa');
    expect(musicEntity(pair('off', 'paused'), 'media_player.caixa', 'media_player.caixa_ma')).toBe('media_player.caixa');
  });

  /** The speaker and its Music Assistant player, each with a state and the song it says. */
  const songs = (speaker: [string, string | null], ma: [string, string | null]) =>
    makeHass({
      entities: [
        { entity_id: 'media_player.caixa', platform: 'wiim', state: speaker[0], attributes: speaker[1] ? { media_title: speaker[1] } : {} },
        { entity_id: 'media_player.caixa_ma', platform: 'music_assistant', state: ma[0], attributes: { mass_player_type: 'player', ...(ma[1] ? { media_title: ma[1] } : {}) } },
      ],
    });

  it('keeps a stopped Music Assistant whose song the speaker still shows, so play resumes its queue', () => {
    // Seen 23/10: the stream ended, both went idle on "Pieces", and play on the speaker woke a dead DLNA stream.
    expect(musicEntity(songs(['idle', 'Pieces'], ['idle', 'Pieces']), 'media_player.caixa', 'media_player.caixa_ma')).toBe('media_player.caixa_ma');
    expect(musicEntity(songs(['idle', null], ['idle', null]), 'media_player.caixa', 'media_player.caixa_ma')).toBe('media_player.caixa');
  });

  it('leaves Music Assistant behind when the speaker shows another song of its own', () => {
    // The speaker's own Spotify paused on one song, Music Assistant paused on an older one (23/10).
    expect(musicEntity(songs(['paused', 'Message In A Bottle'], ['paused', 'Walk Of Life']), 'media_player.caixa', 'media_player.caixa_ma')).toBe('media_player.caixa');
    expect(musicEntity(songs(['idle', 'Message In A Bottle'], ['idle', 'Walk Of Life']), 'media_player.caixa', 'media_player.caixa_ma')).toBe('media_player.caixa');
  });

  it('falls back to the speaker when Music Assistant is down or absent', () => {
    expect(musicEntity(pair('playing', 'unavailable'), 'media_player.caixa', 'media_player.caixa_ma')).toBe('media_player.caixa');
    expect(musicEntity(pair('playing', 'idle'), 'media_player.caixa', 'media_player.caixa_ma')).toBe('media_player.caixa');
    expect(musicEntity(pair('playing', null), 'media_player.caixa', 'media_player.caixa_ma')).toBe('media_player.caixa');
    expect(musicEntity(pair('playing', 'playing'), 'media_player.caixa', null)).toBe('media_player.caixa');
  });
});
