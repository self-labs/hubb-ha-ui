import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setEditing } from '../src/editing';
import '../src/elements/access-tile';
import type { HubbAccessTile } from '../src/elements/access-tile';
import '../src/elements/item-editor';
import type { HubbSlideConfirm } from '../src/elements/slide-confirm';
import type { HubbToast } from '../src/elements/toast';
import { allLightIds, buildHouse } from '../src/model/build-house';
import { readConfig } from '../src/model/config';
import { gateSensorCandidates, sensorPosition } from '../src/model/gate-sensor';
import type { AccessItem, HubbConfig } from '../src/model/types';
import '../src/screens/room-screen';
import type { HubbRoomScreen } from '../src/screens/room-screen';
import '../src/screens/security-screen';
import { admin, flush } from './helpers/fake-dashboard';
import { area, makeHass, withState, type FakeHass } from './helpers/fake-hass';

/** A garage with a pulse relay for the gate, its contact, another door, a window and a sensor made a cover. */
function garage(contato = 'off', user?: { id: string; name: string; is_admin: boolean }): FakeHass {
  return makeHass({
    user,
    areas: [area('garagem', 'Garagem'), area('sala', 'Sala')],
    entities: [
      { entity_id: 'switch.portao', area_id: 'garagem', name: 'Portão', state: 'off' },
      { entity_id: 'binary_sensor.portao_contato', area_id: 'garagem', name: 'Contato do portão', state: contato, attributes: { device_class: 'garage_door' } },
      { entity_id: 'binary_sensor.porta_lateral', area_id: 'garagem', name: 'Porta lateral', state: 'off', attributes: { device_class: 'door' } },
      { entity_id: 'binary_sensor.janela_garagem', area_id: 'garagem', name: 'Janela', state: 'off', attributes: { device_class: 'window' } },
      { entity_id: 'cover.sensor_portao', area_id: 'garagem', name: 'Sensor Portão', state: 'closed' },
      { entity_id: 'binary_sensor.porta_sala', area_id: 'sala', name: 'Porta da sala', state: 'off', attributes: { device_class: 'door' } },
      { entity_id: 'light.garagem', area_id: 'garagem', name: 'Luz', state: 'off' },
    ],
  });
}

const PAIRED: HubbConfig = { entities: { 'switch.portao': { role: 'gate', sensor: 'binary_sensor.portao_contato' } } };
const relay: AccessItem = { entityId: 'switch.portao', name: 'Portão', kind: 'pulse', sensor: 'binary_sensor.portao_contato' };

async function mount(hass: FakeHass, item: AccessItem): Promise<HubbAccessTile> {
  const el = document.createElement('hubb-access-tile') as HubbAccessTile;
  el.hass = hass;
  el.item = item;
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}

const text = (el: HubbAccessTile, sel: string) => el.shadowRoot!.querySelector(sel)?.textContent?.trim() ?? null;
const slide = (el: HubbAccessTile) => el.shadowRoot!.querySelector('hubb-slide-confirm') as HubbSlideConfirm | null;
const closeButton = (el: HubbAccessTile) => el.shadowRoot!.querySelector('.close') as HTMLButtonElement | null;
const calls = (h: FakeHass) => h.calls.map((c) => `${c.domain}.${c.service}`);

async function later(el: HubbAccessTile, ms = 0): Promise<void> {
  await vi.advanceTimersByTimeAsync(ms);
  await el.updateComplete;
}

async function slideIt(el: HubbAccessTile): Promise<void> {
  slide(el)!.dispatchEvent(new CustomEvent('hubb-confirm', { bubbles: true, composed: true }));
  await later(el);
}

async function feed(el: HubbAccessTile, h: FakeHass, entityId: string, state: string): Promise<FakeHass> {
  const next = withState(h, entityId, state);
  el.hass = next;
  await el.updateComplete;
  return next;
}

