import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MEDIA_FEATURE } from '../src/actions/media';
import { setEditing } from '../src/editing';
import type { HubbToast } from '../src/elements/toast';
import type { HubbScreen } from '../src/screens/base';
import '../src/screens/home-screen';
import '../src/screens/media-screen';
import '../src/screens/room-screen';
import '../src/screens/scenes-screen';
import '../src/screens/security-screen';
import { REBUILD_MS } from '../src/sheets';
import { generateDashboard } from '../src/strategy/generate';
import { admin, flush } from './helpers/fake-dashboard';
import { area, makeHass, type FakeEntity, type FakeHass } from './helpers/fake-hass';

/**
 * Home Assistant rebuilds a strategy dashboard after every save and whenever a registry changes: the
 * WiiM group player hides or shows itself in the entity registry when speakers join (20/10). The old
 * screen goes and a new one comes; a sheet open on the old one has to be open on the new one.
 */

const SPEAKER = MEDIA_FEATURE.grouping | MEDIA_FEATURE.volumeSet | MEDIA_FEATURE.play | MEDIA_FEATURE.pause;
const SALA = 'media_player.caixa_sala';

type Screen = HubbScreen & { setConfig(c: unknown): void } & Record<string, unknown>;
type Card = Record<string, unknown> & { type: string };

function house(): FakeHass {
  const speaker = (entity_id: string, name: string, area_id: string): FakeEntity => ({
    entity_id,
    area_id,
    platform: 'wiim',
    name,
    state: 'playing',
    attributes: { supported_features: SPEAKER, volume_level: 0.3 },
  });
  return admin(
    makeHass({
      areas: [area('sala', 'Sala'), area('cozinha', 'Cozinha')],
      entities: [
        { entity_id: 'light.teto', area_id: 'sala', name: 'Teto', state: 'on', attributes: { brightness: 200, supported_color_modes: ['brightness'] } },
        speaker(SALA, 'Caixa Sala', 'sala'),
        speaker('media_player.caixa_cozinha', 'Echo', 'cozinha'),
        { entity_id: 'binary_sensor.porta', area_id: 'sala', name: 'Porta', state: 'off', attributes: { device_class: 'door' } },
        { entity_id: 'scene.jantar', name: 'Jantar', state: 'scening' },
      ],
    }),
  );
}

/** The card Home Assistant would mount for `view`, from the dashboard the strategy generates. */
function cardOf(h: FakeHass, view: string): Card {
  const dash = generateDashboard({}, h);
  return dash.views.find((v) => v.path === view)!.cards[0] as Card;
}

async function mount(card: Card, h: FakeHass): Promise<Screen> {
  const el = document.createElement(card.type.replace('custom:', '')) as Screen;
  el.setConfig(card);
  el.hass = h;
  document.body.appendChild(el);
  await flush();
  await el.updateComplete;
  return el;
}

async function rebuild(old: Screen, card: Card, h: FakeHass): Promise<Screen> {
  old.remove();
  return mount(card, h);
}

const openSheets = (el: Screen) => [...el.shadowRoot!.querySelectorAll('hubb-sheet[open]')];

