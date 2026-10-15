import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setEditing } from '../src/editing';
import '../src/elements/nav-bar';
import '../src/elements/status-strips';
import type { HubbToast } from '../src/elements/toast';
import { buildHouse } from '../src/model/build-house';
import { readConfig } from '../src/model/config';
import type { HubbConfig } from '../src/model/types';
import { staleEntries } from '../src/model/visibility';
import '../src/screens/review-screen';
import '../src/screens/scenes-screen';
import '../src/screens/security-screen';
import { generateDashboard } from '../src/strategy/generate';
import { admin, flush, USERS, withDashboard, withUsers } from './helpers/fake-dashboard';
import { area, makeHass, type FakeHass } from './helpers/fake-hass';

const LIA = 'u_lia';

function casa(isAdmin: boolean): FakeHass {
  return makeHass({
    user: isAdmin ? { id: 'u_gustavo', name: 'Gustavo', is_admin: true } : { id: LIA, name: 'Lia', is_admin: false },
    areas: [area('entrada', 'Entrada'), area('sala', 'Sala')],
    entities: [
      { entity_id: 'light.sala', area_id: 'sala', name: 'Teto', state: 'off' },
      { entity_id: 'scene.noite', area_id: 'sala', name: 'Noite', state: 'scening', labels: ['hubb_cena'] },
      { entity_id: 'script.tv', name: 'TV', state: 'off' },
      { entity_id: 'script.jbl', name: 'JBL', state: 'off' },
      { entity_id: 'script.botao', area_id: 'sala', name: 'Botão', state: 'off' },
      { entity_id: 'script.escondido', name: 'Escondido', state: 'off', hidden: true },
      { entity_id: 'alarm_control_panel.alarme', name: 'Alarme', state: 'disarmed' },
      { entity_id: 'camera.sala', area_id: 'sala', name: 'Câmera', state: 'idle' },
      { entity_id: 'cover.portao', area_id: 'entrada', name: 'Portão', state: 'closed', attributes: { device_class: 'gate' } },
      { entity_id: 'binary_sensor.porta', area_id: 'entrada', name: 'Porta', state: 'off', attributes: { device_class: 'door' } },
    ],
  });
}
const resident = () => casa(false);
const installer = () => casa(true);
const sharedOf = (config: HubbConfig, h: FakeHass) => (generateDashboard(config, h).views[0]!.cards[0] as unknown as { shared: { scenes: boolean; security: boolean } }).shared;
const viewCard = (config: HubbConfig, h: FakeHass, path: string) => generateDashboard(config, h).views.find((v) => v.path === path)!.cards[0]!;

