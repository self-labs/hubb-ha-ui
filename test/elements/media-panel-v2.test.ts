import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MEDIA_FEATURE } from '../../src/actions/media';
import '../../src/elements/media-panel';
import { HubbMediaPanel } from '../../src/elements/media-panel';
import '../../src/elements/media-progress';
import { device, makeHass, type FakeEntity, type FakeHass } from '../helpers/fake-hass';

const F = MEDIA_FEATURE;
const BASIC = F.pause | F.play | F.volumeSet | F.mute;

function speaker(attributes: Record<string, unknown> = {}, state = 'playing', more: FakeEntity[] = []): FakeHass {
  return makeHass({
    devices: [device('d_sala', null, 'Caixa Sala')],
    entities: [
      {
        entity_id: 'media_player.caixa_sala',
        device_id: 'd_sala',
        platform: 'wiim',
        name: 'Caixa Sala',
        state,
        attributes: { supported_features: BASIC, volume_level: 0.25, is_volume_muted: false, ...attributes },
      },
      ...more,
    ],
  });
}

async function mount(h: FakeHass): Promise<HubbMediaPanel> {
  const el = document.createElement('hubb-media-panel') as HubbMediaPanel;
  el.hass = h;
  el.entityId = 'media_player.caixa_sala';
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}

const $ = (el: HubbMediaPanel, sel: string) => el.shadowRoot!.querySelector(sel);
const calls = (h: FakeHass) => h.calls.map((c) => [`${c.domain}.${c.service}`, c.data, c.target?.entity_id]);
const progressOf = (el: HubbMediaPanel) => $(el, 'hubb-media-progress') as (HTMLElement & { updateComplete: Promise<unknown> }) | null;
const times = (p: HTMLElement) => [...p.shadowRoot!.querySelectorAll('.time')].map((t) => t.textContent!.trim());

