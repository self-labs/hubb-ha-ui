import { afterEach, describe, expect, it, vi } from 'vitest';
import { MEDIA_FEATURE } from '../src/actions/media';
import '../src/elements/climate-panel';
import type { HubbClimatePanel } from '../src/elements/climate-panel';
import '../src/elements/cover-tile';
import '../src/elements/media-group';
import '../src/elements/media-panel';
import '../src/elements/slide-confirm';
import type { HubbSlideConfirm } from '../src/elements/slide-confirm';
import '../src/elements/status-strips';
import { resetWarned } from '../src/elements/status-strips';
import { buildHouse } from '../src/model/build-house';
import { consumptionOf } from '../src/model/energy';
import type { AlertItem, Shared } from '../src/model/types';
import '../src/screens/room-screen';
import type { HubbRoomScreen } from '../src/screens/room-screen';
import '../src/screens/security-screen';
import { area, device, makeHass, type FakeEntity, type FakeHass } from './helpers/fake-hass';

type Mounted = HTMLElement & { updateComplete: Promise<unknown> };

async function mount<T extends Mounted>(tag: string, props: Record<string, unknown>): Promise<T> {
  const el = document.createElement(tag) as T;
  Object.assign(el, props);
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}

const $ = (el: Element, sel: string) => el.shadowRoot!.querySelector(sel);
const text = (el: Element, sel: string) => $(el, sel)?.textContent?.replace(/\s+/g, ' ').trim() ?? null;
const services = (h: FakeHass) => h.calls.map((c) => [`${c.domain}.${c.service}`, c.data]);
// happy-dom miscounts the options Lit puts in a select: read the selected attribute, which a browser shows.
const marked = (select: HTMLSelectElement) => [...select.options].filter((o) => o.hasAttribute('selected')).map((o) => [o.textContent!.trim(), o.disabled]);

