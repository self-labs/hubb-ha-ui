import { afterEach, describe, expect, it, vi } from 'vitest';
import '../../src/elements/media-native';
import type { HubbMediaNative } from '../../src/elements/media-native';
import { makeHass, type FakeHass } from '../helpers/fake-hass';

const SALA = 'media_player.caixa_sala';
const COZINHA = 'media_player.caixa_cozinha';

const entry = (title: string, id: string, extra: Record<string, unknown> = {}) => ({
  title,
  media_class: 'app',
  media_content_type: 'app',
  media_content_id: id,
  can_play: false,
  can_expand: true,
  thumbnail: null,
  ...extra,
});
const station = (title: string, id: string, extra: Record<string, unknown> = {}) => ({ title, media_class: 'music', media_content_type: 'audio/mpeg', media_content_id: id, can_play: true, can_expand: false, ...extra });

const ROOT = {
  title: 'Caixa Sala',
  children: [
    entry('Presets', '', { media_class: 'directory', media_content_type: 'presets' }),
    entry('Radio Browser', 'media-source://radio_browser', { thumbnail: '/api/brands/integration/radio_browser/logo.png' }),
    entry('Text-to-speech', 'media-source://tts'),
  ],
};
const PRESETS = { title: 'Presets', children: [{ title: 'Jazz FM', media_class: 'music', media_content_type: 'preset', media_content_id: '2', can_play: true, can_expand: false }] };
const RADIO = {
  title: 'Radio Browser',
  children: [entry('Por país', 'media-source://radio_browser/countries', { media_class: 'directory' }), station('Rádio Jovem', 'media-source://radio_browser/jp'), entry('Coleção', 'media-source://radio_browser/mix', { can_play: true })],
};
const COUNTRIES = { title: 'Por país', children: [station('Rádio do Brasil', 'media-source://radio_browser/br')] };

interface Library {
  [id: string]: unknown;
}

/** Players answering their folders; `pending` holds the answers of a speaker the test releases by hand. */
function house(library: Library = { '': ROOT, presets: PRESETS, 'media-source://radio_browser': RADIO, 'media-source://radio_browser/countries': COUNTRIES }): FakeHass {
  const h = makeHass({});
  h.callWS = vi.fn((msg: Record<string, unknown>) => {
    if (msg.type === 'auth/sign_path') return Promise.resolve({ path: `${String(msg.path)}?authSig=ok` });
    const key = msg.media_content_type === 'presets' ? 'presets' : String(msg.media_content_id ?? '');
    return key in library ? Promise.resolve(library[key]) : Promise.reject(new Error('not found'));
  }) as FakeHass['callWS'];
  return h;
}

const settle = async (el: HubbMediaNative) => {
  await new Promise((r) => setTimeout(r, 0));
  await el.updateComplete;
  await new Promise((r) => setTimeout(r, 0));
  await el.updateComplete;
};

async function mount(h: FakeHass, entityId = SALA): Promise<HubbMediaNative> {
  const el = document.createElement('hubb-media-native') as HubbMediaNative;
  el.hass = h;
  el.entityId = entityId;
  document.body.appendChild(el);
  await settle(el);
  return el;
}

const names = (el: HubbMediaNative) => [...el.shadowRoot!.querySelectorAll('.item .name')].map((n) => n.textContent!.trim());
const row = (el: HubbMediaNative, title: string) => [...el.shadowRoot!.querySelectorAll<HTMLButtonElement>('.row .item')].find((b) => b.textContent!.includes(title))!;
const browses = (h: FakeHass) => (h.callWS as unknown as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0] as Record<string, unknown>).filter((m) => m.type === 'media_player/browse_media');

