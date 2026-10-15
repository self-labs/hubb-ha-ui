import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setEntity } from '../src/actions/dashboard-config';
import { setEditing } from '../src/editing';
import '../src/elements/item-editor';
import '../src/elements/status-strips';
import type { HubbToast } from '../src/elements/toast';
import { buildHouse } from '../src/model/build-house';
import type { HubbConfig } from '../src/model/types';
import { staleEntries } from '../src/model/visibility';
import '../src/screens/scenes-screen';
import '../src/screens/security-screen';
import { S } from '../src/strings';
import { generateDashboard } from '../src/strategy/generate';
import { admin, flush, USERS, withDashboard, withUsers } from './helpers/fake-dashboard';
import { area, makeHass, type FakeEntity, type FakeHass } from './helpers/fake-hass';

const LIA = 'u_lia';

function casa(isAdmin: boolean, extra: FakeEntity[] = []): FakeHass {
  return makeHass({
    user: isAdmin ? { id: 'u_gustavo', name: 'Gustavo', is_admin: true } : { id: LIA, name: 'Lia', is_admin: false },
    areas: [area('entrada', 'Entrada'), area('sala', 'Sala')],
    entities: [
      { entity_id: 'light.sala', area_id: 'sala', name: 'Teto', state: 'off' },
      { entity_id: 'scene.noite', area_id: 'sala', name: 'Noite', state: 'scening', labels: ['hubb_cena'] },
      { entity_id: 'script.tv', name: 'TV', state: 'off' },
      { entity_id: 'script.botao', area_id: 'sala', name: 'Botão', state: 'off' },
      { entity_id: 'alarm_control_panel.alarme', name: 'Alarme', state: 'disarmed' },
      { entity_id: 'binary_sensor.sala_fumaca', area_id: 'sala', name: 'Fumaça', state: 'on', attributes: { device_class: 'smoke' } },
      { entity_id: 'cover.portao', area_id: 'entrada', name: 'Portão', state: 'closed', attributes: { device_class: 'gate' } },
      ...extra,
    ],
  });
}

type Screen = HTMLElement & { hass: FakeHass; setConfig(c: unknown): void; updateComplete: Promise<unknown> };

async function screen(tag: 'hubb-scenes-screen' | 'hubb-security-screen', options: HubbConfig, extra: FakeEntity[] = []) {
  const h = admin(casa(true, extra));
  const saves = withDashboard(h, { strategy: { type: 'custom:hubb', ...options } });
  withUsers(h, USERS);
  const built = buildHouse(h, options);
  const el = document.createElement(tag) as Screen;
  el.setConfig(
    tag === 'hubb-scenes-screen'
      ? { type: tag, scenes: built.scenes, lightIds: [], options, candidates: built.sceneCandidates }
      : { type: tag, security: built.security, options },
  );
  el.hass = h;
  document.body.appendChild(el);
  await flush();
  await el.updateComplete;
  return { el, saves, h };
}

const settle = async (el: Screen) => {
  await flush();
  await flush();
  await el.updateComplete;
};

