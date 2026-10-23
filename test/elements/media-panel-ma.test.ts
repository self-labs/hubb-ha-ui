import { afterEach, describe, expect, it, vi } from 'vitest';
import { MEDIA_FEATURE } from '../../src/actions/media';
import '../../src/elements/media-panel';
import type { HubbMediaBrowse } from '../../src/elements/media-browse';
import type { HubbMediaPanel } from '../../src/elements/media-panel';
import { device, makeHass, type FakeEntity, type FakeHass } from '../helpers/fake-hass';

const F = MEDIA_FEATURE;
const SPEAKER = 'media_player.caixa_sala';
const MA = 'media_player.caixa_sala_2';
const CHANNEL = 'select.caixa_sala_canal';

/** A speaker by DLNA and its Music Assistant player; `ma` overrides the player's state and attributes. */
function house(ma: { state?: string; attributes?: Record<string, unknown> } = {}, speaker: Record<string, unknown> = {}, speakerState = 'playing'): FakeHass {
  const entities: FakeEntity[] = [
    {
      entity_id: SPEAKER,
      device_id: 'd_caixa',
      platform: 'wiim',
      state: speakerState,
      attributes: {
        supported_features: F.pause | F.play | F.volumeSet | F.mute | F.source | F.turnOff,
        volume_level: 0.4,
        is_volume_muted: false,
        source: 'Network',
        source_list: ['Spotify', 'Line In', 'Optical In'],
        ...speaker,
      },
    },
    { entity_id: CHANNEL, device_id: 'd_caixa', platform: 'wiim', translation_key: 'output_channel', state: 'Stereo', attributes: { options: ['Stereo', 'Left', 'Right'] } },
    {
      entity_id: MA,
      device_id: 'd_caixa_ma',
      platform: 'music_assistant',
      state: ma.state ?? 'playing',
      attributes: {
        mass_player_type: 'player',
        supported_features: F.pause | F.play | F.next | F.previous | F.seek | F.shuffle | F.repeat,
        media_title: 'Sultans of Swing',
        media_artist: 'Dire Straits',
        media_duration: 348,
        media_position: 20,
        media_position_updated_at: '2026-10-22T12:00:00Z',
        shuffle: false,
        repeat: 'off',
        active_queue: 'caixa_sala',
        ...ma.attributes,
      },
    },
  ];
  const h = makeHass({ devices: [device('d_caixa', null, 'Caixa Sala'), device('d_caixa_ma', null, 'Caixa Sala')], entities });
  // Music Assistant set up, with an empty library: Tocar algo stays on the sheet.
  h.callWS = vi.fn((msg: Record<string, unknown>) =>
    Promise.resolve(msg.type === 'config_entries/get' ? [{ entry_id: 'ma1', state: 'loaded' }] : { response: { items: [] } }),
  ) as FakeHass['callWS'];
  return h;
}

async function mount(h: FakeHass): Promise<HubbMediaPanel> {
  const el = document.createElement('hubb-media-panel') as HubbMediaPanel;
  el.hass = h;
  el.entityId = SPEAKER;
  el.pairs = { [SPEAKER]: MA };
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}

const $ = (el: HubbMediaPanel, sel: string) => el.shadowRoot!.querySelector(sel);
const click = (el: HubbMediaPanel, sel: string) => ($(el, sel) as HTMLButtonElement).click();
const calls = (h: FakeHass) => h.calls.map((c) => [`${c.domain}.${c.service}`, c.data, c.target?.entity_id]);
const pickSource = (el: HubbMediaPanel, value: string) => {
  const select = $(el, 'select.source') as HTMLSelectElement;
  select.value = value;
  select.dispatchEvent(new Event('change'));
};

