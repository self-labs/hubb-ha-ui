import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '../../src/screens/home-screen';
import { HubbHomeScreen } from '../../src/screens/home-screen';
import { buildHouse } from '../../src/model/build-house';
import { sampleHouseHass } from '../fixtures/sample-house';

const cssOf = (styles: unknown): string =>
  ([] as unknown[]).concat(styles).map((s) => (s as { cssText: string }).cssText).join('\n');

describe('the header of the home', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 13, 15, 0, 0));
    history.replaceState(null, '', '/hubb-casa/home');
  });
  afterEach(() => {
    vi.useRealTimers();
    document.body.replaceChildren();
  });

  it('opens the weather of Home Assistant on a tap of the temperature', async () => {
    const h = sampleHouseHass();
    const el = document.createElement('hubb-home-screen') as HubbHomeScreen;
    el.setConfig({ type: 'custom:hubb-home-screen', house: buildHouse(h) });
    el.hass = h;
    document.body.appendChild(el);
    await el.updateComplete;
    let asked: string | null = null;
    document.addEventListener('hass-more-info', (e) => (asked = (e as CustomEvent<{ entityId: string }>).detail.entityId), { once: true });
    (el.shadowRoot!.querySelector('button.weather') as HTMLButtonElement).click();
    expect(asked).toBe('weather.forecast_home');
  });

  it('gives the temperature and the review key the same height', () => {
    const css = cssOf(HubbHomeScreen.styles);
    expect(css).toMatch(/\.weather\s*\{[^}]*height: 44px/);
    expect(css).toMatch(/\.key[\s,][^{]*\{[^}]*height: 44px/);
  });
});
