import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '../../src/elements/media-browse';
import type { HubbMediaBrowse } from '../../src/elements/media-browse';
import { makeHass, type FakeHass } from '../helpers/fake-hass';

const MA = 'media_player.caixa_ma';
const song = (n: number, name: string) => ({ media_type: 'track', uri: `spotify://track/${n}`, name, artists: [{ name: 'Banda' }] });

/** Music Assistant answering the library at once and each search when the test says so. */
function house(searches: Record<string, unknown>[] = []) {
  const h = makeHass({});
  const pending: { text: string; resolve: (v: unknown) => void }[] = [];
  h.callWS = vi.fn((msg: Record<string, unknown>) => {
    if (msg.type === 'config_entries/get') return Promise.resolve([{ entry_id: 'ma1', state: 'loaded' }]);
    const data = msg.service_data as Record<string, unknown>;
    if (msg.service === 'get_library') {
      const items = data.media_type === 'playlist' ? [{ media_type: 'playlist', uri: 'spotify://playlist/1', name: 'Churrasco' }] : [song(1, 'Recente')];
      return Promise.resolve({ response: { items } });
    }
    if (msg.service === 'search') return new Promise((resolve) => pending.push({ text: String(data.name), resolve }));
    return Promise.reject(new Error('unexpected'));
  }) as FakeHass['callWS'];
  void searches;
  return { h, pending };
}

async function mount(h: FakeHass): Promise<HubbMediaBrowse> {
  const el = document.createElement('hubb-media-browse') as HubbMediaBrowse;
  el.hass = h;
  el.ma = MA;
  document.body.appendChild(el);
  await vi.advanceTimersByTimeAsync(0);
  await el.updateComplete;
  return el;
}

const names = (el: HubbMediaBrowse) => [...el.shadowRoot!.querySelectorAll('.item .name')].map((n) => n.textContent!.trim());
const type = async (el: HubbMediaBrowse, text: string) => {
  const input = el.shadowRoot!.querySelector('input.search') as HTMLInputElement;
  input.value = text;
  input.dispatchEvent(new Event('input'));
};