describe('the sensor of a pulse gate, in the model', () => {
  it('reads open or closed from a door contact, and the position of a cover', () => {
    const h = makeHass({
      entities: [
        { entity_id: 'binary_sensor.a', state: 'on' },
        { entity_id: 'binary_sensor.b', state: 'off' },
        { entity_id: 'binary_sensor.c', state: 'unavailable' },
        { entity_id: 'cover.d', state: 'opening' },
        { entity_id: 'cover.e', state: 'unknown' },
      ],
    });
    const ids = ['binary_sensor.a', 'binary_sensor.b', 'binary_sensor.c', 'cover.d', 'cover.e', 'binary_sensor.none'];
    expect(ids.map((id) => sensorPosition(h, id))).toEqual(['open', 'closed', null, 'opening', null, null]);
  });

  it('takes the sensor from the YAML', () => {
    const r = readConfig(garage(), PAIRED);
    expect(r.entities['switch.portao']?.sensor).toBe('binary_sensor.portao_contato');
    expect(r.problems).toEqual([]);
  });

  it('sends to Revisar a sensor that does not exist, is not a sensor, or sits on something that is not a pulse gate', () => {
    const r = readConfig(garage(), {
      entities: {
        'switch.portao': { role: 'gate', sensor: 'binary_sensor.nada' },
        'cover.sensor_portao': { sensor: 'binary_sensor.portao_contato' },
        'light.garagem': { sensor: 'binary_sensor.portao_contato' },
      },
    });
    expect(r.problems.map((p) => [p.key, p.message])).toEqual([
      ['entities.switch.portao.sensor', 'binary_sensor.nada não existe no Home Assistant.'],
      ['entities.cover.sensor_portao.sensor', 'sensor só vale para um portão por pulso (role: gate num switch, button, input_button ou script).'],
      ['entities.light.garagem.sensor', 'sensor só vale para um portão por pulso (role: gate num switch, button, input_button ou script).'],
    ]);
    expect(r.entities['switch.portao']?.sensor).toBeUndefined();
    const wrong = readConfig(garage(), { entities: { 'switch.portao': { role: 'gate', sensor: 'light.garagem' } } });
    expect(wrong.problems.map((p) => [p.key, p.message])).toEqual([
      ['entities.switch.portao.sensor', 'sensor: light.garagem não é um sensor de porta nem um portão.'],
    ]);
  });

  it('hands the sensor to the card of the gate, marks it in Sensores, and keeps it in what is open (decision B)', () => {
    const house = buildHouse(garage('on'), PAIRED);
    const room = house.rooms.find((r) => r.areaId === 'garagem')!;
    expect(room.access.find((a) => a.entityId === 'switch.portao')).toEqual(relay);
    expect(room.sensors.find((s) => s.entityId === 'binary_sensor.portao_contato')?.pairedWith).toBe('switch.portao');
    expect(room.sensors.find((s) => s.entityId === 'binary_sensor.porta_lateral')?.pairedWith).toBeUndefined();
    expect(room.openings.map((o) => o.entityId)).toContain('binary_sensor.portao_contato');
    expect(house.security.openings.map((o) => o.entityId)).toContain('binary_sensor.portao_contato');
    expect(house.security.access.find((a) => a.entityId === 'switch.portao')?.sensor).toBe('binary_sensor.portao_contato');
  });

  it('takes a cover used as the sensor out of Acesso: its slide would move the sensor, not the gate', () => {
    const house = buildHouse(garage(), { entities: { 'switch.portao': { role: 'gate', sensor: 'cover.sensor_portao' } } });
    expect(house.rooms.find((r) => r.areaId === 'garagem')!.access.map((a) => a.entityId)).toEqual(['switch.portao']);
    expect(house.security.access.map((a) => a.entityId)).toEqual(['switch.portao']);
  });

  it('gives the sensor back to Sensores for whoever cannot see the gate', () => {
    const lia = { id: 'u_lia', name: 'Lia', is_admin: false };
    const house = buildHouse(garage('off', lia), { entities: { 'switch.portao': { role: 'gate', sensor: 'binary_sensor.portao_contato', hidden_for: ['u_lia'] } } });
    const room = house.rooms.find((r) => r.areaId === 'garagem')!;
    expect(room.access.map((a) => a.entityId)).not.toContain('switch.portao');
    expect(room.sensors.find((s) => s.entityId === 'binary_sensor.portao_contato')).toEqual({
      entityId: 'binary_sensor.portao_contato',
      name: 'Contato do portão',
      kind: 'garage_door',
    });
  });

  it('keeps no sensor on the card when the YAML names one that does not exist', () => {
    const house = buildHouse(garage(), { entities: { 'switch.portao': { role: 'gate', sensor: 'binary_sensor.nada' } } });
    expect(house.rooms.find((r) => r.areaId === 'garagem')!.access.find((a) => a.entityId === 'switch.portao')).toEqual({
      entityId: 'switch.portao',
      name: 'Portão',
      kind: 'pulse',
    });
  });

  it('offers the door contacts and the gates of the room, the one chosen even from elsewhere, by name', () => {
    const h = garage();
    expect(gateSensorCandidates(h, {}, 'garagem', 'switch.portao')).toEqual([
      { entityId: 'binary_sensor.portao_contato', name: 'Contato do portão' },
      { entityId: 'binary_sensor.porta_lateral', name: 'Porta lateral' },
      { entityId: 'cover.sensor_portao', name: 'Sensor Portão' },
    ]);
    const moved: HubbConfig = { entities: { 'binary_sensor.porta_sala': { area: 'garagem' } } };
    expect(gateSensorCandidates(h, moved, 'garagem', 'switch.portao').map((c) => c.entityId)).toContain('binary_sensor.porta_sala');
    const chosen: HubbConfig = { entities: { 'switch.portao': { role: 'gate', sensor: 'binary_sensor.porta_sala' } } };
    expect(gateSensorCandidates(h, chosen, 'garagem', 'switch.portao').map((c) => c.name)).toEqual([
      'Contato do portão',
      'Porta da sala',
      'Porta lateral',
      'Sensor Portão',
    ]);
  });
});

