import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MEDIA_FEATURE } from '../../src/actions/media';
import '../../src/elements/media-group';
import '../../src/elements/media-panel';
import type { HubbMediaGroup } from '../../src/elements/media-group';
import type { Shared } from '../../src/model/types';
import { generateDashboard } from '../../src/strategy/generate';
import { area, makeHass, type FakeEntity, type FakeHass } from '../helpers/fake-hass';

const F = MEDIA_FEATURE;
const GROUPS = F.grouping | F.volumeSet | F.play | F.pause;
const SALA = 'media_player.caixa_sala';
const COZINHA = 'media_player.caixa_cozinha';
const QUARTO = 'media_player.caixa_quarto';
const TV = 'media_player.tv_sala';
const LIA = 'u_lia';

function house(groups: Record<string, string[]> = {}, user?: { id: string; name: string; is_admin: boolean }): FakeHass {
  const speaker = (entity_id: string, name: string, area_id: string, volume: number, platform = 'wiim', features = GROUPS): FakeEntity => ({
    entity_id,
    area_id,
    platform,
    name,
    state: 'playing',
    attributes: { supported_features: features, volume_level: volume, ...(groups[entity_id] ? { group_members: groups[entity_id] } : {}) },
  });
  return makeHass({
    ...(user ? { user } : {}),
    areas: [area('sala', 'Sala'), area('cozinha', 'Cozinha'), area('quarto', 'Quarto')],
    entities: [
      speaker(SALA, 'Caixa Sala', 'sala', 0.3),
      speaker(COZINHA, 'Echo', 'cozinha', 0.5),
      speaker(QUARTO, 'JBL', 'quarto', 0.2),
      speaker(TV, 'TV', 'sala', 0.1, 'samsungtv', F.volumeSet | F.grouping),
    ],
  });
}

async function mount(h: FakeHass, entityId: string, visible: string[]): Promise<HubbMediaGroup> {
  const el = document.createElement('hubb-media-group') as HubbMediaGroup;
  el.hass = h;
  el.entityId = entityId;
  el.visible = visible;
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}

const $ = (el: HubbMediaGroup, sel: string) => el.shadowRoot!.querySelector(sel);
const calls = (h: FakeHass) => h.calls.map((c) => [`${c.domain}.${c.service}`, c.data, c.target?.entity_id]);
const checked = (el: HubbMediaGroup) => $(el, '[role="switch"]')!.getAttribute('aria-checked');