describe('the media sheet', () => {
  beforeEach(() => vi.useFakeTimers({ now: Date.parse('2026-10-19T12:00:00Z') }));
  afterEach(() => {
    vi.useRealTimers();
    document.body.replaceChildren();
  });

  it('shows the cover large, and nothing in its place when it fails', async () => {
    const el = await mount(speaker({ entity_picture: '/api/capa.jpg', media_title: 'Música', media_artist: 'Banda', media_album_name: 'Disco' }));
    expect(($(el, 'img.cover') as HTMLImageElement).getAttribute('src')).toBe('/api/capa.jpg');
    expect($(el, '.title')!.textContent!.trim()).toBe('Música');
    expect($(el, '.artist')!.textContent!.trim()).toBe('Banda · Disco');
    $(el, 'img.cover')!.dispatchEvent(new Event('error'));
    await el.updateComplete;
    expect($(el, 'img.cover')).toBeNull();
  });

  it('runs the progress while playing, holds it paused, and leaves it out without a time', async () => {
    const at = { media_duration: 192, media_position: 34, media_position_updated_at: '2026-10-19T12:00:00Z' };
    const el = await mount(speaker(at));
    const p = progressOf(el)!;
    await p.updateComplete;
    expect(times(p)).toEqual(['0:34', '3:12']);
    await vi.advanceTimersByTimeAsync(10_000);
    await p.updateComplete;
    expect(times(p)).toEqual(['0:44', '3:12']);
    document.body.replaceChildren();
    const paused = await mount(speaker(at, 'paused'));
    await vi.advanceTimersByTimeAsync(10_000);
    await progressOf(paused)!.updateComplete;
    expect(times(progressOf(paused)!)).toEqual(['0:34', '3:12']);
    document.body.replaceChildren();
    expect(progressOf(await mount(speaker({ media_duration: 192, media_position: 34 })))).toBeNull();
    document.body.replaceChildren();
    expect(progressOf(await mount(speaker({ ...at, media_duration: 0 })))).toBeNull();
  });

  it('lets the progress be dragged only with the seek feature', async () => {
    const at = { media_duration: 192, media_position: 34, media_position_updated_at: '2026-10-19T12:00:00Z' };
    const fixed = await mount(speaker(at));
    await progressOf(fixed)!.updateComplete;
    expect(progressOf(fixed)!.shadowRoot!.querySelector('input')).toBeNull();
    document.body.replaceChildren();
    const h = speaker({ ...at, supported_features: BASIC | F.seek });
    const el = await mount(h);
    progressOf(el)!.dispatchEvent(new CustomEvent('hubb-seek', { detail: { position: 90 } }));
    expect(calls(h)).toEqual([['media_player.media_seek', { seek_position: 90 }, 'media_player.caixa_sala']]);
  });

  it('keeps five places for the controls, empty where the speaker has nothing', async () => {
    const el = await mount(speaker({ supported_features: BASIC | F.next }));
    const slots = [...el.shadowRoot!.querySelectorAll('.controls .slot')];
    expect(slots).toHaveLength(5);
    expect(slots.map((s) => s.querySelector('button')?.className.split(' ').find((c) => ['repeat', 'previous', 'play', 'next', 'shuffle'].includes(c)) ?? null)).toEqual([
      null,
      null,
      'play',
      'next',
      null,
    ]);
  });

  it('cycles repeat and flips shuffle on whoever has them', async () => {
    const h = speaker({ supported_features: BASIC | F.repeat | F.shuffle, repeat: 'all', shuffle: false });
    const el = await mount(h);
    ($(el, '.repeat') as HTMLButtonElement).click();
    ($(el, '.shuffle') as HTMLButtonElement).click();
    expect(calls(h)).toEqual([
      ['media_player.repeat_set', { repeat: 'one' }, 'media_player.caixa_sala'],
      ['media_player.shuffle_set', { shuffle: true }, 'media_player.caixa_sala'],
    ]);
  });

  it('adds up quick volume taps and shows the target at once', async () => {
    const h = speaker();
    const el = await mount(h);
    for (let i = 0; i < 3; i++) ($(el, '.louder') as HTMLButtonElement).click();
    await el.updateComplete;
    expect($(el, '.volume')!.textContent!.trim()).toBe('40%');
    await vi.advanceTimersByTimeAsync(300);
    expect(calls(h)).toEqual([['media_player.volume_set', { volume_level: 0.4 }, 'media_player.caixa_sala']]);
  });

  it('sends the last volume tap when the sheet closes before it leaves', async () => {
    const h = speaker();
    const el = await mount(h);
    ($(el, '.louder') as HTMLButtonElement).click();
    el.remove();
    expect(calls(h)).toEqual([['media_player.volume_set', { volume_level: 0.3 }, 'media_player.caixa_sala']]);
    await vi.advanceTimersByTimeAsync(300);
    expect(calls(h)).toHaveLength(1);
  });

  it('says which repeat is on to a screen reader', async () => {
    const el = await mount(speaker({ supported_features: BASIC | F.repeat, repeat: 'one' }));
    expect($(el, '.repeat')!.getAttribute('aria-label')).toBe('Repetir: só esta');
  });

  it('keeps the seek bar where the finger is while it drags', async () => {
    const h = speaker({ supported_features: BASIC | F.seek, media_duration: 192, media_position: 34, media_position_updated_at: '2026-10-19T12:00:00Z' });
    const el = await mount(h);
    const p = progressOf(el)!;
    await p.updateComplete;
    const range = p.shadowRoot!.querySelector('input') as HTMLInputElement;
    range.value = '100';
    range.dispatchEvent(new Event('input'));
    await vi.advanceTimersByTimeAsync(3000);
    await p.updateComplete;
    expect(range.value).toBe('100');
    range.dispatchEvent(new Event('change'));
    expect(calls(h)).toEqual([['media_player.media_seek', { seek_position: 100 }, 'media_player.caixa_sala']]);
  });

  it('runs the progress again when the sheet comes back on screen', async () => {
    const el = await mount(speaker({ media_duration: 192, media_position: 34, media_position_updated_at: '2026-10-19T12:00:00Z' }));
    const p = progressOf(el)!;
    await p.updateComplete;
    el.remove();
    document.body.appendChild(el);
    await vi.advanceTimersByTimeAsync(10_000);
    await p.updateComplete;
    expect(times(p)).toEqual(['0:44', '3:12']);
  });

  it('sets the volume from the bar, and steps one by one without a level', async () => {
    const h = speaker();
    const el = await mount(h);
    const bar = $(el, 'input.volume-bar') as HTMLInputElement;
    bar.value = '60';
    bar.dispatchEvent(new Event('change'));
    await vi.advanceTimersByTimeAsync(300);
    expect(calls(h)).toEqual([['media_player.volume_set', { volume_level: 0.6 }, 'media_player.caixa_sala']]);
    document.body.replaceChildren();
    const steps = speaker({ supported_features: F.play | F.pause | F.volumeStep, volume_level: undefined });
    const el2 = await mount(steps);
    ($(el2, '.louder') as HTMLButtonElement).click();
    ($(el2, '.louder') as HTMLButtonElement).click();
    expect(calls(steps).map((c) => c[0])).toEqual(['media_player.volume_up', 'media_player.volume_up']);
  });

  it('offers the sound modes only with a choice, and the channel only with its select', async () => {
    const one = await mount(speaker({ supported_features: BASIC | F.soundMode, sound_mode_list: ['Off'], sound_mode: 'Off' }));
    expect($(one, 'select.sound-mode')).toBeNull();
    expect($(one, 'select.channel')).toBeNull();
    document.body.replaceChildren();
    const channel: FakeEntity = {
      entity_id: 'select.caixa_sala_channel',
      device_id: 'd_sala',
      platform: 'wiim',
      translation_key: 'output_channel',
      entity_category: 'config',
      state: 'Left',
      attributes: { options: ['Stereo', 'Left', 'Right'] },
    };
    const h = speaker({ supported_features: BASIC | F.soundMode, sound_mode_list: ['Pop', 'Jazz'], sound_mode: 'Pop' }, 'playing', [channel]);
    const el = await mount(h);
    const modes = $(el, 'select.sound-mode') as HTMLSelectElement;
    modes.value = 'Jazz';
    modes.dispatchEvent(new Event('change'));
    const ch = $(el, 'select.channel') as HTMLSelectElement;
    expect([...ch.options].map((o) => o.textContent!.trim())).toEqual(['Estéreo', 'Esquerdo', 'Direito']);
    ch.value = 'Right';
    ch.dispatchEvent(new Event('change'));
    expect(calls(h)).toEqual([
      ['media_player.select_sound_mode', { sound_mode: 'Jazz' }, 'media_player.caixa_sala'],
      ['select.select_option', { option: 'Right' }, 'select.caixa_sala_channel'],
    ]);
  });

  it('offers playing together to a speaker that groups, with the players the resident sees', async () => {
    const plain = await mount(speaker());
    expect($(plain, 'hubb-media-group')).toBeNull();
    document.body.replaceChildren();
    const el = document.createElement('hubb-media-panel') as HubbMediaPanel;
    el.hass = speaker({ supported_features: BASIC | F.grouping });
    el.entityId = 'media_player.caixa_sala';
    el.visible = ['media_player.caixa_sala', 'media_player.caixa_cozinha'];
    document.body.appendChild(el);
    await el.updateComplete;
    const group = $(el, 'hubb-media-group') as HTMLElement & { visible: string[]; entityId: string };
    expect(group.entityId).toBe('media_player.caixa_sala');
    expect(group.visible).toEqual(['media_player.caixa_sala', 'media_player.caixa_cozinha']);
  });

  it('centres the controls and the volume on one axis', () => {
    const css = ([] as unknown[]).concat(HubbMediaPanel.styles).map((s) => (s as { cssText: string }).cssText).join('\n');
    expect(css).toMatch(/\.controls\s*\{[^}]*justify-content: center/);
    expect(css).toMatch(/\.volume-row\s*\{[^}]*justify-content: center/);
  });
});