describe('the card of a pulse gate with a sensor', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    document.body.replaceChildren();
  });

  it('shows Fechado and opens by sliding; says Abrindo… until the sensor says open, then Aberto with Fechar', async () => {
    const h = garage();
    const el = await mount(h, relay);
    expect(text(el, '.state')).toBe('Fechado');
    expect(slide(el)!.label).toBe('Deslize para abrir');
    expect(closeButton(el)).toBeNull();
    await slideIt(el);
    expect(calls(h)).toEqual(['switch.turn_on']);
    expect(text(el, '.state')).toBe('Abrindo…');
    // The direction is only a guess from here: a second pulse would stop the gate, so it takes a slide.
    expect(slide(el)!.label).toBe('Deslize para acionar');
    expect(slide(el)!.disabled).toBe(true);
    await later(el, 3100);
    expect(text(el, '.state')).toBe('Abrindo…');
    expect(slide(el)!.disabled).toBe(false);
    await feed(el, h, 'binary_sensor.portao_contato', 'on');
    expect(text(el, '.state')).toBe('Aberto');
    expect(slide(el)).toBeNull();
    expect(closeButton(el)!.textContent!.trim()).toBe('Fechar');
    expect(el.shadowRoot!.querySelector('.card')!.classList.contains('on')).toBe(true);
  });

  it('closes an open gate with one tap, and says Fechando… until the sensor says closed', async () => {
    const h = garage('on');
    const el = await mount(h, relay);
    expect(text(el, '.state')).toBe('Aberto');
    closeButton(el)!.click();
    await later(el);
    expect(calls(h)).toEqual(['switch.turn_on']);
    expect(text(el, '.state')).toBe('Fechando…');
    expect(closeButton(el)).toBeNull();
    await later(el, 20_000);
    expect(text(el, '.state')).toBe('Fechando…');
    await feed(el, h, 'binary_sensor.portao_contato', 'off');
    expect(text(el, '.state')).toBe('Fechado');
    expect(slide(el)!.label).toBe('Deslize para abrir');
  });

  it('forgets the wait once the sensor moved: a gate closed again by the remote is Fechado, not Abrindo…', async () => {
    let h = garage();
    const el = await mount(h, relay);
    await slideIt(el);
    h = await feed(el, h, 'binary_sensor.portao_contato', 'on');
    await later(el, 30_000);
    await feed(el, h, 'binary_sensor.portao_contato', 'off');
    expect(text(el, '.state')).toBe('Fechado');
    expect(slide(el)!.label).toBe('Deslize para abrir');
  });

  it('gives up waiting after 90 s and shows what the sensor says', async () => {
    const h = garage('on');
    const el = await mount(h, relay);
    closeButton(el)!.click();
    await later(el, 89_000);
    expect(text(el, '.state')).toBe('Fechando…');
    await later(el, 1100);
    expect(text(el, '.state')).toBe('Aberto');
    expect(closeButton(el)).not.toBeNull();
  });

  it('pulses again without promising a direction when slid during the wait, and says Feito', async () => {
    const h = garage();
    const el = await mount(h, relay);
    await slideIt(el);
    await later(el, 3100);
    await slideIt(el);
    expect(calls(h)).toEqual(['switch.turn_on', 'switch.turn_on']);
    expect(text(el, '.state')).toBe('Feito');
    await later(el, 2100);
    expect(text(el, '.state')).toBe('Fechado');
    // Until the sensor moves, or 90 s pass, the way the gate goes after that pulse is unknown.
    expect(slide(el)!.label).toBe('Deslize para acionar');
    await later(el, 88_000);
    expect(slide(el)!.label).toBe('Deslize para abrir');
  });

  it('says Sem resposta and offers Deslize para acionar while the sensor does not answer', async () => {
    const h = garage('unavailable');
    const el = await mount(h, relay);
    expect(text(el, '.state')).toBe('Sem resposta');
    expect(slide(el)!.label).toBe('Deslize para acionar');
    expect(slide(el)!.disabled).toBe(false);
    await slideIt(el);
    expect(calls(h)).toEqual(['switch.turn_on']);
    expect(text(el, '.state')).toBe('Feito');
  });

  it('drops the wait when the pulse fails, says Sem resposta, then the sensor again', async () => {
    const h = garage();
    h.callService = vi.fn(() => Promise.reject(new Error('offline')));
    const el = await mount(h, relay);
    await slideIt(el);
    expect(text(el, '.state')).toBe('Sem resposta');
    await later(el, 2100);
    expect(text(el, '.state')).toBe('Fechado');
    expect(slide(el)!.label).toBe('Deslize para abrir');
  });

  it('reads a cover used as the sensor', async () => {
    const h = makeHass({
      entities: [
        { entity_id: 'switch.portao', state: 'off' },
        { entity_id: 'cover.sensor_portao', state: 'open' },
      ],
    });
    const el = await mount(h, { ...relay, sensor: 'cover.sensor_portao' });
    expect(text(el, '.state')).toBe('Aberto');
    expect(closeButton(el)).not.toBeNull();
    await feed(el, h, 'cover.sensor_portao', 'closing');
    expect(text(el, '.state')).toBe('Fechando…');
    // On its way the next pulse may stop it: no direction promised, like during the wait.
    expect(slide(el)!.label).toBe('Deslize para acionar');
    expect(closeButton(el)).toBeNull();
  });

  it('promises no direction while a cover used as the sensor says it is moving, and a slide is a bare pulse', async () => {
    const h = makeHass({
      entities: [
        { entity_id: 'switch.portao', state: 'off' },
        { entity_id: 'cover.sensor_portao', state: 'opening' },
      ],
    });
    const el = await mount(h, { ...relay, sensor: 'cover.sensor_portao' });
    expect(text(el, '.state')).toBe('Abrindo…');
    expect(closeButton(el)).toBeNull();
    expect(slide(el)!.label).toBe('Deslize para acionar');
    await slideIt(el);
    expect(calls(h)).toEqual(['switch.turn_on']);
    expect(text(el, '.state')).toBe('Feito');
  });

  it('cannot be slid while the relay does not answer, whatever the sensor says', async () => {
    const h = withState(garage('on'), 'switch.portao', 'unavailable');
    const el = await mount(h, relay);
    expect(text(el, '.state')).toBe('Sem resposta');
    expect(slide(el)!.disabled).toBe(true);
    expect(closeButton(el)).toBeNull();
  });
});