describe('the minors of M3 left for later (14/10)', () => {
  afterEach(() => {
    vi.useRealTimers();
    document.body.replaceChildren();
  });

  it('steps a player whose level is unknown with its own steps, never from zero, and leaves the bar out', async () => {
    vi.useFakeTimers();
    const F = MEDIA_FEATURE;
    const h = makeHass({ entities: [{ entity_id: 'media_player.tv', state: 'on', attributes: { supported_features: F.volumeSet | F.volumeStep | F.mute } }] });
    const el = await mount<Mounted>('hubb-media-panel', { hass: h, entityId: 'media_player.tv' });
    expect($(el, 'input.volume-bar')).toBeNull();
    expect(text(el, '.volume')).toBe('');
    ($(el, '.louder') as HTMLButtonElement).click();
    ($(el, '.quieter') as HTMLButtonElement).click();
    await vi.advanceTimersByTimeAsync(300);
    expect(services(h)).toEqual([
      ['media_player.volume_up', undefined],
      ['media_player.volume_down', undefined],
    ]);
  });

  it('turns up a speaker of the group that does not say its level with its own step, in Volume de todas', async () => {
    vi.useFakeTimers();
    const F = MEDIA_FEATURE;
    const speaker = (entity_id: string, area_id: string, volume?: number): FakeEntity => ({
      entity_id,
      area_id,
      platform: 'wiim',
      state: 'playing',
      attributes: { supported_features: F.grouping | F.volumeSet, group_members: ['media_player.sala', 'media_player.cozinha'], ...(volume === undefined ? {} : { volume_level: volume }) },
    });
    const h = makeHass({
      areas: [area('sala', 'Sala'), area('cozinha', 'Cozinha')],
      entities: [speaker('media_player.sala', 'sala', 0.3), speaker('media_player.cozinha', 'cozinha')],
    });
    const el = await mount<Mounted>('hubb-media-group', { hass: h, entityId: 'media_player.sala', visible: ['media_player.sala', 'media_player.cozinha'] });
    ($(el, '.all-louder') as HTMLButtonElement).click();
    await vi.advanceTimersByTimeAsync(300);
    expect(h.calls.map((c) => [`${c.domain}.${c.service}`, c.data, c.target?.entity_id])).toEqual([
      ['media_player.volume_up', undefined, 'media_player.cozinha'],
      ['media_player.volume_set', { volume_level: 0.35 }, 'media_player.sala'],
    ]);
  });

  it('forgets the keyboard progress of a slide when the focus leaves it, so one later press never opens', async () => {
    const el = await mount<HubbSlideConfirm>('hubb-slide-confirm', { label: 'Deslize para abrir' });
    let fired = 0;
    el.addEventListener('hubb-confirm', () => fired++);
    const track = $(el, '.track') as HTMLElement;
    for (let i = 0; i < 3; i++) track.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await el.updateComplete;
    expect(track.getAttribute('aria-valuenow')).toBe('75');
    track.dispatchEvent(new FocusEvent('blur'));
    await el.updateComplete;
    expect(track.getAttribute('aria-valuenow')).toBe('0');
    track.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(fired).toBe(0);
  });

  it('lets neither a second finger drive the slide nor fire it', async () => {
    const el = await mount<HubbSlideConfirm>('hubb-slide-confirm', { label: 'Deslize para abrir' });
    let fired = 0;
    el.addEventListener('hubb-confirm', () => fired++);
    const thumb = $(el, '.thumb') as HTMLElement;
    ($(el, '.track') as HTMLElement).getBoundingClientRect = () => ({ width: 300 }) as DOMRect;
    thumb.getBoundingClientRect = () => ({ width: 44 }) as DOMRect;
    const finger = (type: string, pointerId: number, clientX: number) => thumb.dispatchEvent(new PointerEvent(type, { pointerId, clientX, bubbles: true }));
    finger('pointerdown', 1, 10);
    finger('pointerdown', 2, 10);
    finger('pointermove', 2, 290);
    expect(el.progress).toBe(0);
    finger('pointerup', 2, 290);
    expect(fired).toBe(0);
  });

  it('shows no choice of a select that has no value, nor the first one when the value is not on the list', async () => {
    const F = MEDIA_FEATURE;
    const tv = (source: unknown) =>
      makeHass({
        entities: [
          {
            entity_id: 'media_player.tv',
            state: 'on',
            attributes: { supported_features: F.source | F.soundMode, source, source_list: ['HDMI 1', 'HDMI 2'], sound_mode: null, sound_mode_list: ['Filme', 'Música'] },
          },
        ],
      });
    const none = await mount<Mounted>('hubb-media-panel', { hass: tv(null), entityId: 'media_player.tv' });
    expect(marked($(none, 'select.source') as HTMLSelectElement)).toEqual([['', true]]);
    expect(marked($(none, 'select.sound-mode') as HTMLSelectElement)).toEqual([['', true]]);
    document.body.replaceChildren();
    // An app on the TV is a source of its own, not on the list of inputs: it keeps its name.
    const app = await mount<Mounted>('hubb-media-panel', { hass: tv('Netflix'), entityId: 'media_player.tv' });
    expect(marked($(app, 'select.source') as HTMLSelectElement)).toEqual([['Netflix', true]]);
    document.body.replaceChildren();
    const ar = makeHass({
      entities: [{ entity_id: 'climate.ar', state: 'cool', attributes: { hvac_modes: ['off', 'cool'], temperature: 23, supported_features: 1 | 16, preset_modes: ['none', 'sleep'], preset_mode: null } }],
    });
    const panel = await mount<HubbClimatePanel>('hubb-climate-panel', { hass: ar, entityId: 'climate.ar' });
    expect(marked($(panel, 'select.preset') as HTMLSelectElement)).toEqual([['', true]]);
  });

  it('shows the value of a function select of an air conditioner that is not among its options, instead of the first one', async () => {
    const h = makeHass({
      areas: [area('sala', 'Sala')],
      devices: [device('d_ar', 'sala', 'Ar')],
      entities: [
        { entity_id: 'climate.ar', device_id: 'd_ar', state: 'cool', attributes: { hvac_modes: ['off', 'cool'], temperature: 23, supported_features: 1 } },
        { entity_id: 'select.ar_volume', device_id: 'd_ar', state: 'mute', entity_category: 'config', attributes: { friendly_name: 'Ar Volume', options: ['low', 'high'] } },
      ],
    });
    const allowed = buildHouse(h, {}).rooms[0]!.climate[0]!;
    const panel = await mount<HubbClimatePanel>('hubb-climate-panel', { hass: h, entityId: 'climate.ar', allowed });
    expect(marked($(panel, 'select.extra-select') as HTMLSelectElement)).toEqual([['mute', true]]);
  });

  it('follows the speeds of the fan itself, when it says how many it has', async () => {
    const fan = (step: number | undefined, percentage: number) =>
      makeHass({ entities: [{ entity_id: 'fan.teto', state: 'on', attributes: { percentage, supported_features: 1, ...(step === undefined ? {} : { percentage_step: step }) } }] });
    const speeds = (el: Element) => [...el.shadowRoot!.querySelectorAll('.speed')].map((b) => [b.textContent!.trim(), b.getAttribute('aria-pressed')]);
    const three = fan(100 / 3, 66);
    const el = await mount<HubbClimatePanel>('hubb-climate-panel', { hass: three, entityId: 'fan.teto' });
    expect(speeds(el)).toEqual([
      ['33%', 'false'],
      ['66%', 'true'],
      ['100%', 'false'],
    ]);
    (el.shadowRoot!.querySelector('.speed') as HTMLButtonElement).click();
    // What Home Assistant reports for speed 1 of 3, which every integration takes back as speed 1.
    expect(services(three)).toEqual([['fan.set_percentage', { percentage: 33 }]]);
    document.body.replaceChildren();
    // Ten speeds do not fit a row: four of its own, spread out.
    const ten = await mount<HubbClimatePanel>('hubb-climate-panel', { hass: fan(10, 50), entityId: 'fan.teto' });
    expect(speeds(ten).map(([t]) => t)).toEqual(['30%', '50%', '80%', '100%']);
    document.body.replaceChildren();
    // One speed is no choice.
    const one = await mount<HubbClimatePanel>('hubb-climate-panel', { hass: fan(100, 100), entityId: 'fan.teto' });
    expect(one.shadowRoot!.querySelectorAll('.speed')).toHaveLength(0);
  });

  it('turns a curtain that cannot stop back the other way when tapped while it moves', async () => {
    const cortina = (state: string, attributes: Record<string, unknown>) =>
      makeHass({ entities: [{ entity_id: 'cover.cortina', state, attributes: { supported_features: 1 | 2, ...attributes } }] });
    const closing = cortina('closing', { current_position: 60, supported_features: 1 | 2 | 4 });
    ($(await mount<Mounted>('hubb-cover-tile', { hass: closing, item: { entityId: 'cover.cortina', name: 'Cortina' } }), 'button') as HTMLButtonElement).click();
    expect(services(closing)).toEqual([['cover.open_cover', undefined]]);
    document.body.replaceChildren();
    const opening = cortina('opening', {});
    ($(await mount<Mounted>('hubb-cover-tile', { hass: opening, item: { entityId: 'cover.cortina', name: 'Cortina' } }), 'button') as HTMLButtonElement).click();
    expect(services(opening)).toEqual([['cover.close_cover', undefined]]);
  });

  it('names what an air conditioner, a fan, a curtain, a player or a lock named after its room is', () => {
    const named = (id: string, n: number, attributes: Record<string, unknown> = {}): FakeEntity => ({
      entity_id: id,
      device_id: `d${n}`,
      state: 'off',
      attributes: { friendly_name: 'Sala', ...attributes },
    });
    const h = makeHass({
      areas: [area('sala', 'Sala')],
      devices: [1, 2, 3, 4, 5, 6, 7].map((n) => device(`d${n}`, 'sala', 'Sala')),
      entities: [
        named('climate.sala', 1, { hvac_modes: ['off', 'cool'] }),
        named('fan.sala', 2),
        named('cover.sala_1', 3),
        named('cover.sala_2', 4),
        named('media_player.sala', 5),
        named('lock.sala', 6),
        named('cover.sala_portao', 7, { device_class: 'gate' }),
      ],
    });
    const room = buildHouse(h, { entities: { 'lock.sala': { name: 'Sala' } } }).rooms[0]!;
    // "Ar", as an "Ar da sala" already reads: the editor's "Ar-condicionado" is too long for a card.
    expect(room.climate.map((c) => c.name)).toEqual(['Ar', 'Ventilador']);
    expect(room.covers.map((c) => c.name)).toEqual(['Cortina 1', 'Cortina 2']);
    expect(room.media.map((m) => m.name)).toEqual(['Mídia']);
    // A name from the YAML stays as it is.
    expect(room.access.map((a) => a.name).sort()).toEqual(['Portão', 'Sala']);
  });

  it('has a power button for an air conditioner that turns off by itself with no off mode', async () => {
    const h = makeHass({ entities: [{ entity_id: 'climate.ar', state: 'cool', attributes: { hvac_modes: ['cool', 'dry'], temperature: 23, supported_features: 1 | 128 | 256 } }] });
    const el = await mount<HubbClimatePanel>('hubb-climate-panel', { hass: h, entityId: 'climate.ar' });
    ($(el, '.power') as HTMLButtonElement).click();
    expect(services(h)).toEqual([['climate.turn_off', undefined]]);
  });
});