describe('the review of the tabs and the scenes', () => {
  beforeEach(() => history.replaceState(null, '', '/hubb-casa/scenes'));
  afterEach(() => {
    setEditing(false);
    for (const el of document.querySelectorAll('hubb-scenes-screen, hubb-security-screen')) (el.shadowRoot?.querySelector('hubb-toast') as HubbToast | null)?.hide();
    document.body.replaceChildren();
  });

  it('keeps the taps of the Quem vê sheet when Home Assistant sends a new state in between', async () => {
    setEditing(true);
    const { el, saves, h } = await screen('hubb-scenes-screen', {});
    (el.shadowRoot!.querySelector('.tab-people') as HTMLButtonElement).click();
    await el.updateComplete;
    const picker = () => el.shadowRoot!.querySelector('hubb-sheet.people hubb-people-picker') as HTMLElement & { updateComplete: Promise<unknown> };
    await flush();
    await picker().updateComplete;
    (picker().shadowRoot!.querySelectorAll('.person')[0] as HTMLButtonElement).click();
    el.hass = { ...h };
    await el.updateComplete;
    await picker().updateComplete;
    (picker().shadowRoot!.querySelectorAll('.person')[1] as HTMLButtonElement).click();
    await settle(el);
    expect(saves.at(-1)).toMatchObject({ tabs: { scenes: { hidden_for: ['u_ana', LIA] } } });
  });

  it('saves two quick changes one after the other, so the second never undoes the first', async () => {
    const h = admin(casa(true));
    const saves = withDashboard(h, { strategy: { type: 'custom:hubb' } });
    await Promise.all([setEntity(h, null, 'script.tv', { role: 'scene' }), setEntity(h, null, 'script.botao', { role: 'scene' })]);
    expect(saves.at(-1)).toMatchObject({ entities: { 'script.tv': { role: 'scene' }, 'script.botao': { role: 'scene' } } });
  });

  it('takes a scene added from the panel out of Cenas with Não mostrar, back to Adicionar cena, not to a hidden list', async () => {
    setEditing(true);
    const { el, saves } = await screen('hubb-scenes-screen', { entities: { 'script.tv': { role: 'scene' } } });
    const row = [...el.shadowRoot!.querySelectorAll('.scene-edit')].find((r) => r.querySelector('strong')!.textContent === 'TV')!;
    (row.querySelector('.hide') as HTMLButtonElement).click();
    await settle(el);
    expect((saves.at(-1) as { entities?: Record<string, unknown> }).entities?.['script.tv']).toBeUndefined();
  });

  it('names who sees an item and which one it is, when a scene and a script share a name', async () => {
    setEditing(true);
    const extra: FakeEntity[] = [
      { entity_id: 'scene.desligar', name: 'Desligar', state: 'scening', labels: ['hubb_cena'] },
      { entity_id: 'script.desligar', name: 'Desligar', state: 'off' },
    ];
    const { el } = await screen('hubb-scenes-screen', { entities: { 'script.desligar': { role: 'scene' } } }, extra);
    const rows = [...el.shadowRoot!.querySelectorAll('.scene-edit')].filter((r) => r.querySelector('strong')!.textContent === 'Desligar');
    expect(rows.map((r) => r.querySelector('.kind')!.textContent)).toEqual(['Cena do Home Assistant', 'Script']);
    const people = rows[1]!.querySelector('.people') as HTMLButtonElement;
    expect(people.getAttribute('aria-label')).toBe('Desligar: Quem vê');
    people.click();
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('hubb-sheet.people')!.getAttribute('subheading')).toBe('Desligar · Script');
  });

  it('switches nothing on Segurança in edit mode: the alarm becomes a row with its tools, and the lists step aside', async () => {
    history.replaceState(null, '', '/hubb-casa/seguranca');
    setEditing(true);
    const { el } = await screen('hubb-security-screen', {});
    expect(el.shadowRoot!.querySelector('hubb-alarm-card')).toBeNull();
    expect(el.shadowRoot!.querySelector('hubb-access-tile')).toBeNull();
    expect(el.shadowRoot!.querySelector('.item-edit strong')!.textContent).toBe('Alarme');
  });

  it('tells the installer on an empty Cenas how to add a scene', () => {
    expect(S.emptyScenesAdmin).toBe('Toque no lápis para adicionar uma cena, ou dê a uma cena do Home Assistant o rótulo hubb_cena.');
  });
});

describe('the strip, the stale tabs, the candidates and the editor', () => {
  afterEach(() => document.body.replaceChildren());

  it('leads a resident without Segurança to the room of an alert that has one, even with the alarm going off', async () => {
    history.replaceState(null, '', '/hubb-casa/home');
    const h = casa(false);
    h.states['alarm_control_panel.alarme'] = { ...h.states['alarm_control_panel.alarme']!, state: 'triggered' };
    const strips = document.createElement('hubb-status-strips') as HTMLElement & { hass: FakeHass; alerts: unknown; security: boolean; updateComplete: Promise<unknown> };
    strips.hass = h;
    strips.alerts = [
      { entityId: 'alarm_control_panel.alarme', kind: 'alarm', roomName: null, path: null },
      { entityId: 'binary_sensor.sala_fumaca', kind: 'smoke', roomName: 'Sala', path: 'sala' },
    ];
    strips.security = false;
    document.body.appendChild(strips);
    await strips.updateComplete;
    (strips.shadowRoot!.querySelector('button.alert') as HTMLButtonElement).click();
    expect(location.pathname).toBe('/hubb-casa/sala');
  });

  it('reads only scenes and security as tabs of people who no longer exist', () => {
    expect(staleEntries({ tabs: { cenas: { hidden_for: ['u_saiu'] } } } as unknown as HubbConfig, new Set([LIA]))).toEqual([]);
  });

  it('never offers a configuration script as a scene', () => {
    const h = casa(true, [{ entity_id: 'script.reiniciar', name: 'Reiniciar', state: 'off', entity_category: 'config' }]);
    expect(buildHouse(h, {}).sceneCandidates.map((c) => c.entityId)).not.toContain('script.reiniciar');
  });

  it('offers Cena in Mostrar como for a script of a room', async () => {
    const h = admin(casa(true));
    const editor = document.createElement('hubb-item-editor') as HTMLElement & { hass: FakeHass; item: unknown; roomAreaId: string; updateComplete: Promise<unknown> };
    editor.hass = h;
    editor.item = { entityId: 'script.botao', name: 'Botão', kind: 'action', siblings: ['script.botao'] };
    editor.roomAreaId = 'sala';
    document.body.appendChild(editor);
    await editor.updateComplete;
    expect([...editor.shadowRoot!.querySelectorAll('button.role')].map((b) => b.textContent!.trim())).toContain('Cena');
  });

  it('keeps every view in its place whether a tab is hidden for the resident or not', () => {
    const paths = (config: HubbConfig) => generateDashboard(config, casa(false)).views.map((v) => v.path);
    const tabs: HubbConfig = { tabs: { scenes: { hidden_for: [LIA] }, security: { hidden_for: [LIA] } } };
    expect(paths(tabs)).toEqual(paths({}));
  });
});
