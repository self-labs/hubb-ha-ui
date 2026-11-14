import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import '../src/elements/sheet';
import { HubbSheet } from '../src/elements/sheet';
import { resetLayoutForTests } from '../src/layout';
import { buildHouse } from '../src/model/build-house';
import '../src/screens/home-screen';
import { HubbHomeScreen } from '../src/screens/home-screen';
import type { HubbScreen } from '../src/screens/base';
import { resetSelectionForTests } from '../src/selection';
import { flush } from './helpers/fake-dashboard';
import { area, makeHass } from './helpers/fake-hass';

const cssOf = (styles: unknown): string => ([] as unknown[]).concat(styles).map((s) => (s as { cssText: string }).cssText).join('\n');

// A sheet with a heading and no subheading ("Clima ligado") had its content flush under the title
// (Gustavo, 14/11); the same sheet now says how many are on, like "Luzes acesas" does.
describe('the space under the title of a sheet', () => {
  afterEach(() => document.body.replaceChildren());

  async function mount(subheading: string): Promise<HubbSheet> {
    const el = document.createElement('hubb-sheet') as HubbSheet;
    el.heading = 'Clima ligado';
    el.subheading = subheading;
    el.open = true;
    document.body.appendChild(el);
    await el.updateComplete;
    return el;
  }

  it('marks a title with nothing under it, so the content gets room', async () => {
    const el = await mount('');
    expect(el.shadowRoot!.querySelector('h2')!.classList.contains('alone')).toBe(true);
    expect(el.shadowRoot!.querySelector('.sub')).toBeNull();
  });

  it('leaves the title with a subheading as it was', async () => {
    const el = await mount('2 ares ligados');
    expect(el.shadowRoot!.querySelector('h2')!.classList.contains('alone')).toBe(false);
  });

  it('gives that title 14 px under it', () => {
    expect(cssOf(HubbSheet.styles)).toMatch(/h2\.alone\s*\{[^}]*margin-bottom: 14px/);
  });
});

describe('the sheets of the home with a button for all of them', () => {
  beforeEach(() => history.replaceState(null, '', '/hubb-ui/home'));
  afterEach(() => {
    resetLayoutForTests();
    resetSelectionForTests();
    document.body.replaceChildren();
  });

  it('say how many air conditioners are on under "Clima ligado"', async () => {
    const h = makeHass({
      areas: [area('sala', 'Sala')],
      entities: [
        { entity_id: 'climate.ar_sala', area_id: 'sala', name: 'Ar', state: 'cool', attributes: { hvac_modes: ['off', 'cool'], temperature: 23, supported_features: 1 } },
      ],
    });
    const el = document.createElement('hubb-home-screen') as HubbScreen & { setConfig(c: unknown): void };
    el.setConfig({ type: 'custom:hubb-home-screen', house: buildHouse(h), shared: { alerts: [], security: false, scenes: true } });
    el.hass = h;
    document.body.appendChild(el);
    await flush();
    await el.updateComplete;
    (el.shadowRoot!.querySelector('.chip.climate') as HTMLButtonElement).click();
    await el.updateComplete;
    const sheet = el.shadowRoot!.querySelector('hubb-sheet.climate-on') as HubbSheet;
    expect(sheet.subheading).toBe('1 ar ligado');
  });

  it('leave 12 px between the button and what it turns off', () => {
    expect(cssOf(HubbHomeScreen.styles)).toMatch(/\.wide\s*\{[^}]*margin-bottom: 12px/);
  });
});
