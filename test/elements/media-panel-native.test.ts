import { afterEach, describe, expect, it, vi } from 'vitest';
import { MEDIA_FEATURE } from '../../src/actions/media';
import '../../src/elements/media-panel';
import type { HubbMediaPanel } from '../../src/elements/media-panel';
import { device, makeHass, type FakeEntity, type FakeHass } from '../helpers/fake-hass';

const F = MEDIA_FEATURE;
const SPEAKER = 'media_player.caixa_sala';
const MA = 'media_player.caixa_sala_2';
const OTHER = 'media_player.caixa_cozinha';
const BROWSE = F.playMedia | F.browseMedia;

/** A speaker that plays and lists media; `speaker` overrides its attributes, `extra` adds players to the house. */
function house(speaker: Record<string, unknown> = {}, extra: FakeEntity[] = []): FakeHass {
  const h = makeHass({
    devices: [device('d_caixa', null, 'Caixa Sala')],
    entities: [
      {
        entity_id: SPEAKER,
        device_id: 'd_caixa',
        platform: 'wiim',
        state: 'playing',
        attributes: { supported_features: F.pause | F.play | F.volumeSet | BROWSE, volume_level: 0.3, ...speaker },
      },
      ...extra,
    ],
  });
  h.callWS = vi.fn(() => Promise.resolve({ title: 'Caixa', children: [{ title: 'Rádio', media_content_id: 'r', media_content_type: 'audio/mpeg', can_play: true, can_expand: false }] })) as FakeHass['callWS'];
  return h;
}

async function mount(h: FakeHass, pairs: Record<string, string> = {}): Promise<HubbMediaPanel> {
  const el = document.createElement('hubb-media-panel') as HubbMediaPanel;
  el.hass = h;
  el.entityId = SPEAKER;
  el.pairs = pairs;
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}

const native = (el: HubbMediaPanel) => el.shadowRoot!.querySelector('hubb-media-native') as (HTMLElement & { entityId: string }) | null;

describe('the sheet of a speaker without Music Assistant', () => {
  afterEach(() => document.body.replaceChildren());

  it('offers Tocar algo from the speaker itself, for the speaker of the sheet', async () => {
    const el = await mount(house());
    expect(native(el)!.entityId).toBe(SPEAKER);
    expect(el.shadowRoot!.querySelector('hubb-media-browse')).toBeNull();
  });

  it('leaves it to Music Assistant when there is one, and to the leader when the speaker is a member', async () => {
    const pair: FakeEntity = { entity_id: MA, platform: 'music_assistant', state: 'playing', attributes: { mass_player_type: 'player', supported_features: F.pause | F.play } };
    const withMa = await mount(house({}, [pair]), { [SPEAKER]: MA });
    expect(native(withMa)).toBeNull();
    expect(withMa.shadowRoot!.querySelector('hubb-media-browse')).not.toBeNull();
    document.body.replaceChildren();
    const other: FakeEntity = { entity_id: OTHER, platform: 'wiim', state: 'playing', attributes: { supported_features: F.pause | F.play | BROWSE, group_members: [OTHER, SPEAKER] } };
    const member = await mount(house({ group_members: [OTHER, SPEAKER] }, [other]));
    expect(native(member)).toBeNull();
  });

  it('stays out when the speaker cannot play or list media, when it is a TV, or when it is off', async () => {
    expect(native(await mount(house({ supported_features: F.pause | F.play | F.volumeSet })))).toBeNull();
    document.body.replaceChildren();
    expect(native(await mount(house({ supported_features: F.pause | F.play | F.playMedia })))).toBeNull();
    document.body.replaceChildren();
    expect(native(await mount(house({ device_class: 'tv' })))).toBeNull();
    document.body.replaceChildren();
    const off = house();
    off.states[SPEAKER] = { ...off.states[SPEAKER]!, state: 'off' };
    expect(native(await mount(off))).toBeNull();
  });
});
