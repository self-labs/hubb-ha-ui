import { describe, expect, it, vi } from 'vitest';
import { library, maEntryId, parseItems, parseSearch, playItem, search } from '../../src/model/ma-library';
import { makeHass, type FakeHass } from '../helpers/fake-hass';

const TRACK = { media_type: 'track', uri: 'spotify://track/1', name: 'Sultans of Swing', image: '/img/1.jpg', artists: [{ name: 'Dire Straits' }] };
const PLAYLIST = { media_type: 'playlist', uri: 'spotify://playlist/9', name: 'Churrasco', image: null, owner: 'Lia' };

/** A Home Assistant whose WebSocket answers like Music Assistant, made up for the test. */
function withMusicAssistant(responses: Record<string, unknown>): FakeHass {
  const h = makeHass({});
  h.callWS = vi.fn(async (msg: Record<string, unknown>) => {
    if (msg.type === 'config_entries/get') return [{ entry_id: 'ma1', domain: 'music_assistant', state: 'loaded' }];
    if (msg.type === 'call_service') return { response: responses[String(msg.service)] };
    throw new Error(`unexpected ${String(msg.type)}`);
  }) as FakeHass['callWS'];
  return h;
}

describe('the library of Music Assistant', () => {
  it('parses library items, leaving out one with no address', () => {
    expect(parseItems([TRACK, PLAYLIST, { name: 'Sem uri' }])).toEqual([
      { uri: 'spotify://track/1', mediaType: 'track', name: 'Sultans of Swing', subtitle: 'Dire Straits', image: '/img/1.jpg' },
      { uri: 'spotify://playlist/9', mediaType: 'playlist', name: 'Churrasco', subtitle: null, image: null },
    ]);
  });

  it('puts songs, artists, albums and playlists of a search in that order', () => {
    const artist = { media_type: 'artist', uri: 'spotify://artist/2', name: 'Dire Straits' };
    const album = { media_type: 'album', uri: 'spotify://album/3', name: 'Brothers in Arms', artists: [{ name: 'Dire Straits' }] };
    expect(parseSearch({ playlists: [PLAYLIST], albums: [album], artists: [artist], tracks: [TRACK] }).map((i) => i.mediaType)).toEqual([
      'track',
      'artist',
      'album',
      'playlist',
    ]);
  });

  it('asks Home Assistant with the entry of Music Assistant and plays on the speaker', async () => {
    const h = withMusicAssistant({ get_library: { items: [TRACK] }, search: { tracks: [TRACK] } });
    expect(await maEntryId(h)).toBe('ma1');
    expect(await library(h, 'recent')).toHaveLength(1);
    expect(await search(h, 'dire')).toHaveLength(1);
    const sent = (h.callWS as unknown as { mock: { calls: Record<string, unknown>[][] } }).mock.calls.map((c) => c[0]).filter((m) => m!.type === 'call_service');
    expect(sent.map((m) => [m!.service, m!.service_data, m!.return_response])).toEqual([
      ['get_library', { config_entry_id: 'ma1', media_type: 'track', order_by: 'last_played_desc', limit: 8 }, true],
      ['search', { config_entry_id: 'ma1', name: 'dire', limit: 5 }, true],
    ]);
    await playItem(h, 'media_player.caixa_ma', parseItems([TRACK])[0]!);
    expect(h.calls.map((c) => [`${c.domain}.${c.service}`, c.data, c.target?.entity_id])).toEqual([
      ['music_assistant.play_media', { media_id: 'spotify://track/1', media_type: 'track' }, 'media_player.caixa_ma'],
    ]);
  });

  it('has no entry when Music Assistant is not set up', async () => {
    const h = makeHass({});
    h.callWS = vi.fn(async () => []) as FakeHass['callWS'];
    expect(await maEntryId(h)).toBeNull();
  });
});