describe('the minors of M4 left for later (14/10)', () => {
  afterEach(() => {
    resetWarned();
    document.body.replaceChildren();
    history.replaceState(null, '', '/');
  });

  it('keeps the keyboard and screen readers out of the page and of an open sheet while the house is out of reach', async () => {
    const h = makeHass({
      areas: [area('sala', 'Sala')],
      entities: [{ entity_id: 'climate.ar', area_id: 'sala', name: 'Ar', state: 'cool', attributes: { hvac_modes: ['off', 'cool'], temperature: 23, supported_features: 1 | 128 | 256 } }],
    });
    const room = buildHouse(h, {}).rooms[0]!;
    const el = await mount<HubbRoomScreen>('hubb-room-screen', {});
    el.setConfig({ type: 'custom:hubb-room-screen', room, lightIds: [] });
    el.hass = h;
    el.device = { sheet: 'climate', entityId: 'climate.ar' };
    await el.updateComplete;
    const inert = () => ['main', 'hubb-climate-panel', 'hubb-status-strips', 'hubb-nav-bar'].map((s) => $(el, s)!.hasAttribute('inert'));
    expect(inert()).toEqual([false, false, false, false]);
    el.hass = { ...h, connected: false };
    await el.updateComplete;
    // The strip that says so and the bar stay reachable; the sheet still closes.
    expect(inert()).toEqual([true, true, false, false]);
    el.hass = { ...h, connected: true };
    await el.updateComplete;
    expect(inert()).toEqual([false, false, false, false]);
  });

  it('gives a Tasmota plug its Hoje from the energy sensor that keeps statistics, today before total', () => {
    const sensor = (id: string, cls: string, stateClass?: string): FakeEntity => ({
      entity_id: id,
      device_id: 'd_plug',
      state: '1.2',
      attributes: { device_class: cls, ...(stateClass ? { state_class: stateClass } : {}) },
    });
    const h = makeHass({
      areas: [area('sala', 'Sala')],
      devices: [device('d_plug', 'sala', 'Tomada')],
      entities: [
        { entity_id: 'switch.tomada', device_id: 'd_plug', state: 'on', attributes: { device_class: 'outlet' } },
        sensor('sensor.tomada_energy_total', 'energy', 'total'),
        sensor('sensor.tomada_energy_yesterday', 'energy'),
        sensor('sensor.tomada_energy_today', 'energy', 'total_increasing'),
        sensor('sensor.tomada_power', 'power', 'measurement'),
      ],
    });
    expect(consumptionOf(h, 'switch.tomada')).toEqual({ power: 'sensor.tomada_power', energy: 'sensor.tomada_energy_today' });
  });

  it('lists the alerts that are on in Segurança, where the strip of one with no room leads', async () => {
    const h = makeHass({
      areas: [area('sala', 'Sala')],
      entities: [
        { entity_id: 'binary_sensor.detector', name: 'Detector do corredor', state: 'on', attributes: { device_class: 'smoke' } },
        { entity_id: 'binary_sensor.vazamento', area_id: 'sala', name: 'Vazamento', state: 'off', attributes: { device_class: 'moisture' } },
        { entity_id: 'binary_sensor.porta', area_id: 'sala', name: 'Porta', state: 'off', attributes: { device_class: 'door' } },
      ],
    });
    const house = buildHouse(h, {});
    const shared: Shared = { alerts: house.alerts, security: true, scenes: true };
    const el = await mount<Mounted>('hubb-security-screen', {});
    (el as unknown as { setConfig: (c: unknown) => void }).setConfig({ type: 'custom:hubb-security-screen', security: house.security, shared });
    (el as unknown as { hass: FakeHass }).hass = h;
    await el.updateComplete;
    const alerts = [...el.shadowRoot!.querySelectorAll('.alerts hubb-sensor-tile')] as (Mounted & { item: { name: string } })[];
    expect(alerts.map((a) => a.item.name)).toEqual(['Detector do corredor']);
    await alerts[0]!.updateComplete;
    expect(text(alerts[0]!, '.state')).toBe('Fumaça detectada');
    expect(text(el, 'h2')).toBe('Alertas');
  });

  it('does not stack a second history entry when the strip leads to the page it is on', async () => {
    const alerts: AlertItem[] = [{ entityId: 'binary_sensor.fumaca', kind: 'smoke', roomName: null, path: null }];
    const h = makeHass({ entities: [{ entity_id: 'binary_sensor.fumaca', state: 'on' }] });
    history.replaceState(null, '', '/hubb-casa/seguranca');
    const push = vi.spyOn(history, 'pushState');
    const el = await mount<Mounted>('hubb-status-strips', { hass: h, alerts });
    ($(el, '.alert') as HTMLButtonElement).click();
    expect(push).not.toHaveBeenCalled();
    expect(location.pathname).toBe('/hubb-casa/seguranca');
    history.replaceState(null, '', '/hubb-casa/home');
    ($(el, '.alert') as HTMLButtonElement).click();
    expect(push).toHaveBeenCalledOnce();
    push.mockRestore();
  });
});