type Editor = HTMLElement & { hass: FakeHass; item: unknown; roomAreaId: string; settings: unknown; sensors: unknown; updateComplete: Promise<unknown> };

async function editor(h: FakeHass, item: Record<string, unknown>, settings: Record<string, unknown> | undefined, sensors: unknown): Promise<Editor> {
  const el = document.createElement('hubb-item-editor') as Editor;
  el.hass = h;
  el.item = item;
  el.roomAreaId = 'garagem';
  el.settings = settings;
  el.sensors = sensors;
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}

const sensorButtons = (el: Editor) => [...el.shadowRoot!.querySelectorAll('.sensor-field button.sensor')] as HTMLButtonElement[];
const pulseGate = { entityId: 'switch.portao', name: 'Portão', kind: 'gate', siblings: ['switch.portao'] };

describe('choosing the sensor of a pulse gate', () => {
  afterEach(() => {
    setEditing(false);
    (document.querySelector('hubb-room-screen')?.shadowRoot?.querySelector('hubb-toast') as HubbToast | null)?.hide();
    document.body.replaceChildren();
  });

  it('offers Nenhum and the sensors of the room, and saves the one picked', async () => {
    const h = admin(garage());
    const el = await editor(h, pulseGate, { role: 'gate' }, gateSensorCandidates(h, {}, 'garagem', 'switch.portao'));
    expect(el.shadowRoot!.querySelector('.sensor-field .label')!.textContent!.trim()).toBe('Sensor do portão');
    expect(sensorButtons(el).map((b) => b.textContent!.trim())).toEqual(['Nenhum', 'Contato do portão', 'Porta lateral', 'Sensor Portão']);
    expect(sensorButtons(el).map((b) => b.disabled)).toEqual([true, false, false, false]);
    let asked: unknown = null;
    el.addEventListener('hubb-edit', (e) => (asked = (e as CustomEvent).detail));
    sensorButtons(el)[1]!.click();
    expect(asked).toEqual({ entityId: 'switch.portao', patch: { sensor: 'binary_sensor.portao_contato' }, message: 'Portão: sensor Contato do portão.' });
  });

  it('marks the sensor in use, and Nenhum takes it away', async () => {
    const h = admin(garage());
    const settings = { role: 'gate', sensor: 'binary_sensor.portao_contato' };
    const el = await editor(h, pulseGate, settings, gateSensorCandidates(h, { entities: { 'switch.portao': settings } }, 'garagem', 'switch.portao'));
    expect(sensorButtons(el).map((b) => b.getAttribute('aria-pressed'))).toEqual(['false', 'true', 'false', 'false']);
    let asked: unknown = null;
    el.addEventListener('hubb-edit', (e) => (asked = (e as CustomEvent).detail));
    sensorButtons(el)[0]!.click();
    expect(asked).toEqual({ entityId: 'switch.portao', patch: { sensor: undefined }, message: 'Portão: sem sensor.' });
  });

  it('offers no sensor to a gate that is a cover, and says so when the room has none', async () => {
    const h = admin(garage());
    const cover = await editor(h, { entityId: 'cover.sensor_portao', name: 'Sensor Portão', kind: 'gate', siblings: ['cover.sensor_portao'] }, undefined, []);
    expect(cover.shadowRoot!.querySelector('.sensor-field')).toBeNull();
    document.body.replaceChildren();
    const bare = await editor(h, pulseGate, { role: 'gate' }, []);
    expect(sensorButtons(bare)).toEqual([]);
    expect(bare.shadowRoot!.querySelector('.sensor-field .hint')!.textContent!.trim()).toBe('Nenhum sensor de porta ou portão neste cômodo.');
  });

  it('hands the editor of the gate the sensors of its room, on the room page', async () => {
    history.replaceState(null, '', '/hubb-casa/garagem');
    const h = admin(garage());
    const options: HubbConfig = { entities: { 'switch.portao': { role: 'gate' } } };
    const house = buildHouse(h, options);
    const el = document.createElement('hubb-room-screen') as HubbRoomScreen;
    el.setConfig({ type: 'custom:hubb-room-screen', room: house.rooms.find((r) => r.areaId === 'garagem')!, lightIds: allLightIds(house), options });
    el.hass = h;
    document.body.appendChild(el);
    await el.updateComplete;
    setEditing(true);
    await flush();
    await el.updateComplete;
    const tile = [...el.shadowRoot!.querySelectorAll('.edit-tile')].find((t) => t.querySelector('.name')!.textContent === 'Portão') as HTMLElement;
    tile.click();
    await flush();
    await el.updateComplete;
    const ed = el.shadowRoot!.querySelector('hubb-item-editor') as Editor;
    await ed.updateComplete;
    expect(sensorButtons(ed).map((b) => b.textContent!.trim())).toEqual(['Nenhum', 'Contato do portão', 'Porta lateral', 'Sensor Portão']);
  });

  it('shows the gate with what its sensor says on Segurança', async () => {
    const h = garage('on');
    const house = buildHouse(h, PAIRED);
    const el = document.createElement('hubb-security-screen') as HTMLElement & { hass: FakeHass; setConfig(c: unknown): void; updateComplete: Promise<unknown> };
    el.setConfig({ type: 'custom:hubb-security-screen', security: house.security, shared: { alerts: house.alerts, security: true } });
    el.hass = h;
    document.body.appendChild(el);
    await el.updateComplete;
    const tile = [...el.shadowRoot!.querySelectorAll('hubb-access-tile')].find((t) => (t as HubbAccessTile).item?.entityId === 'switch.portao') as HubbAccessTile;
    await tile.updateComplete;
    expect(text(tile, '.state')).toBe('Aberto');
  });
});

