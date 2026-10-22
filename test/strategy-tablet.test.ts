import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetRestForTests } from '../src/actions/rest';
import { reportArea, resetLayoutForTests } from '../src/layout';
import type { HubbConfig, Shared } from '../src/model/types';
import '../src/screens/home-screen';
import type { HubbScreen } from '../src/screens/base';
import { resetSelectionForTests } from '../src/selection';
import { generateDashboard } from '../src/strategy/generate';
import { flush } from './helpers/fake-dashboard';
import { area, makeHass, type FakeHass } from './helpers/fake-hass';

const LIA = { id: 'u_lia', name: 'Tablet', is_admin: false };

function house(user = LIA): FakeHass {
  return makeHass({
    user,
    areas: [area('quarto', 'Quarto'), area('sala', 'Sala')],
    entities: [
      { entity_id: 'light.cama', area_id: 'quarto', name: 'Cama', state: 'off' },
      { entity_id: 'light.teto', area_id: 'sala', name: 'Teto', state: 'on' },
    ],
  });
}

const sharedOf = (cards: Record<string, unknown>[]) => cards.map((c) => c.shared as Shared | undefined).filter((s): s is Shared => !!s);

async function home(h: FakeHass, config: HubbConfig): Promise<HubbScreen> {
  const card = generateDashboard(config, h).views.find((v) => v.path === 'home')!.cards[0]!;
  const el = document.createElement('hubb-home-screen') as HubbScreen & { setConfig(c: unknown): void };
  el.setConfig(card);
  el.hass = h;
  document.body.appendChild(el);
  await flush();
  await el.updateComplete;
  return el;
}

const embeddedArea = (el: HubbScreen) =>
  (el.shadowRoot!.querySelector('section.pane hubb-room-screen') as (HTMLElement & { config: { room: { areaId: string } } }) | null)?.config.room.areaId;

describe('the tablet reaches the screens of its user', () => {
  beforeEach(() => {
    history.replaceState(null, '', '/hubb-casa/home');
    reportArea({ left: 0, top: 0, width: 1280, height: 800 }, 800);
  });
  afterEach(() => {
    resetLayoutForTests();
    resetSelectionForTests();
    resetRestForTests();
    document.body.replaceChildren();
  });

  it('every screen of the user of the tablet gets it; another user gets none', () => {
    const config: HubbConfig = { tablets: { u_lia: { room: 'quarto' } } };
    const mine = generateDashboard(config, house()).views.flatMap((v) => v.cards as Record<string, unknown>[]);
    expect(sharedOf(mine).every((s) => s.tablet?.room === 'quarto')).toBe(true);
    const other = generateDashboard(config, house({ id: 'u_ana', name: 'Ana', is_admin: false })).views.flatMap((v) => v.cards as Record<string, unknown>[]);
    expect(sharedOf(other).every((s) => s.tablet === null)).toBe(true);
  });

  it('the wide home of the tablet opens on its room, even with a light on in another', async () => {
    const el = await home(house(), { tablets: { u_lia: { room: 'quarto' } } });
    expect(embeddedArea(el)).toBe('quarto');
  });

  it('the home of the tablet rests after five minutes with no touch, and a tap on the rest screen wakes it', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
    try {
      // Mounted by hand: the helper waits on a timeout, which the fake clock would never run.
      const h = house();
      const card = generateDashboard({ tablets: { u_lia: { room: 'quarto' } } }, h).views.find((v) => v.path === 'home')!.cards[0]!;
      const el = document.createElement('hubb-home-screen') as HubbScreen & { setConfig(c: unknown): void };
      el.setConfig(card);
      el.hass = h;
      document.body.appendChild(el);
      await el.updateComplete;
      vi.advanceTimersByTime(5 * 60_000);
      await el.updateComplete;
      const rest = el.shadowRoot!.querySelector('hubb-rest-screen') as (HTMLElement & { updateComplete: Promise<unknown> }) | null;
      expect(rest).not.toBeNull();
      await rest!.updateComplete;
      (rest!.shadowRoot!.querySelector('.rest') as HTMLElement).click();
      await el.updateComplete;
      expect(el.shadowRoot!.querySelector('hubb-rest-screen')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('a tablet whose room is gone opens by the next rule: the room with a light on', async () => {
    const el = await home(house(), { tablets: { u_lia: { room: 'garagem' } } });
    expect(embeddedArea(el)).toBe('sala');
  });
});