describe('the sheet of a speaker with Music Assistant', () => {
  afterEach(() => document.body.replaceChildren());

  it('commands the song on Music Assistant and the device on the speaker', async () => {
    const h = house();
    const el = await mount(h);
    click(el, '.next');
    click(el, '.shuffle');
    click(el, '.repeat');
    ($(el, 'hubb-media-progress') as HTMLElement).dispatchEvent(new CustomEvent('hubb-seek', { detail: { position: 100 } }));
    click(el, '.mute');
    const channel = $(el, 'select.channel') as HTMLSelectElement;
    channel.value = 'Left';
    channel.dispatchEvent(new Event('change'));
    click(el, '.power');
    expect(calls(h)).toEqual([
      ['media_player.media_next_track', undefined, MA],
      ['media_player.shuffle_set', { shuffle: true }, MA],
      ['media_player.repeat_set', { repeat: 'all' }, MA],
      ['media_player.media_seek', { seek_position: 100 }, MA],
      ['media_player.volume_mute', { is_volume_muted: true }, SPEAKER],
      ['select.select_option', { option: 'Left' }, CHANNEL],
      ['media_player.turn_off', undefined, SPEAKER],
    ]);
  });

  it('shows one Spotify in Fonte, marked while Music Assistant plays', async () => {
    const el = await mount(house());
    const options = [...($(el, 'select.source') as HTMLSelectElement).options];
    expect(options.map((o) => o.textContent!.trim())).toEqual(['Spotify', 'Line In', 'Optical In']);
    expect(options.find((o) => o.hasAttribute('selected'))?.textContent?.trim()).toBe('Spotify');
    document.body.replaceChildren();
    const lineIn = await mount(house({ state: 'idle', attributes: { media_title: undefined, active_queue: undefined } }, { source: 'Line In' }));
    const selected = [...($(lineIn, 'select.source') as HTMLSelectElement).options].find((o) => o.hasAttribute('selected'));
    expect(selected?.textContent?.trim()).toBe('Line In');
  });

  it('resumes Music Assistant on Spotify', async () => {
    const h = house({ state: 'paused' }, {}, 'idle');
    const el = await mount(h);
    pickSource(el, $(el, 'select.source option')!.getAttribute('value')!);
    expect(calls(h)).toEqual([['media_player.media_play', undefined, MA]]);
  });

  it('lists the sources of the speaker only when it can switch them', async () => {
    const el = await mount(house({}, { supported_features: F.pause | F.play | F.volumeSet }));
    expect([...($(el, 'select.source') as HTMLSelectElement).options].map((o) => o.textContent!.trim())).toEqual(['Spotify']);
  });

  it('with Tocar algo off, Spotify with nothing to resume still asks Music Assistant to play', async () => {
    const empty = house({ state: 'idle', attributes: { media_title: undefined, active_queue: undefined } }, { source: 'Line In' }, 'idle');
    const el = await mount(empty);
    ($(el, 'hubb-media-browse') as HubbMediaBrowse).off = true;
    pickSource(el, $(el, 'select.source option')!.getAttribute('value')!);
    expect(calls(empty)).toEqual([['media_player.media_play', undefined, MA]]);
  });

  it("switches the speaker's own source for the others", async () => {
    const h = house({ state: 'idle', attributes: { media_title: undefined } }, {}, 'idle');
    const el = await mount(h);
    pickSource(el, 'Line In');
    expect(calls(h)).toEqual([['media_player.select_source', { source: 'Line In' }, SPEAKER]]);
  });

  it('offers Tocar algo only with Music Assistant, and opens it on Spotify with nothing to resume', async () => {
    const empty = house({ state: 'idle', attributes: { media_title: undefined, active_queue: undefined } }, { source: 'Line In' }, 'idle');
    const el = await mount(empty);
    const browse = $(el, 'hubb-media-browse') as HubbMediaBrowse;
    expect(browse.ma).toBe(MA);
    const focus = vi.spyOn(browse, 'focusSearch');
    pickSource(el, $(el, 'select.source option')!.getAttribute('value')!);
    expect(focus).toHaveBeenCalledOnce();
    expect(calls(empty)).toEqual([]);
    // Nothing changed on the speaker: Fonte still says where it is.
    expect(($(el, 'select.source') as HTMLSelectElement).value).toBe('Line In');
    document.body.replaceChildren();
    expect($(await mount(house({ state: 'unavailable' })), 'hubb-media-browse')).toBeNull();
  });

  it('keeps the speaker alone when Music Assistant is down', async () => {
    const h = house({ state: 'unavailable' });
    const el = await mount(h);
    expect([...($(el, 'select.source') as HTMLSelectElement).options].map((o) => o.textContent!.trim())).toEqual(['Network', 'Spotify', 'Line In', 'Optical In']);
    expect($(el, '.next')).toBeNull();
  });
});

describe('the sheet of a TV that plays together through Music Assistant', () => {
  afterEach(() => document.body.replaceChildren());

  const TV = 'media_player.tv_quarto';
  const TV_MA = 'media_player.tv_quarto_2';

  /** A TV that cannot group by itself, whose Music Assistant player plays in the group of the Caixa Sala. */
  function together(): FakeHass {
    const group = [MA, TV_MA];
    const ma = (entity_id: string, device_id: string): FakeEntity => ({
      entity_id,
      device_id,
      platform: 'music_assistant',
      state: 'playing',
      attributes: { mass_player_type: 'player', supported_features: F.pause | F.play | F.grouping, group_members: group, media_title: 'Sultans of Swing' },
    });
    return makeHass({
      devices: [device('d_caixa', null, 'Caixa Sala'), device('d_caixa_ma', null, 'Caixa Sala'), device('d_tv', null, 'TV Quarto'), device('d_tv_ma', null, 'TV Quarto')],
      entities: [
        { entity_id: SPEAKER, device_id: 'd_caixa', platform: 'wiim', name: 'Caixa Sala', state: 'playing', attributes: { supported_features: F.pause | F.play | F.volumeSet | F.grouping } },
        { entity_id: TV, device_id: 'd_tv', platform: 'webostv', name: 'TV Quarto', state: 'on', attributes: { supported_features: F.pause | F.play | F.volumeSet | F.turnOff } },
        ma(MA, 'd_caixa_ma'),
        ma(TV_MA, 'd_tv_ma'),
      ],
    });
  }

  it('offers Tocar junto, and lets the TV leave the group on Music Assistant, with no Tocar algo', async () => {
    const h = together();
    const el = document.createElement('hubb-media-panel') as HubbMediaPanel;
    el.hass = h;
    el.entityId = TV;
    el.pairs = { [SPEAKER]: MA, [TV]: TV_MA };
    el.visible = [SPEAKER, TV];
    document.body.appendChild(el);
    await el.updateComplete;
    const group = $(el, 'hubb-media-group') as (HTMLElement & { updateComplete: Promise<unknown> }) | null;
    expect(group).not.toBeNull();
    await group!.updateComplete;
    expect(group!.shadowRoot!.querySelector('.part')!.textContent).toBe('Faz parte do grupo de Caixa Sala');
    (group!.shadowRoot!.querySelector('.leave') as HTMLButtonElement).click();
    expect(calls(h)).toEqual([['media_player.unjoin', undefined, TV_MA]]);
    // A member plays what its leader plays: what to play is picked on the leader.
    expect($(el, 'hubb-media-browse')).toBeNull();
  });
});
