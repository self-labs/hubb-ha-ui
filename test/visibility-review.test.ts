import { afterEach, describe, expect, it, vi } from 'vitest';
import '../src/cards/redirect-card';
import { setEditing } from '../src/editing';
import '../src/elements/item-editor';
import '../src/elements/people-picker';
import { buildHouse } from '../src/model/build-house';
import { classify, classifyContext } from '../src/model/classify';
import { readConfig } from '../src/model/config';
import type { HubbConfig } from '../src/model/types';
import '../src/screens/home-screen';
import type { HubbHomeScreen } from '../src/screens/home-screen';
import { generateDashboard } from '../src/strategy/generate';
import { sampleHouseHass } from './fixtures/sample-house';
import { admin, flush, USERS, withDashboard, withUsers } from './helpers/fake-dashboard';
import { area, device, makeHass, type FakeEntity, type FakeHass } from './helpers/fake-hass';

const LIA = 'u_lia';

function house(isAdmin: boolean, extra: FakeEntity[] = []): FakeHass {
  return makeHass({
    user: isAdmin ? { id: 'u_gustavo', name: 'Gustavo', is_admin: true } : { id: LIA, name: 'Lia', is_admin: false },
    areas: [area('kitnet', 'Kitnet'), area('sala', 'Sala')],
    entities: [
      { entity_id: 'light.sala', area_id: 'sala', name: 'Teto', state: 'on' },
      { entity_id: 'light.kitnet', area_id: 'kitnet', name: 'Teto', state: 'on' },
      { entity_id: 'binary_sensor.kitnet_fumaca', area_id: 'kitnet', name: 'Fumaça', state: 'on', attributes: { device_class: 'smoke' } },
      ...extra,
    ],
  });
}
const kitnetHidden: HubbConfig = { rooms: { kitnet: { hidden_for: [LIA] } } };
const areaViews = (config: HubbConfig, h: FakeHass) => {
  const views = generateDashboard(config, h).views;
  return views.slice(views.findIndex((v) => v.path === 'seguranca') + 1).filter((v) => v.path !== 'revisar' && v.path !== 'midia');
};

