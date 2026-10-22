import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { HubbToast } from '../../src/elements/toast';
import { reportArea, resetLayoutForTests } from '../../src/layout';
import { buildHouse } from '../../src/model/build-house';
import '../../src/screens/home-screen';
import type { HubbScreen } from '../../src/screens/base';
import { resetSelectionForTests } from '../../src/selection';
import { flush } from '../helpers/fake-dashboard';
import { area, makeHass, type FakeHass } from '../helpers/fake-hass';

type Screen = HubbScreen & { setConfig(c: unknown): void };

function house(): FakeHass {
  return makeHass({
    areas: [area('sala', 'Sala'), area('quarto', 'Quarto')],
    entities: [
      { entity_id: 'light.teto', area_id: 'sala', name: 'Teto', state: 'off' },
      { entity_id: 'climate.ar_sala', area_id: 'sala', name: 'Ar', state: 'cool', attributes: { hvac_modes: ['off', 'cool'], temperature: 23, supported_features: 1 } },
      { entity_id: 'climate.ar_quarto', area_id: 'quarto', name: 'Ar', state: 'heat', attributes: { hvac_modes: ['off', 'heat'], temperature: 25, supported_features: 1 } },
    ],
  });
}

async function mount(h: FakeHass): Promise<Screen> {
  const el = document.createElement('hubb-home-screen') as Screen;
  el.setConfig({ type: 'custom:hubb-home-screen', house: buildHouse(h), shared: { alerts: [], security: false, scenes: true } });
  el.hass = h;
  document.body.appendChild(el);
  await flush();
  await el.updateComplete;
  return el;
}

describe('the air conditioners on, on the home', () => {
  beforeEach(() => history.replaceState(null, '', '/hubb-casa/home'));
  afterEach(() => {
    resetLayoutForTests();
    resetSelectionForTests();
    for (const el of document.querySelectorAll('hubb-home-screen')) (el.shadowRoot?.querySelector('hubb-toast') as HubbToast | null)?.hide();
    document.body.replaceChildren();
  });

  it('a chip on the phone opens "Clima ligado", which turns one off and stays open', async () => {
    const h = house();
    const el = await mount(h);
    const chip = el.shadowRoot!.querySelector('.chip.climate') as HTMLButtonElement;
    expect(chip.textContent!.trim()).toBe('2 ares ligados');
    chip.click();
    await el.updateComplete;
    const sheet = el.shadowRoot!.querySelector('hubb-sheet.climate-on')!;
    expect(sheet.hasAttribute('open')).toBe(true);
    const rows = [...sheet.querySelectorAll('.climate-row')];
    expect(rows.map((r) => r.querySelector('.name')!.textContent)).toEqual(['Ar · Quarto', 'Ar · Sala']);
    (rows[1]!.querySelector('button') as HTMLButtonElement).click();
    expect(h.calls.map((c) => [c.domain, c.service, c.target?.entity_id])).toEqual([['climate', 'set_hvac_mode', 'climate.ar_sala']]);
    await el.updateComplete;
    expect(sheet.hasAttribute('open')).toBe(true);
  });

  it('"Desligar todos" turns every one off', async () => {
    const h = house();
    const el = await mount(h);
    (el.shadowRoot!.querySelector('.chip.climate') as HTMLButtonElement).click();
    await el.updateComplete;
    (el.shadowRoot!.querySelector('hubb-sheet.climate-on .primary') as HTMLButtonElement).click();
    expect(h.calls.map((c) => c.target?.entity_id).sort()).toEqual(['climate.ar_quarto', 'climate.ar_sala']);
  });

  it('on a wide screen the column shows the pills of the house', async () => {
    reportArea({ left: 0, top: 0, width: 1280, height: 800 }, 800);
    const el = await mount(house());
    expect([...el.shadowRoot!.querySelectorAll('aside.side .pill b')].map((b) => b.textContent)).toEqual(['2 ares ligados']);
  });
});
