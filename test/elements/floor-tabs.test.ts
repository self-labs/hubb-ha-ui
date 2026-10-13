import { afterEach, describe, expect, it } from 'vitest';
import '../../src/elements/floor-tabs';
import type { HubbFloorTabs } from '../../src/elements/floor-tabs';
import { buildHouse } from '../../src/model/build-house';
import { CLINIC_CONFIG, clinicHass } from '../fixtures/clinic';

async function mount(current: string): Promise<HubbFloorTabs> {
  const h = clinicHass();
  const house = buildHouse(h, CLINIC_CONFIG);
  const el = document.createElement('hubb-floor-tabs') as HubbFloorTabs;
  el.hass = h;
  el.floors = house.floors;
  el.rooms = house.rooms;
  el.current = current;
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}

const tabs = (el: HubbFloorTabs) => [...el.shadowRoot!.querySelectorAll('button')];

describe('hubb-floor-tabs', () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it('names each floor and shows its lights on only when there are some', async () => {
    const el = await mount('terreo');
    expect(tabs(el).map((t) => [t.querySelector('.label')!.textContent, t.querySelector('.n')?.textContent ?? null])).toEqual([
      ['Térreo', '2'],
      ['1º andar', '1'],
    ]);
    expect(tabs(el).map((t) => t.getAttribute('aria-selected'))).toEqual(['true', 'false']);
    expect(tabs(el)[0]!.getAttribute('aria-label')).toBe('Térreo, 2 luzes acesas');
  });

  it('asks the home for another floor on a tap, and stays quiet on the current one', async () => {
    const el = await mount('terreo');
    const asked: string[] = [];
    document.body.addEventListener('hubb-floor', (e) => asked.push((e as CustomEvent<{ floorId: string }>).detail.floorId));
    tabs(el)[0]!.click();
    tabs(el)[1]!.click();
    expect(asked).toEqual(['primeiro']);
  });
});
