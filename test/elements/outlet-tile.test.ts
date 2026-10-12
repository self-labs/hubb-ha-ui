import { mdiPowerPlug, mdiPowerPlugOutline } from '@mdi/js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '../../src/elements/outlet-tile';
import type { HubbOutletTile } from '../../src/elements/outlet-tile';
import type { OutletItem } from '../../src/model/types';
import { makeHass, withState, type FakeHass } from '../helpers/fake-hass';

const TV: OutletItem = { entityId: 'switch.tv', name: 'TV' };

async function mount(hass: FakeHass): Promise<HubbOutletTile> {
  const el = document.createElement('hubb-outlet-tile') as HubbOutletTile;
  el.hass = hass;
  el.item = TV;
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}
const button = (el: HubbOutletTile) => el.shadowRoot!.querySelector('button')!;
const status = (el: HubbOutletTile) => el.shadowRoot!.querySelector('.state')!.textContent;
const iconPath = (el: HubbOutletTile) => el.shadowRoot!.querySelector('.icon path')!.getAttribute('d');

describe('hubb-outlet-tile', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    document.body.replaceChildren();
  });

  it('shows an outlet that is on as Ligada, with a plug', async () => {
    const el = await mount(makeHass({ entities: [{ entity_id: 'switch.tv', state: 'on' }] }));
    expect(status(el)).toBe('Ligada');
    expect(button(el).getAttribute('aria-pressed')).toBe('true');
    expect(iconPath(el)).toBe(mdiPowerPlug);
  });

  it('switches it on with the switch service and says Ligando while waiting', async () => {
    const hass = makeHass({ entities: [{ entity_id: 'switch.tv', state: 'off' }] });
    const el = await mount(hass);
    expect(status(el)).toBe('Desligada');
    expect(iconPath(el)).toBe(mdiPowerPlugOutline);
    button(el).click();
    await el.updateComplete;
    expect(hass.calls).toEqual([{ domain: 'switch', service: 'turn_on', data: undefined, target: { entity_id: 'switch.tv' } }]);
    expect(status(el)).toBe('Ligando…');
    el.hass = withState(hass, 'switch.tv', 'on');
    await el.updateComplete;
    expect(status(el)).toBe('Ligada');
  });

  it('switches it off, and a long press just toggles it because an outlet has no sheet', async () => {
    const hass = makeHass({ entities: [{ entity_id: 'switch.tv', state: 'on' }] });
    const el = await mount(hass);
    const asked: unknown[] = [];
    document.body.addEventListener('hubb-open-dimmer', (e) => asked.push(e));
    button(el).dispatchEvent(new Event('pointerdown'));
    vi.advanceTimersByTime(800);
    button(el).dispatchEvent(new Event('pointerup'));
    button(el).click();
    expect(asked).toEqual([]);
    expect(hass.calls).toEqual([{ domain: 'switch', service: 'turn_off', data: undefined, target: { entity_id: 'switch.tv' } }]);
  });

  it('says Sem resposta for an outlet that is down, and sends nothing', async () => {
    const hass = makeHass({ entities: [{ entity_id: 'switch.tv', state: 'unavailable' }] });
    const el = await mount(hass);
    expect(status(el)).toBe('Sem resposta');
    button(el).click();
    expect(hass.calls).toEqual([]);
  });
});