describe('the tabs and the scenes, person by person', () => {
  it('puts a script in Cenas by the panel role, with or without a room', () => {
    const built = buildHouse(installer(), { entities: { 'script.tv': { role: 'scene' } } });
    expect(built.scenes.map((s) => s.entityId).sort()).toEqual(['scene.noite', 'script.tv']);
    expect(readConfig(installer(), { entities: { 'light.sala': { role: 'scene' } } }).problems.map((p) => p.key)).toEqual(['entities.light.sala.role']);
  });

  it('offers the installer the scenes and scripts not in Cenas yet, and no one else', () => {
    const config = { entities: { 'script.botao': { role: 'action' } } };
    expect(buildHouse(installer(), config).sceneCandidates.map((c) => [c.entityId, c.name])).toEqual([
      ['script.jbl', 'JBL'],
      ['script.tv', 'TV'],
    ]);
    expect(buildHouse(resident(), config).sceneCandidates).toEqual([]);
  });

  it('takes Cenas away from a resident it is hidden for: the tab, and the scenes on the home and in the rooms', () => {
    const config: HubbConfig = { tabs: { scenes: { hidden_for: [LIA] } } };
    const built = buildHouse(resident(), config);
    expect(built.scenes).toEqual([]);
    expect(built.rooms.flatMap((r) => r.scenes)).toEqual([]);
    expect(sharedOf(config, resident()).scenes).toBe(false);
    expect(viewCard(config, resident(), 'scenes').type).toBe('custom:hubb-redirect-card');
    expect(buildHouse(installer(), config).scenes.length).toBe(1);
  });

  it('takes Segurança away from a resident it is hidden for; the gate and the door stay in their room, the alarm still warns', () => {
    const config: HubbConfig = { tabs: { security: { hidden_for: [LIA] } } };
    const built = buildHouse(resident(), config);
    expect(built.security).toEqual({ alarms: [], cameras: [], openings: [], access: [] });
    const entrada = built.rooms.find((r) => r.areaId === 'entrada')!;
    expect([entrada.access.length, entrada.sensors.length]).toEqual([1, 1]);
    expect(built.alerts.map((a) => a.kind)).toEqual(['alarm']);
    expect(sharedOf(config, resident()).security).toBe(false);
    expect(viewCard(config, resident(), 'seguranca').type).toBe('custom:hubb-redirect-card');
  });

  it('hides the alarm card from a resident it is hidden for, and still warns them when it goes off (decision B)', () => {
    const built = buildHouse(resident(), { entities: { 'alarm_control_panel.alarme': { hidden_for: [LIA] } } });
    expect(built.security.alarms).toEqual([]);
    expect(built.alerts.map((a) => a.entityId)).toContain('alarm_control_panel.alarme');
  });

  it('hides Cenas from a resident with no scene to see, never from the installer', () => {
    const config: HubbConfig = { entities: { 'scene.noite': { hidden_for: [LIA] } } };
    expect(sharedOf(config, resident()).scenes).toBe(false);
    expect(sharedOf(config, installer()).scenes).toBe(true);
  });

  it('says what is wrong with tabs in the YAML', () => {
    const r = readConfig(installer(), { tabs: { cenas: {}, security: { hidden_for: 'x' } } } as unknown as HubbConfig);
    expect(r.problems.map((p) => [p.key, p.message])).toEqual([
      ['tabs.cenas', 'tabs: cenas não existe. Use scenes ou security.'],
      ['tabs.security.hidden_for', 'hidden_for precisa ser uma lista, por exemplo [id do usuário].'],
    ]);
    expect(readConfig(installer(), { tabs: 'x' } as unknown as HubbConfig).problems.map((p) => p.key)).toEqual(['tabs']);
  });

  it('finds people who no longer exist in the tabs too', () => {
    expect(staleEntries({ tabs: { scenes: { hidden_for: ['u_saiu', LIA] } } }, new Set([LIA]))).toEqual([{ section: 'tabs', key: 'scenes', keep: [LIA] }]);
  });
});

describe('the bar and the strip of a resident without a tab', () => {
  afterEach(() => document.body.replaceChildren());

  it('leaves Cenas out of the bar when the resident has no scene', async () => {
    const nav = document.createElement('hubb-nav-bar') as HTMLElement & { scenes: boolean; updateComplete: Promise<unknown> };
    nav.scenes = false;
    document.body.appendChild(nav);
    await nav.updateComplete;
    expect([...nav.shadowRoot!.querySelectorAll('button')].map((b) => b.textContent!.trim())).toEqual(['Casa']);
  });

  it('shows the alarm going off without leading to a security tab the resident does not have', async () => {
    const h = resident();
    h.states['alarm_control_panel.alarme'] = { ...h.states['alarm_control_panel.alarme']!, state: 'triggered' };
    const strips = document.createElement('hubb-status-strips') as HTMLElement & { hass: FakeHass; alerts: unknown; security: boolean; updateComplete: Promise<unknown> };
    strips.hass = h;
    strips.alerts = [{ entityId: 'alarm_control_panel.alarme', kind: 'alarm', roomName: null, path: null }];
    strips.security = false;
    document.body.appendChild(strips);
    await strips.updateComplete;
    expect(strips.shadowRoot!.querySelector('[role="alert"]')!.textContent).toContain('Alarme');
    expect(strips.shadowRoot!.querySelector('button.alert')).toBeNull();
  });
});