describe('Tocar algo from the speaker itself', () => {
  afterEach(() => document.body.replaceChildren());

  it('lists what the speaker keeps and the audio libraries, under the heading of Tocar algo', async () => {
    const el = await mount(house());
    expect(el.shadowRoot!.querySelector('.label')!.textContent!.trim()).toBe('Tocar algo');
    expect(names(el)).toEqual(['Presets', 'Radio Browser']);
    expect(el.shadowRoot!.querySelector('.back')).toBeNull();
    // A folder carries the way in; the logo of a library is signed before it shows.
    expect(row(el, 'Radio Browser').querySelector('.chevron')).not.toBeNull();
    expect(row(el, 'Radio Browser').querySelector('img.art')!.getAttribute('src')).toBe('/api/brands/integration/radio_browser/logo.png?authSig=ok');
    expect(row(el, 'Presets').querySelector('.note')).not.toBeNull();
  });

  it('opens a folder in place, names it, and goes back without asking again', async () => {
    const h = house();
    const el = await mount(h);
    row(el, 'Radio Browser').click();
    await settle(el);
    expect(browses(h).at(-1)).toEqual({ type: 'media_player/browse_media', entity_id: SALA, media_content_id: 'media-source://radio_browser', media_content_type: 'app' });
    expect(el.shadowRoot!.querySelector('.section')!.textContent!.trim()).toBe('Radio Browser');
    expect(names(el)).toEqual(['Voltar', 'Por país', 'Rádio Jovem', 'Coleção']);
    row(el, 'Por país').click();
    await settle(el);
    expect(names(el)).toEqual(['Voltar', 'Rádio do Brasil']);
    const asked = browses(h).length;
    (el.shadowRoot!.querySelector('.back') as HTMLButtonElement).click();
    await settle(el);
    expect(names(el)).toEqual(['Voltar', 'Por país', 'Rádio Jovem', 'Coleção']);
    (el.shadowRoot!.querySelector('.back') as HTMLButtonElement).click();
    await settle(el);
    expect(names(el)).toEqual(['Presets', 'Radio Browser']);
    expect(browses(h)).toHaveLength(asked);
  });

  it('names an open folder by the row tapped, though Radio Browser answers with the name of the library', async () => {
    // As the homelab answered on 11/11: Local stations comes back titled "Radio Browser".
    const radio = { title: 'Radio Browser', children: [entry('Local stations', 'media-source://radio_browser/local', { media_class: 'directory' })] };
    const local = { title: 'Radio Browser', children: [station('Rádio Serrana', 'media-source://radio_browser/s1')] };
    const el = await mount(house({ '': ROOT, 'media-source://radio_browser': radio, 'media-source://radio_browser/local': local }));
    row(el, 'Radio Browser').click();
    await settle(el);
    expect(names(el)).toEqual(['Voltar', 'Emissoras locais']);
    row(el, 'Emissoras locais').click();
    await settle(el);
    expect(el.shadowRoot!.querySelector('.section')!.textContent!.trim()).toBe('Emissoras locais');
    expect(names(el)).toEqual(['Voltar', 'Rádio Serrana']);
  });

  it('plays what is tapped on this speaker, and a whole folder from its own button', async () => {
    const h = house();
    const el = await mount(h);
    row(el, 'Radio Browser').click();
    await settle(el);
    row(el, 'Rádio Jovem').click();
    expect(h.calls).toEqual([{ domain: 'media_player', service: 'play_media', data: { media_content_id: 'media-source://radio_browser/jp', media_content_type: 'audio/mpeg' }, target: { entity_id: SALA } }]);
    // A folder that plays opens on a tap and plays from the button beside it; one that only opens has none.
    expect(el.shadowRoot!.querySelectorAll('.play-all')).toHaveLength(1);
    (el.shadowRoot!.querySelector('.play-all') as HTMLButtonElement).click();
    expect(h.calls[1]).toMatchObject({ service: 'play_media', data: { media_content_id: 'media-source://radio_browser/mix', media_content_type: 'app' } });
    expect(el.shadowRoot!.querySelector('.play-all')!.getAttribute('aria-label')).toBe('Tocar tudo');
  });

  it('plays a preset by the number the speaker gave it', async () => {
    const h = house();
    const el = await mount(h);
    row(el, 'Presets').click();
    await settle(el);
    row(el, 'Jazz FM').click();
    expect(h.calls[0]).toMatchObject({ data: { media_content_id: '2', media_content_type: 'preset' }, target: { entity_id: SALA } });
  });

  it('shows a long folder thirty rows at a time, and keeps how far it was opened when coming back', async () => {
    const long = { title: 'Idiomas', children: [entry('Por país', 'media-source://radio_browser/countries'), ...Array.from({ length: 69 }, (_, i) => station(`Rádio ${i + 1}`, `r${i + 1}`))] };
    const el = await mount(house({ '': ROOT, presets: PRESETS, 'media-source://radio_browser': long, 'media-source://radio_browser/countries': COUNTRIES }));
    row(el, 'Radio Browser').click();
    await settle(el);
    const more = () => el.shadowRoot!.querySelector<HTMLButtonElement>('.more');
    expect(el.shadowRoot!.querySelectorAll('.row')).toHaveLength(30);
    expect(more()!.textContent!.trim()).toBe('Mostrar mais (40)');
    more()!.click();
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('.row')).toHaveLength(60);
    expect(more()!.textContent!.trim()).toBe('Mostrar mais (10)');
    row(el, 'Por país').click();
    await settle(el);
    expect(el.shadowRoot!.querySelector('.more')).toBeNull();
    (el.shadowRoot!.querySelector('.back') as HTMLButtonElement).click();
    await settle(el);
    expect(el.shadowRoot!.querySelectorAll('.row')).toHaveLength(60);
    more()!.click();
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('.row')).toHaveLength(70);
    expect(more()).toBeNull();
  });

  it('says so, and keeps the list, when a folder does not open', async () => {
    const h = house({ '': ROOT, presets: PRESETS });
    const el = await mount(h);
    row(el, 'Radio Browser').click();
    await settle(el);
    expect(el.shadowRoot!.querySelector('.none')!.textContent!.trim()).toBe('Não foi possível abrir');
    expect(names(el)).toEqual(['Presets', 'Radio Browser']);
    expect(el.shadowRoot!.querySelector('.list')!.classList.contains('stale')).toBe(false);
  });

  it('asks again only when the speaker changes, never on a new state', async () => {
    const h = house();
    const el = await mount(h);
    const asked = browses(h).length;
    el.hass = { ...h };
    await settle(el);
    expect(browses(h)).toHaveLength(asked);
    el.entityId = COZINHA;
    await settle(el);
    expect(browses(h).slice(asked).map((m) => m.entity_id)).toContain(COZINHA);
    expect(browses(h).slice(asked).every((m) => m.entity_id === COZINHA)).toBe(true);
  });

  it('drops the answer of the speaker it left, and starts over at the root', async () => {
    const h = makeHass({});
    const late: { resolve: (v: unknown) => void }[] = [];
    h.callWS = vi.fn((msg: Record<string, unknown>) =>
      msg.entity_id === SALA ? new Promise((resolve) => late.push({ resolve })) : Promise.resolve({ title: 'Cozinha', children: [station('Rádio da Cozinha', 'c')] }),
    ) as FakeHass['callWS'];
    const el = await mount(h);
    el.entityId = COZINHA;
    await settle(el);
    late[0]!.resolve({ title: 'Sala', children: [station('Rádio da Sala', 's')] });
    await settle(el);
    expect(names(el)).toEqual(['Rádio da Cozinha']);
  });

  it('leaves the sheet in silence when the speaker lists nothing, or does not answer', async () => {
    const empty = await mount(house({ '': { title: 'Caixa', children: [entry('Text-to-speech', 'media-source://tts')] } }));
    expect(empty.shadowRoot!.querySelector('.label')).toBeNull();
    document.body.replaceChildren();
    const broken = makeHass({});
    broken.callWS = vi.fn(() => Promise.reject(new Error('boom'))) as FakeHass['callWS'];
    const el = await mount(broken);
    expect(el.shadowRoot!.querySelector('.label')).toBeNull();
    document.body.replaceChildren();
    const offline = await mount(makeHass({}));
    expect(offline.shadowRoot!.querySelector('.label')).toBeNull();
  });

  it('takes the note when a picture fails to load', async () => {
    const el = await mount(house());
    const img = row(el, 'Radio Browser').querySelector('img.art')!;
    img.dispatchEvent(new Event('error'));
    await el.updateComplete;
    expect(row(el, 'Radio Browser').querySelector('img.art')).toBeNull();
    expect(row(el, 'Radio Browser').querySelector('.note')).not.toBeNull();
  });
});
