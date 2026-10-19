import { describe, expect, it } from 'vitest';
import { MEDIA_FEATURE, mediaLine } from '../src/actions/media';
import { classify, classifyContext } from '../src/model/classify';
import { readConfig } from '../src/model/config';
import { commandTarget, groupCandidates, groupOf, linkedSpotify, mediaView } from '../src/model/media';
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

  it('says a line with the artist while playing', () => {
    const h = house({ sala: { media_title: 'Música', media_artist: 'Banda' } });
    expect(mediaLine(mediaView(h, 'media_player.caixa_sala'), h.states['media_player.caixa_sala'])).toBe('Tocando · Música · Banda');
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

  it('offers the visible speakers of the same integration that can group', () => {
    const echo: FakeEntity = { entity_id: 'media_player.echo', area_id: 'sala', platform: 'alexa_media', name: 'Echo', state: 'idle', attributes: { supported_features: SPEAKER } };
    const h = house({ sala: { group_members: ['media_player.caixa_sala', 'media_player.caixa_cozinha'] } }, [echo]);
    expect(groupCandidates(h, 'media_player.caixa_sala', ['media_player.caixa_sala', 'media_player.caixa_cozinha', 'media_player.echo'])).toEqual([
      { entityId: 'media_player.caixa_cozinha', name: 'Caixa Cozinha', areaName: 'Cozinha', joined: true },
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
});