describe('playing together', () => {
  beforeEach(() => vi.useFakeTimers({ now: Date.parse('2026-10-19T12:00:00Z') }));
  afterEach(() => {
    vi.useRealTimers();
    document.body.replaceChildren();
  });

  it('lists the speakers the resident sees, of the same integration, with their room', async () => {
    const el = await mount(house(), SALA, [SALA, COZINHA, TV]);
    const rows = [...el.shadowRoot!.querySelectorAll('.member')];
    expect(rows.map((r) => [r.querySelector('.name')!.textContent!.trim(), r.querySelector('.area')!.textContent!.trim()])).toEqual([['Echo', 'Cozinha']]);
    expect($(el, '.label')!.textContent!.trim()).toBe('Tocar junto');
    document.body.replaceChildren();
    const alone = await mount(house(), SALA, [SALA, TV]);
    expect(alone.shadowRoot!.children).toHaveLength(0);
  });

  it('joins and unjoins, holding the switch as asked until Home Assistant confirms or 5 s pass', async () => {
    const h = house();
    const el = await mount(h, SALA, [SALA, COZINHA]);
    ($(el, '[role="switch"]') as HTMLButtonElement).click();
    await el.updateComplete;
    expect(calls(h)).toEqual([['media_player.join', { group_members: [COZINHA] }, SALA]]);
    expect(checked(el)).toBe('true');
    await vi.advanceTimersByTimeAsync(4900);
    expect(checked(el)).toBe('true');
    await vi.advanceTimersByTimeAsync(200);
    await el.updateComplete;
    expect(checked(el)).toBe('false');
    document.body.replaceChildren();
    const joined = house({ [SALA]: [SALA, COZINHA], [COZINHA]: [SALA, COZINHA] });
    const el2 = await mount(joined, SALA, [SALA, COZINHA]);
    expect(checked(el2)).toBe('true');
    ($(el2, '[role="switch"]') as HTMLButtonElement).click();
    await el2.updateComplete;
    expect(calls(joined)).toEqual([['media_player.unjoin', undefined, COZINHA]]);
    expect(checked(el2)).toBe('false');
  });

  it('offers a member of another group only to leave it, naming the leader the resident cannot see', async () => {
    const h = house({ [SALA]: [SALA, COZINHA], [COZINHA]: [SALA, COZINHA] });
    const el = await mount(h, COZINHA, [COZINHA, QUARTO]);
    expect($(el, '.part')!.textContent!.trim()).toBe('Faz parte do grupo de Caixa Sala');
    expect($(el, '.member')).toBeNull();
    const leave = $(el, '.leave') as HTMLButtonElement;
    expect(leave.textContent!.trim()).toBe('Sair do grupo');
    leave.click();
    expect(calls(h)).toEqual([['media_player.unjoin', undefined, COZINHA]]);
  });

  it('turns every speaker of the group up from its own volume, on the leader', async () => {
    const h = house({ [SALA]: [SALA, COZINHA], [COZINHA]: [SALA, COZINHA] });
    const el = await mount(h, SALA, [SALA, COZINHA]);
    expect($(el, '.all')!.textContent).toContain('Volume de todas');
    ($(el, '.all-louder') as HTMLButtonElement).click();
    await vi.advanceTimersByTimeAsync(300);
    expect(calls(h)).toEqual([
      ['media_player.volume_set', { volume_level: 0.35 }, SALA],
      ['media_player.volume_set', { volume_level: 0.55 }, COZINHA],
    ]);
    document.body.replaceChildren();
    expect($(await mount(house(), SALA, [SALA, COZINHA]), '.all')).toBeNull();
  });

  it('keeps the group volume on a leader whose members the resident cannot see', async () => {
    const h = house({ [SALA]: [SALA, QUARTO], [QUARTO]: [SALA, QUARTO] });
    const el = await mount(h, SALA, [SALA]);
    expect($(el, '.label')!.textContent!.trim()).toBe('Tocar junto');
    expect($(el, '.all')).not.toBeNull();
  });

  it('adds the group step to the step the sheet just took on the same speaker', async () => {
    const h = house({ [SALA]: [SALA, COZINHA], [COZINHA]: [SALA, COZINHA] });
    const panel = document.createElement('hubb-media-panel') as HTMLElement & { hass: FakeHass; entityId: string; visible: string[]; updateComplete: Promise<unknown> };
    panel.hass = h;
    panel.entityId = SALA;
    panel.visible = [SALA, COZINHA];
    document.body.appendChild(panel);
    await panel.updateComplete;
    (panel.shadowRoot!.querySelector('.louder') as HTMLButtonElement).click();
    const group = panel.shadowRoot!.querySelector('hubb-media-group') as HubbMediaGroup;
    await group.updateComplete;
    ($(group, '.all-louder') as HTMLButtonElement).click();
    await vi.advanceTimersByTimeAsync(300);
    expect(calls(h)).toEqual([
      ['media_player.volume_set', { volume_level: 0.4 }, SALA],
      ['media_player.volume_set', { volume_level: 0.55 }, COZINHA],
    ]);
  });

  it('names the room on each switch for a screen reader', async () => {
    const el = await mount(house(), SALA, [SALA, COZINHA]);
    expect($(el, '[role="switch"]')!.getAttribute('aria-label')).toBe('Echo, Cozinha');
  });

  it('hands the screens only the players the resident sees', () => {
    const h = house({}, { id: LIA, name: 'Lia', is_admin: false });
    const views = generateDashboard({ entities: { [QUARTO]: { hidden_for: [LIA] } } }, h).views;
    const shared = views[0]!.cards[0]!.shared as Shared;
    expect([...(shared.media ?? [])].sort()).toEqual([COZINHA, SALA, TV].sort());
  });
});
