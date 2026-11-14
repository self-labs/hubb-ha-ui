import { afterEach, describe, expect, it } from 'vitest';
import '../../src/elements/appliance-panel';
import type { HubbAppliancePanel } from '../../src/elements/appliance-panel';
import { buildHouse } from '../../src/model/build-house';
import type { HubbConfig } from '../../src/model/types';
import { CASA2_CONFIG, casa2Hass } from '../fixtures/casa-exemplo-2';
import type { FakeHass } from '../helpers/fake-hass';

// The appliance sheet opens on a ring: the time left inside it, and the arc that fills as the cycle goes
// (Gustavo, 14/11: each sheet with its own look). The logic of the sheet is the one it had.
const PT: Record<string, string> = { Running: 'Lavando' };
const CONFIG: HubbConfig = {
  ...CASA2_CONFIG,
  entities: { ...CASA2_CONFIG.entities, 'sensor.lavadora_appliancestate': { role: 'appliance', progress: 'sensor.lavadora_progress' } },
};

function washer(state: string, minutes: string, progress?: string): FakeHass {
  const h = casa2Hass(state, minutes);
  h.formatEntityState = (st, s) => PT[s ?? st.state] ?? s ?? st.state;
  if (progress !== undefined) h.states['sensor.lavadora_progress'] = { entity_id: 'sensor.lavadora_progress', state: progress, attributes: {} };
  return h;
}

async function mount(hass: FakeHass): Promise<HubbAppliancePanel> {
  const el = document.createElement('hubb-appliance-panel') as HubbAppliancePanel;
  el.hass = hass;
  el.item = buildHouse(hass, CONFIG).rooms.find((r) => r.areaId === 'terraco')!.appliances[0]!;
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}

const $ = (el: Element, sel: string) => el.shadowRoot!.querySelector(sel);
const text = (el: Element, sel: string) => $(el, sel)?.textContent?.replace(/\s+/g, ' ').trim() ?? null;
const CIRCUMFERENCE = 2 * Math.PI * 70;

describe('the ring of the appliance sheet', () => {
  afterEach(() => document.body.replaceChildren());

  it('holds the time left in large, what is left to do under it, and the state under the ring', async () => {
    const el = await mount(washer('Running', '40', '60'));
    expect(text(el, '.ring strong')).toBe('40 min');
    expect(text(el, '.ring .caption')).toBe('para terminar');
    expect(text(el, '.now .state')).toBe('Lavando');
  });

  it('says hours when the cycle is long', async () => {
    expect(text(await mount(washer('Running', '80', '10')), '.ring strong')).toBe('1 h 20 min');
    document.body.replaceChildren();
    expect(text(await mount(washer('Running', '120', '10')), '.ring strong')).toBe('2 h');
  });

  it('fills the arc by the progress, and is a progress bar for a screen reader', async () => {
    const el = await mount(washer('Running', '40', '60'));
    const arc = $(el, '.arc')!;
    expect(Number(arc.getAttribute('stroke-dashoffset'))).toBeCloseTo(CIRCUMFERENCE * 0.4, 1);
    const ring = $(el, '.ring')!;
    expect(ring.getAttribute('role')).toBe('progressbar');
    expect(ring.getAttribute('aria-valuenow')).toBe('60');
    expect(ring.getAttribute('aria-valuetext')).toBe('40 min para terminar');
  });

  it('has no arc, and no progress bar, when the appliance does not say how far it is', async () => {
    const el = await mount(washer('Running', '40'));
    expect($(el, '.arc')).toBeNull();
    expect($(el, '.ring')!.getAttribute('role')).toBeNull();
    expect(text(el, '.ring strong')).toBe('40 min');
  });

  it('shows the state in the ring when nothing is running, with no time and no arc', async () => {
    const el = await mount(washer('End Of Cycle', '0', '100'));
    expect(text(el, '.ring strong')).toBe('Ciclo concluído');
    expect($(el, '.ring .caption')).toBeNull();
    expect($(el, '.now .state')).toBeNull();
    expect($(el, '.arc')).toBeNull();
  });

  it('keeps the commands under the ring as they were', async () => {
    const el = await mount(washer('Running', '40', '60'));
    expect([...el.shadowRoot!.querySelectorAll('.commands hubb-action-button')]).toHaveLength(3);
  });
});