/** A copy of `hass` with one state and its last change, as Home Assistant sends it. */
function stamped(h: FakeHass, entityId: string, state: string, lastChanged: number, attributes: Record<string, unknown> = {}): FakeHass {
  return { ...h, states: { ...h.states, [entityId]: { entity_id: entityId, state, attributes, last_changed: new Date(lastChanged).toISOString() } } };
}

describe('the review of the gate sensor', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    setEditing(false);
    (document.querySelector('hubb-room-screen')?.shadowRoot?.querySelector('hubb-toast') as HubbToast | null)?.hide();
    document.body.replaceChildren();
  });

  it('lets every card of the gate on this phone know it is on its way: none offers Fechar while it closes', async () => {
    const h = garage('on');
    const room = await mount(h, relay);
    closeButton(room)!.click();
    await later(room);
    const security = await mount(h, { ...relay, name: 'Portão · Garagem' });
    expect(text(security, '.state')).toBe('Fechando…');
    expect(closeButton(security)).toBeNull();
    expect(slide(security)!.label).toBe('Deslize para acionar');
  });

  it('sees a pulse on the relay from another phone, and keeps waiting after the relay turns off', async () => {
    const now = Date.now();
    let h = stamped(garage(), 'binary_sensor.portao_contato', 'on', now - 600_000, { device_class: 'garage_door' });
    const el = await mount(h, relay);
    expect(text(el, '.state')).toBe('Aberto');
    h = stamped(h, 'switch.portao', 'on', now);
    el.hass = h;
    await el.updateComplete;
    expect(text(el, '.state')).toBe('Fechando…');
    expect(closeButton(el)).toBeNull();
    h = stamped(h, 'switch.portao', 'off', now + 1000);
    el.hass = h;
    await later(el, 1000);
    expect(text(el, '.state')).toBe('Fechando…');
    expect(calls(h)).toEqual([]);
  });

  it('reads the last press of a button relay: pressed after the sensor last moved and less than 90 s ago, it waits', async () => {
    const now = Date.now();
    const house = (pressed: number) =>
      makeHass({
        entities: [
          { entity_id: 'button.portao', state: new Date(pressed).toISOString() },
          {
            entity_id: 'binary_sensor.portao_contato',
            state: 'on',
            attributes: { device_class: 'garage_door' },
            last_changed: new Date(now - 600_000).toISOString(),
          },
        ],
      });
    const item: AccessItem = { ...relay, entityId: 'button.portao' };
    const fresh = await mount(house(now - 20_000), item);
    expect(text(fresh, '.state')).toBe('Fechando…');
    const old = await mount(house(now - 100_000), item);
    expect(text(old, '.state')).toBe('Aberto');
  });

  it('keeps the 3 s guard when the sensor moves at once: Fechar shows disabled first', async () => {
    const h = garage();
    const el = await mount(h, relay);
    await slideIt(el);
    await later(el, 500);
    await feed(el, h, 'binary_sensor.portao_contato', 'on');
    expect(text(el, '.state')).toBe('Aberto');
    expect(closeButton(el)!.disabled).toBe(true);
    await later(el, 2600);
    expect(closeButton(el)!.disabled).toBe(false);
  });

  it('catches up when it comes back to the screen: a view switch drops its timers', async () => {
    const h = garage();
    const el = await mount(h, relay);
    await slideIt(el);
    el.remove();
    await vi.advanceTimersByTimeAsync(96_000);
    document.body.appendChild(el);
    await el.updateComplete;
    expect(text(el, '.state')).toBe('Fechado');
    expect(slide(el)!.label).toBe('Deslize para abrir');
    expect(slide(el)!.disabled).toBe(false);
  });

  it('looks disabled when Fechar is disabled', () => {
    const styles = (customElements.get('hubb-access-tile') as unknown as { styles: unknown }).styles;
    const css = ([] as unknown[])
      .concat(styles)
      .map((s) => (s as { cssText: string }).cssText)
      .join('\n');
    expect(css).toMatch(/\.close\[disabled\]\s*\{[^}]*opacity: 0\.45/);
  });

  it('checks the sensor again when Fechar is tapped: a gate that just closed gets no pulse', async () => {
    const h = garage('on');
    const el = await mount(h, relay);
    const button = closeButton(el)!;
    el.hass = withState(h, 'binary_sensor.portao_contato', 'off');
    button.click();
    await later(el);
    expect(calls(h)).toEqual([]);
  });

  it('never pulses a closed gate with a sensor on a tap', async () => {
    const h = garage();
    const el = await mount(h, relay);
    for (const target of [el.shadowRoot!.querySelector('.card'), el.shadowRoot!.querySelector('.head'), el.shadowRoot!.querySelector('.state'), slide(el)]) {
      (target as HTMLElement).click();
    }
    await later(el);
    expect(calls(h)).toEqual([]);
  });

  it('keeps Fechar disabled while a bare pulse is on its way', async () => {
    let h = garage('unavailable');
    h.callService = vi.fn(() => new Promise<unknown>(() => undefined));
    const el = await mount(h, relay);
    await slideIt(el);
    h = await feed(el, h, 'binary_sensor.portao_contato', 'on');
    await later(el, 5000);
    expect(closeButton(el)!.disabled).toBe(true);
  });

  it('takes as the sensor in the YAML only a door contact or a gate, and reports a role it refused', () => {
    const h = makeHass({
      areas: [area('garagem', 'Garagem')],
      entities: [
        { entity_id: 'switch.portao', area_id: 'garagem', name: 'Portão', state: 'off' },
        { entity_id: 'binary_sensor.movimento', area_id: 'garagem', state: 'off', attributes: { device_class: 'motion' } },
        { entity_id: 'binary_sensor.entrada_1', area_id: 'garagem', state: 'off' },
        { entity_id: 'cover.cortina', area_id: 'garagem', name: 'Cortina', state: 'closed', attributes: { device_class: 'curtain' } },
        { entity_id: 'binary_sensor.contato', area_id: 'garagem', state: 'off', attributes: { device_class: 'garage_door' } },
        { entity_id: 'light.luz', area_id: 'garagem', state: 'off' },
      ],
    });
    for (const sensor of ['binary_sensor.movimento', 'binary_sensor.entrada_1', 'cover.cortina']) {
      const r = readConfig(h, { entities: { 'switch.portao': { role: 'gate', sensor } } });
      expect(r.problems.map((p) => p.message)).toEqual([`sensor: ${sensor} não é um sensor de porta nem um portão.`]);
    }
    const refused = readConfig(h, { entities: { 'light.luz': { role: 'gate', sensor: 'binary_sensor.contato' } } });
    expect(refused.problems.map((p) => p.key)).toEqual(['entities.light.luz.role', 'entities.light.luz.sensor']);
    expect(refused.problems[1]!.message).toBe('sensor só vale para um portão por pulso (role: gate num switch, button, input_button ou script).');
  });

  it('drops a cover used as the sensor from Acesso for everyone, even whoever cannot see the gate', () => {
    const lia = { id: 'u_lia', name: 'Lia', is_admin: false };
    const house = buildHouse(garage('off', lia), { entities: { 'switch.portao': { role: 'gate', sensor: 'cover.sensor_portao', hidden_for: ['u_lia'] } } });
    expect(house.rooms.flatMap((r) => r.access.map((a) => a.entityId))).toEqual([]);
    expect(house.security.access).toEqual([]);
  });

  it('leaves a contact of another room in the Sensores of its own room', () => {
    const house = buildHouse(garage(), { entities: { 'switch.portao': { role: 'gate', sensor: 'binary_sensor.porta_sala' } } });
    expect(house.rooms.find((r) => r.areaId === 'garagem')!.access[0]!.sensor).toBe('binary_sensor.porta_sala');
    const sala = [...house.rooms, ...house.sensorRooms].find((r) => r.areaId === 'sala')!;
    expect(sala.sensors.map((s) => [s.entityId, s.pairedWith])).toEqual([['binary_sensor.porta_sala', undefined]]);
  });

  it('marks the contact of the gate in its room, and shows it in Sensores only in the edit mode', async () => {
    history.replaceState(null, '', '/hubb-casa/garagem');
    const h = admin(garage());
    const house = buildHouse(h, PAIRED);
    const room = house.rooms.find((r) => r.areaId === 'garagem')!;
    expect(room.sensors.find((s) => s.entityId === 'binary_sensor.portao_contato')?.pairedWith).toBe('switch.portao');
    const el = document.createElement('hubb-room-screen') as HubbRoomScreen;
    el.setConfig({ type: 'custom:hubb-room-screen', room, lightIds: allLightIds(house), options: PAIRED });
    el.hass = h;
    document.body.appendChild(el);
    await el.updateComplete;
    const shown = () => [...el.shadowRoot!.querySelectorAll('hubb-sensor-tile')].map((t) => (t as unknown as { item: { entityId: string } }).item.entityId);
    expect(shown()).toContain('binary_sensor.porta_lateral');
    expect(shown()).not.toContain('binary_sensor.portao_contato');
    setEditing(true);
    await vi.advanceTimersByTimeAsync(0);
    await el.updateComplete;
    const tiles = [...el.shadowRoot!.querySelectorAll('.edit-tile .name')].map((n) => n.textContent);
    expect(tiles).toContain('Contato do portão');
  });

  it('clears the sensor when the gate stops being a gate, so Revisar has nothing it cannot fix', async () => {
    const h = admin(garage());
    const el = await editor(h, pulseGate, { role: 'gate', sensor: 'binary_sensor.portao_contato' }, gateSensorCandidates(h, PAIRED, 'garagem', 'switch.portao'));
    let asked: unknown = null;
    el.addEventListener('hubb-edit', (e) => (asked = (e as CustomEvent).detail));
    const hide = [...el.shadowRoot!.querySelectorAll('button.role')].find((b) => b.textContent!.trim() === 'Não mostrar') as HTMLButtonElement;
    hide.click();
    expect(asked).toMatchObject({ patch: { role: 'hidden', sensor: undefined } });
    expect(Object.keys((asked as { patch: object }).patch)).toContain('sensor');
  });

  it('shows a sensor the YAML names that no longer exists, by its id, as the one in use', async () => {
    const h = admin(garage());
    const el = await editor(h, pulseGate, { role: 'gate', sensor: 'binary_sensor.nada' }, gateSensorCandidates(h, {}, 'garagem', 'switch.portao'));
    const buttons = sensorButtons(el);
    expect(buttons.map((b) => b.textContent!.trim())).toEqual(['Nenhum', 'binary_sensor.nada (não existe)', 'Contato do portão', 'Porta lateral', 'Sensor Portão']);
    expect(buttons.map((b) => b.disabled)).toEqual([false, true, false, false, false]);
  });

  it('asks the installer to check the sensor before relying on Fechar', async () => {
    const h = admin(garage());
    const el = await editor(h, pulseGate, { role: 'gate' }, gateSensorCandidates(h, {}, 'garagem', 'switch.portao'));
    expect(el.shadowRoot!.querySelector('.sensor-field .hint')!.textContent!.trim()).toBe(
      'Com um sensor, o card mostra Aberto ou Fechado e fecha o portão com um toque. Confira se ele diz Aberto com o portão aberto.',
    );
  });
});