describe('the final review of who sees what', () => {
  afterEach(() => {
    setEditing(false);
    vi.useRealTimers();
    document.body.replaceChildren();
  });

  it('keeps one view per area for a resident, so an open page never jumps to another room when a room is hidden', () => {
    const resident = areaViews(kitnetHidden, house(false));
    const installer = areaViews(kitnetHidden, house(true));
    expect(resident.length).toBe(installer.length);
    expect(resident.map((v) => v.path)).toEqual(['vazio-1', 'sala']);
    expect([resident[0]!.title, resident[0]!.cards[0]!.type]).toEqual(['', 'custom:hubb-redirect-card']);
  });

  it('sends a resident who lands on a room that is gone for them back home', async () => {
    history.replaceState(null, '', '/hubb-casa/vazio-1');
    const card = document.createElement('hubb-redirect-card') as HTMLElement & { setConfig(c: unknown): void };
    card.setConfig({ type: 'custom:hubb-redirect-card' });
    document.body.appendChild(card);
    expect(location.pathname).toBe('/hubb-casa/home');
  });

  it('never takes a relay or an outlet of a board that also drives an air conditioner as one of its functions', () => {
    const h = makeHass({
      user: { id: 'u_gustavo', name: 'Gustavo', is_admin: true },
      areas: [area('sala', 'Sala')],
      devices: [device('d_placa', 'sala', 'Placa da sala'), device('d_ar2', null, 'Ar sem cômodo')],
      entities: [
        { entity_id: 'climate.ar_ir', device_id: 'd_placa', state: 'off', platform: 'esphome', attributes: { hvac_modes: ['off', 'cool'] } },
        { entity_id: 'switch.rele_1', device_id: 'd_placa', state: 'off', platform: 'esphome', attributes: { device_class: 'outlet' } },
        { entity_id: 'switch.rele_2', device_id: 'd_placa', state: 'off', platform: 'esphome' },
        { entity_id: 'climate.ar2', device_id: 'd_ar2', state: 'off', platform: 'lg_thinq', attributes: { hvac_modes: ['off', 'cool'] } },
        { entity_id: 'switch.ar2_luz', device_id: 'd_ar2', area_id: 'sala', state: 'off', platform: 'lg_thinq' },
      ],
    });
    const ctx = classifyContext(h, readConfig(h, {}));
    expect(['switch.rele_1', 'switch.rele_2', 'switch.ar2_luz'].map((id) => classify(h, id, ctx)).map((p) => (p.block ? p.block : p.why))).toEqual([
      'outlet',
      'review',
      'review',
    ]);
    expect(buildHouse(h, {}).rooms[0]!.climate[0]!.extras).toEqual([]);
  });

  it('leaves out of Mais ajustes a function hide_entities dismissed', () => {
    const h = makeHass({
      areas: [area('sala', 'Sala')],
      devices: [device('d_ar', 'sala', 'Ar')],
      entities: [
        { entity_id: 'climate.ar', device_id: 'd_ar', state: 'off', platform: 'lg_thinq', attributes: { hvac_modes: ['off', 'cool'] } },
        { entity_id: 'switch.ar_luz', device_id: 'd_ar', state: 'on', platform: 'lg_thinq', entity_category: 'config', attributes: { friendly_name: 'Ar Iluminação' } },
      ],
    });
    expect(buildHouse(h, { hide_entities: ['switch.ar_luz'] }).rooms[0]!.climate[0]!.extras).toEqual([]);
  });

  it('keeps the alarm, its card and its alert, for a resident who does not see the room it hangs in', () => {
    const h = house(false, [{ entity_id: 'alarm_control_panel.casa', area_id: 'kitnet', name: 'Alarme', state: 'triggered' }]);
    const built = buildHouse(h, kitnetHidden);
    expect(built.security.alarms.map((a) => a.entityId)).toEqual(['alarm_control_panel.casa']);
    expect(built.alerts.map((a) => a.kind)).toContain('alarm');
  });

  it('leads a danger alert to the security tab when its room has no page for the resident', () => {
    const emptied: HubbConfig = { entities: { 'light.kitnet': { hidden_for: [LIA] } } };
    const h = house(false, [{ entity_id: 'switch.kitnet_velha', area_id: 'kitnet', name: 'Velha', state: 'off' }]);
    const config: HubbConfig = { ...emptied, entities: { ...emptied.entities, 'switch.kitnet_velha': { role: 'hidden' } } };
    expect(buildHouse(h, config).alerts).toEqual([{ entityId: 'binary_sensor.kitnet_fumaca', kind: 'smoke', name: 'Fumaça', roomName: 'Kitnet', path: null }]);
    // A role:hidden item there gives the installer a page, never the resident.
    expect(areaViews(config, h).map((v) => v.path)).toEqual(['vazio-1', 'sala']);
  });

  it('does not name a hidden room in the description of a scene of the whole house', () => {
    const h = house(false, [
      { entity_id: 'scene.tudo', name: 'Tudo', state: 'scening', labels: ['hubb_cena'], attributes: { entity_id: ['light.sala', 'light.kitnet'] } },
    ]);
    expect(buildHouse(h, kitnetHidden).scenes.map((s) => s.description)).toEqual(['Sala']);
  });

  it('reads a hidden_for written as text in the YAML as no list, and never breaks the picker with it', async () => {
    const h = admin(makeHass({ areas: [area('sala', 'Sala')], entities: [{ entity_id: 'light.abajur', area_id: 'sala', name: 'Abajur', state: 'off' }] }));
    withUsers(h, USERS);
    const el = document.createElement('hubb-item-editor') as HTMLElement & { hass: FakeHass; item: unknown; roomAreaId: string; settings: unknown; updateComplete: Promise<unknown> };
    el.hass = h;
    el.item = { entityId: 'light.abajur', name: 'Abajur', kind: 'light', siblings: ['light.abajur'] };
    el.roomAreaId = 'sala';
    el.settings = { hidden_for: 'u_lia' };
    document.body.appendChild(el);
    await el.updateComplete;
    const picker = el.shadowRoot!.querySelector('hubb-people-picker') as HTMLElement & { updateComplete: Promise<unknown> };
    await flush();
    await picker.updateComplete;
    let asked: unknown = null;
    el.addEventListener('hubb-edit', (e) => (asked = (e as CustomEvent).detail));
    (picker.shadowRoot!.querySelectorAll('.person')[0] as HTMLButtonElement).click();
    expect(asked).toMatchObject({ patch: { hidden_for: ['u_ana'] } });
  });

  it('tags only the people the filter applies to: an administrator listed sees everything anyway', async () => {
    const h = admin(makeHass({}));
    withUsers(h, USERS);
    const tag = document.createElement('hubb-hidden-tag') as HTMLElement & { hass: FakeHass; ids: string[]; updateComplete: Promise<unknown> };
    tag.hass = h;
    tag.ids = ['u_gustavo', 'u_lia'];
    document.body.appendChild(tag);
    await flush();
    await tag.updateComplete;
    expect(tag.shadowRoot!.textContent!.trim()).toBe('Oculto para Lia');
  });

  it('says it could not read the users, and tries again on the next picker', async () => {
    const h = admin(makeHass({}));
    let calls = 0;
    h.callWS = (async (msg: Record<string, unknown>) => {
      if (msg.type !== 'config/auth/list') throw new Error('unexpected');
      calls += 1;
      if (calls === 1) throw new Error('timeout');
      return structuredClone(USERS);
    }) as FakeHass['callWS'];
    const mount = async () => {
      const el = document.createElement('hubb-people-picker') as HTMLElement & { hass: FakeHass; hiddenFor: string[]; updateComplete: Promise<unknown> };
      el.hass = h;
      el.hiddenFor = [];
      document.body.appendChild(el);
      await flush();
      await el.updateComplete;
      return el;
    };
    const first = await mount();
    expect(first.shadowRoot!.querySelector('.hint')!.textContent!.trim()).toBe('Não deu para ler os usuários do Home Assistant. Feche e abra de novo.');
    const second = await mount();
    expect([...second.shadowRoot!.querySelectorAll('.person')].map((b) => b.textContent!.trim())).toEqual(['Ana', 'Lia']);
  });

  it('closes the people of a room when the save fails, so the notice can be read', async () => {
    history.replaceState(null, '', '/hubb-casa/home');
    const h = admin(sampleHouseHass());
    withDashboard(h, { strategy: { type: 'custom:hubb' } }, true);
    withUsers(h, USERS);
    setEditing(true);
    const el = document.createElement('hubb-home-screen') as HubbHomeScreen;
    el.setConfig({ type: 'custom:hubb-home-screen', house: buildHouse(h, {}), options: {} });
    el.hass = h;
    document.body.appendChild(el);
    await flush();
    await el.updateComplete;
    const room = [...el.shadowRoot!.querySelectorAll('.room-edit')].find((r) => r.getAttribute('data-name') === 'Cozinha')!;
    (room.querySelector('.tool.people') as HTMLButtonElement).click();
    await el.updateComplete;
    const picker = el.shadowRoot!.querySelector('hubb-sheet.people hubb-people-picker')!;
    await flush();
    await (picker as unknown as { updateComplete: Promise<unknown> }).updateComplete;
    (picker.shadowRoot!.querySelectorAll('.person')[1] as HTMLButtonElement).click();
    await flush();
    await flush();
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('hubb-sheet.people')!.hasAttribute('open')).toBe(false);
  });
});