describe('a sheet stays open across the rebuild Home Assistant does', () => {
  beforeEach(() => {
    history.replaceState(null, '', '/hubb-casa/home');
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(Date.parse('2026-10-20T12:00:00Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
    setEditing(false);
    for (const el of document.querySelectorAll('hubb-home-screen, hubb-room-screen, hubb-scenes-screen, hubb-security-screen')) {
      (el.shadowRoot?.querySelector('hubb-toast') as HubbToast | null)?.hide();
    }
    document.body.replaceChildren();
  });

  it('Tocar junto: the media sheet is still open after the switch groups the speakers', async () => {
    const h = house();
    const card = cardOf(h, 'sala');
    let el = await mount(card, h);
    el.dispatchEvent(new CustomEvent('hubb-open-media', { detail: { entityId: SALA }, bubbles: true, composed: true }));
    await el.updateComplete;
    const panel = el.shadowRoot!.querySelector('hubb-sheet.device hubb-media-panel') as HTMLElement & { updateComplete: Promise<unknown> };
    await panel.updateComplete;
    const group = panel.shadowRoot!.querySelector('hubb-media-group') as HTMLElement & { updateComplete: Promise<unknown> };
    await group.updateComplete;
    (group.shadowRoot!.querySelector('[role="switch"]') as HTMLButtonElement).click();
    expect(h.calls.map((c) => `${c.domain}.${c.service}`)).toContain('media_player.join');
    // The WiiM group player shows itself in the entity registry: Home Assistant rebuilds the page.
    el = await rebuild(el, card, h);
    const sheet = el.shadowRoot!.querySelector('hubb-sheet.device')!;
    expect(sheet.hasAttribute('open')).toBe(true);
    expect((sheet.querySelector('hubb-media-panel') as HTMLElement & { entityId: string }).entityId).toBe(SALA);
  });

  // Every property that opens a sheet, with something it could hold.
  const SAMPLES: Record<string, unknown> = {
    dimmer: { entityId: 'light.teto', name: 'Teto' },
    appliance: 'd_lavadora',
    device: { sheet: 'media', entityId: SALA },
    editingItem: { entityId: 'light.teto', name: 'Teto', kind: 'light', siblings: ['light.teto'] },
    sheetIds: ['light.teto'],
    applianceId: 'd_lavadora',
    peopleRoom: 'sala',
    peopleTarget: { kind: 'tab', tab: 'scenes' },
    settings: 'main',
    climateSheet: true,
    mediaId: SALA,
  };
  const SCREENS: [string, string][] = [
    ['home', 'hubb-home-screen'],
    ['sala', 'hubb-room-screen'],
    ['scenes', 'hubb-scenes-screen'],
    ['seguranca', 'hubb-security-screen'],
    ['midia', 'hubb-media-screen'],
  ];

  for (const [view, tag] of SCREENS) {
    it(`${tag}: every sheet it draws is one that opens again after a rebuild`, async () => {
      const h = house();
      setEditing(true);
      const el = await mount(cardOf(h, view), h);
      const kept = (customElements.get(tag) as unknown as typeof HubbScreen).keptSheets;
      // A new sheet that does not list its property here closes on the first tap that rebuilds the page.
      expect(el.shadowRoot!.querySelectorAll('hubb-sheet').length, `list the property of each sheet of ${tag} in keptSheets`).toBe(kept.length);
    });

    it(`${tag}: each sheet open before the rebuild is open after it`, async () => {
      const h = house();
      const card = cardOf(h, view);
      const kept = (customElements.get(tag) as unknown as typeof HubbScreen).keptSheets;
      for (const name of kept) {
        setEditing(true);
        let el = await mount(card, h);
        el[name] = SAMPLES[name];
        await el.updateComplete;
        el = await rebuild(el, card, h);
        expect(el[name], `${tag}.${name}`).toEqual(SAMPLES[name]);
        el.remove();
        setEditing(false);
      }
    });
  }

  it('a sheet the resident closed stays closed on the rebuilt page', async () => {
    const h = house();
    const card = cardOf(h, 'sala');
    let el = await mount(card, h);
    el.dispatchEvent(new CustomEvent('hubb-open-media', { detail: { entityId: SALA }, bubbles: true, composed: true }));
    await el.updateComplete;
    el.shadowRoot!.querySelector('hubb-sheet.device')!.dispatchEvent(new CustomEvent('hubb-close'));
    await el.updateComplete;
    el = await rebuild(el, card, h);
    expect(openSheets(el)).toHaveLength(0);
  });

  it('a page seen again later, not rebuilt, opens with no sheet', async () => {
    const h = house();
    const card = cardOf(h, 'sala');
    const el = await mount(card, h);
    el.dispatchEvent(new CustomEvent('hubb-open-media', { detail: { entityId: SALA }, bubbles: true, composed: true }));
    await el.updateComplete;
    el.remove();
    vi.setSystemTime(Date.now() + REBUILD_MS + 1);
    const again = await mount(card, h);
    expect(openSheets(again)).toHaveLength(0);
  });
});