describe('the second review of the gate sensor', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    document.body.replaceChildren();
  });

  it('does not give its own bare pulse a direction when the relay shows it', async () => {
    const now = Date.now();
    let h = stamped(garage(), 'binary_sensor.portao_contato', 'on', now - 600_000, { device_class: 'garage_door' });
    const el = await mount(h, relay);
    closeButton(el)!.click();
    await later(el, 3100);
    expect(text(el, '.state')).toBe('Fechando…');
    await slideIt(el);
    h = stamped(h, 'switch.portao', 'on', Date.now());
    el.hass = h;
    await el.updateComplete;
    expect(text(el, '.state')).toBe('Feito');
    h = stamped(h, 'switch.portao', 'off', Date.now() + 1000);
    el.hass = h;
    await later(el, 60_000);
    expect(text(el, '.state')).toBe('Aberto');
    expect(closeButton(el)).toBeNull();
    expect(slide(el)!.label).toBe('Deslize para acionar');
  });

  it('does not read its own open pulse as a close when the relay reports after the contact flipped', async () => {
    const now = Date.now();
    let h = stamped(garage(), 'binary_sensor.portao_contato', 'off', now - 600_000, { device_class: 'garage_door' });
    const el = await mount(h, relay);
    await slideIt(el);
    h = stamped(h, 'binary_sensor.portao_contato', 'on', now + 1000, { device_class: 'garage_door' });
    el.hass = h;
    await later(el, 1000);
    h = stamped(h, 'switch.portao', 'on', now + 2000);
    el.hass = h;
    await later(el, 1000);
    expect(text(el, '.state')).toBe('Aberto');
  });

  it('reads the relay again when its pulse fails after it fired, and waits', async () => {
    const now = Date.now();
    let h = stamped(garage(), 'binary_sensor.portao_contato', 'on', now - 600_000, { device_class: 'garage_door' });
    let fail: (e: Error) => void = () => undefined;
    h.callService = vi.fn(() => new Promise<unknown>((_, reject) => (fail = reject)));
    const el = await mount(h, relay);
    closeButton(el)!.click();
    await later(el);
    h = stamped(h, 'switch.portao', 'on', now);
    el.hass = h;
    await el.updateComplete;
    fail(new Error('timeout'));
    await later(el, 2100);
    el.hass = stamped(h, 'switch.portao', 'on', now);
    await later(el, 1000);
    expect(text(el, '.state')).toBe('Fechando…');
    expect(closeButton(el)).toBeNull();
  });

  it('sees a switch pulse that already ended, by when the relay turned off', async () => {
    const now = Date.now();
    const house = (sensorAt: number, relayOffAt: number) =>
      makeHass({
        entities: [
          { entity_id: 'switch.portao', state: 'off', last_changed: new Date(relayOffAt).toISOString() },
          { entity_id: 'binary_sensor.portao_contato', state: 'on', attributes: { device_class: 'garage_door' }, last_changed: new Date(sensorAt).toISOString() },
        ],
      });
    // Another phone closed it 4 s ago: the relay is off again, the contact still open.
    const late = await mount(house(now - 600_000, now - 3000), relay);
    expect(text(late, '.state')).toBe('Fechando…');
    expect(closeButton(late)).toBeNull();
    // An open pulse whose contact flipped while the relay was still on, and a restart that stamped both at once.
    const opened = await mount(house(now - 3500, now - 3000), relay);
    expect(text(opened, '.state')).toBe('Aberto');
    const restart = await mount(house(now - 3000, now - 3000), relay);
    expect(text(restart, '.state')).toBe('Aberto');
  });

  it('keeps the wait of one house to that house', async () => {
    const one = garage('on');
    const other = garage('on');
    const a = await mount(one, relay);
    closeButton(a)!.click();
    await later(a);
    const b = await mount(other, relay);
    expect(text(b, '.state')).toBe('Aberto');
    expect(closeButton(b)).not.toBeNull();
  });
});