describe('Tocar algo', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    document.body.replaceChildren();
  });

  it('lists the recent songs and the playlists', async () => {
    const el = await mount(house().h);
    expect(el.shadowRoot!.querySelector('.label')!.textContent!.trim()).toBe('Tocar algo');
    expect([...el.shadowRoot!.querySelectorAll('.section')].map((s) => s.textContent!.trim())).toEqual(['Tocadas recentemente', 'Playlists']);
    expect(names(el)).toEqual(['Recente', 'Churrasco']);
  });

  it('searches 400 ms after the last key, and only the last answer shows', async () => {
    const { h, pending } = house();
    const el = await mount(h);
    await type(el, 'dir');
    await vi.advanceTimersByTimeAsync(399);
    expect(pending).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(1);
    await type(el, 'dire straits');
    await vi.advanceTimersByTimeAsync(400);
    expect(pending.map((p) => p.text)).toEqual(['dir', 'dire straits']);
    pending[1]!.resolve({ response: { tracks: [song(2, 'Sultans of Swing')] } });
    await vi.advanceTimersByTimeAsync(0);
    pending[0]!.resolve({ response: { tracks: [song(3, 'Direto')] } });
    await vi.advanceTimersByTimeAsync(0);
    await el.updateComplete;
    expect(names(el)).toEqual(['Sultans of Swing']);
  });

  it('says when nothing was found', async () => {
    const { h, pending } = house();
    const el = await mount(h);
    await type(el, 'xyz');
    await vi.advanceTimersByTimeAsync(400);
    pending[0]!.resolve({ response: { tracks: [] } });
    await vi.advanceTimersByTimeAsync(0);
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.none')!.textContent!.trim()).toBe('Nada encontrado');
  });

  it('plays a result on a tap', async () => {
    const { h } = house();
    const el = await mount(h);
    (el.shadowRoot!.querySelector('.item') as HTMLButtonElement).click();
    await vi.advanceTimersByTimeAsync(0);
    expect(h.calls.map((c) => [`${c.domain}.${c.service}`, c.data, c.target?.entity_id])).toEqual([
      ['music_assistant.play_media', { media_id: 'spotify://track/1', media_type: 'track' }, MA],
    ]);
  });

  it('disappears quietly when Music Assistant cannot answer', async () => {
    const h = makeHass({});
    h.callWS = vi.fn(() => Promise.reject(new Error('Unauthorized'))) as FakeHass['callWS'];
    const el = await mount(h);
    expect(el.shadowRoot!.children).toHaveLength(0);
    expect(h.calls).toEqual([]);
  });

  it('brings the search into view when Fonte sends the person here', async () => {
    const el = await mount(house().h);
    const input = el.shadowRoot!.querySelector('input.search') as HTMLInputElement;
    const scroll = vi.fn();
    input.scrollIntoView = scroll;
    el.focusSearch();
    expect(scroll).toHaveBeenCalledOnce();
    expect(el.shadowRoot!.activeElement).toBe(input);
  });

  it('shows the note in place of a cover that does not load', async () => {
    const h = makeHass({});
    h.callWS = vi.fn((msg: Record<string, unknown>) => {
      if (msg.type === 'config_entries/get') return Promise.resolve([{ entry_id: 'ma1', state: 'loaded' }]);
      const data = msg.service_data as Record<string, unknown>;
      return Promise.resolve({ response: { items: data.media_type === 'track' ? [{ ...song(1, 'Recente'), image: 'https://exemplo.invalid/capa.jpg' }] : [] } });
    }) as FakeHass['callWS'];
    const el = await mount(h);
    el.shadowRoot!.querySelector('img.art')!.dispatchEvent(new Event('error'));
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('img.art')).toBeNull();
    expect(el.shadowRoot!.querySelector('.art.note')).not.toBeNull();
  });

  it('keeps the list while the first letters are typed, and searches from the third', async () => {
    // Bench 24/10: the list went blank at the first letter, until an answer came.
    const { h, pending } = house();
    const el = await mount(h);
    await type(el, 'di');
    await vi.advanceTimersByTimeAsync(400);
    await el.updateComplete;
    expect(pending).toHaveLength(0);
    expect(names(el)).toEqual(['Recente', 'Churrasco']);
    await type(el, 'dir');
    await vi.advanceTimersByTimeAsync(400);
    await el.updateComplete;
    expect(pending.map((p) => p.text)).toEqual(['dir']);
    expect(el.shadowRoot!.querySelector('.searching')!.textContent!.trim()).toBe('Buscando…');
    expect(names(el)).toEqual(['Recente', 'Churrasco']);
    pending[0]!.resolve({ response: { tracks: [song(2, 'Sultans of Swing')] } });
    await vi.advanceTimersByTimeAsync(0);
    await el.updateComplete;
    expect(names(el)).toEqual(['Sultans of Swing']);
    expect(el.shadowRoot!.querySelector('.searching')).toBeNull();
  });

  it('keeps the last answer, faded, while new words are searched', async () => {
    const { h, pending } = house();
    const el = await mount(h);
    await type(el, 'dire');
    await vi.advanceTimersByTimeAsync(400);
    pending[0]!.resolve({ response: { tracks: [song(2, 'Sultans of Swing')] } });
    await vi.advanceTimersByTimeAsync(0);
    await el.updateComplete;
    await type(el, 'queen');
    await el.updateComplete;
    expect(names(el)).toEqual(['Sultans of Swing']);
    expect(el.shadowRoot!.querySelector('.results.stale')).not.toBeNull();
    await vi.advanceTimersByTimeAsync(400);
    pending[1]!.resolve({ response: { tracks: [song(3, 'Bohemian Rhapsody')] } });
    await vi.advanceTimersByTimeAsync(0);
    await el.updateComplete;
    expect(names(el)).toEqual(['Bohemian Rhapsody']);
    expect(el.shadowRoot!.querySelector('.results.stale')).toBeNull();
  });
});
