import { afterEach, describe, expect, it, vi } from 'vitest';
import { configureRest, isResting, resetRestForTests, screenShown } from '../../src/actions/rest';
import '../../src/elements/rest-screen';
import { makeHass } from '../helpers/fake-hass';

describe('the rest screen', () => {
  afterEach(() => {
    resetRestForTests();
    vi.useRealTimers();
    document.body.replaceChildren();
  });

  it('shows the time and the date, and a tap wakes the tablet without reaching what is under it', async () => {
    vi.useFakeTimers();
    // Local time, so the test reads the same in any time zone (CI runs in UTC).
    vi.setSystemTime(new Date(2026, 9, 21, 14, 27));
    history.replaceState(null, '', '/hubb-casa/home');
    const h = makeHass();
    // A screen of the panel on the page: the rest only happens over the panel.
    screenShown();
    configureRest({ room: null, restAfter: 5, presence: [], notify: null, platform: null }, h);
    vi.advanceTimersByTime(5 * 60_000);
    expect(isResting()).toBe(true);
    const el = document.createElement('hubb-rest-screen') as HTMLElement & { hass: unknown; updateComplete: Promise<unknown> };
    el.hass = h;
    document.body.appendChild(el);
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.time')!.textContent).toBe('14:32');
    expect(el.shadowRoot!.querySelector('.hint')!.textContent).toBe('Toque para abrir');
    let reached = 0;
    document.body.addEventListener('click', () => reached++);
    (el.shadowRoot!.querySelector('.rest') as HTMLElement).click();
    expect(isResting()).toBe(false);
    expect(reached).toBe(0);
  });

  it('shows the weather of the house under the date', async () => {
    const h = makeHass({ entities: [{ entity_id: 'weather.casa', state: 'sunny', attributes: { temperature: 28 } }] });
    const el = document.createElement('hubb-rest-screen') as HTMLElement & { hass: unknown; updateComplete: Promise<unknown> };
    el.hass = h;
    document.body.appendChild(el);
    await el.updateComplete;
    expect((el.shadowRoot!.querySelector('hubb-weather-now') as HTMLElement & { entityId: string }).entityId).toBe('weather.casa');
  });

  it('shows the summary of the house the home hands it', async () => {
    const el = document.createElement('hubb-rest-screen') as HTMLElement & { hass: unknown; line: string; updateComplete: Promise<unknown> };
    el.hass = makeHass();
    el.line = '4 acesas · 1 ar ligado';
    document.body.appendChild(el);
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.line')!.textContent).toBe('4 acesas · 1 ar ligado');
  });
});