describe('the installer chooses who sees the tabs and what is in them', () => {
  beforeEach(() => history.replaceState(null, '', '/hubb-casa/scenes'));
  afterEach(() => {
    setEditing(false);
    for (const el of document.querySelectorAll('hubb-scenes-screen, hubb-security-screen')) (el.shadowRoot?.querySelector('hubb-toast') as HubbToast | null)?.hide();
    document.body.replaceChildren();
  });

  async function screen(tag: 'hubb-scenes-screen' | 'hubb-security-screen', options: HubbConfig) {
    const h = admin(installer());
    const saves = withDashboard(h, { strategy: { type: 'custom:hubb', ...options } });
    withUsers(h, USERS);
    const built = buildHouse(h, options);
    const el = document.createElement(tag) as HTMLElement & { hass: FakeHass; setConfig(c: unknown): void; updateComplete: Promise<unknown> };
    el.setConfig(
      tag === 'hubb-scenes-screen'
        ? { type: 'custom:hubb-scenes-screen', scenes: built.scenes, lightIds: [], options, candidates: built.sceneCandidates }
        : { type: 'custom:hubb-security-screen', security: built.security, options },
    );
    el.hass = h;
    document.body.appendChild(el);
    await flush();
    await el.updateComplete;
    return { el, saves };
  }

  async function pick(el: HTMLElement & { updateComplete: Promise<unknown> }, opener: string, person: number) {
    (el.shadowRoot!.querySelector(opener) as HTMLButtonElement).click();
    await el.updateComplete;
    const sheet = el.shadowRoot!.querySelector('hubb-sheet.people')!;
    const picker = sheet.querySelector('hubb-people-picker') as HTMLElement & { updateComplete: Promise<unknown> };
    await flush();
    await picker.updateComplete;
    (picker.shadowRoot!.querySelectorAll('.person')[person] as HTMLButtonElement).click();
    await flush();
    await flush();
    return sheet;
  }

  it('on Cenas: who sees the tab, who sees a scene, Não mostrar, and Adicionar cena', async () => {
    setEditing(true);
    const { el, saves } = await screen('hubb-scenes-screen', {});
    const sheet = await pick(el, '.tab-people', 1);
    expect(sheet.getAttribute('heading')).toBe('Quem vê esta aba');
    expect(saves.at(-1)).toMatchObject({ tabs: { scenes: { hidden_for: [LIA] } } });
    await pick(el, '.scene-tools .people', 1);
    expect(saves.at(-1)).toMatchObject({ entities: { 'scene.noite': { hidden_for: [LIA] } } });
    (el.shadowRoot!.querySelector('.scene-tools .hide') as HTMLButtonElement).click();
    await flush();
    await flush();
    expect(saves.at(-1)).toMatchObject({ entities: { 'scene.noite': { role: 'hidden' } } });
    expect([...el.shadowRoot!.querySelectorAll('.candidates li strong')].map((s) => s.textContent)).toEqual(['Botão', 'JBL', 'TV']);
    // A scene and a script often share a name: each says what it is.
    expect(el.shadowRoot!.querySelector('.candidates li .what span')!.textContent).toBe('Script');
    (el.shadowRoot!.querySelectorAll('.candidates .add')[1] as HTMLButtonElement).click();
    await flush();
    await flush();
    expect(saves.at(-1)).toMatchObject({ entities: { 'script.jbl': { role: 'scene' } } });
  });

  it('on Segurança: who sees the tab and who sees the alarm', async () => {
    setEditing(true);
    const { el, saves } = await screen('hubb-security-screen', {});
    await pick(el, '.tab-people', 1);
    expect(saves.at(-1)).toMatchObject({ tabs: { security: { hidden_for: [LIA] } } });
    await pick(el, '.alarm-tools .people', 1);
    expect(saves.at(-1)).toMatchObject({ entities: { 'alarm_control_panel.alarme': { hidden_for: [LIA] } } });
    expect(el.shadowRoot!.querySelector('.camera-tools .people')).not.toBeNull();
  });

  it('names a tab with people who no longer exist on the review', async () => {
    history.replaceState(null, '', '/hubb-casa/revisar');
    const h = admin(installer());
    const options: HubbConfig = { type: 'custom:hubb', tabs: { scenes: { hidden_for: ['u_saiu'] } } };
    withDashboard(h, { strategy: options });
    withUsers(h, USERS);
    const el = document.createElement('hubb-review-screen') as HTMLElement & { hass: FakeHass; setConfig(c: unknown): void; updateComplete: Promise<unknown> };
    el.setConfig({ type: 'custom:hubb-review-screen', options });
    el.hass = h;
    document.body.appendChild(el);
    await flush();
    await el.updateComplete;
    const names = [...el.shadowRoot!.querySelectorAll('li.item strong')].map((s) => s.textContent);
    expect(names).toContain('Aba Cenas');
  });
});
