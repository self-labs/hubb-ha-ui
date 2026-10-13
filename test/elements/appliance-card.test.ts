import { mdiDevices, mdiDishwasher, mdiTumbleDryer, mdiWashingMachine } from '@mdi/js';
import { afterEach, describe, expect, it } from 'vitest';
import '../../src/elements/appliance-card';
import { applianceIcon, type HubbApplianceCard } from '../../src/elements/appliance-card';
import { buildHouse } from '../../src/model/build-house';
import type { ApplianceItem } from '../../src/model/appliances';
import { CASA2_CONFIG, casa2Hass } from '../fixtures/casa-exemplo-2';
import { withState, type FakeHass } from '../helpers/fake-hass';

const washer = (h: FakeHass): ApplianceItem => buildHouse(h, CASA2_CONFIG).rooms.find((r) => r.areaId === 'terraco')!.appliances[0]!;

async function mount(hass: FakeHass, item: ApplianceItem): Promise<HubbApplianceCard> {
  const el = document.createElement('hubb-appliance-card') as HubbApplianceCard;
  el.hass = hass;
  el.item = item;
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}

describe('hubb-appliance-card', () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it('shows the name and the state line, in amber only while it works', async () => {
    const h = casa2Hass('Running', '40');
    const el = await mount(h, washer(h));
    expect(el.shadowRoot!.querySelector('.name')!.textContent).toBe('Lavadora');
    expect(el.shadowRoot!.querySelector('.state')!.textContent).toBe('Running · faltam 40 min');
    expect(el.shadowRoot!.querySelector('button')!.classList.contains('on')).toBe(true);
    el.hass = withState(h, 'sensor.lavadora_appliancestate', 'End Of Cycle');
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.state')!.textContent).toBe('End Of Cycle');
    expect(el.shadowRoot!.querySelector('button')!.classList.contains('on')).toBe(false);
  });

  it('asks for its sheet with the device id', async () => {
    const h = casa2Hass();
    const el = await mount(h, washer(h));
    let asked: string | null = null;
    document.body.addEventListener('hubb-open-appliance', (e) => (asked = (e as CustomEvent<{ deviceId: string }>).detail.deviceId), { once: true });
    (el.shadowRoot!.querySelector('button') as HTMLButtonElement).click();
    expect(asked).toBe('d_lavadora');
  });

  it('picks the icon from the name', () => {
    expect(applianceIcon('Lava-louças')).toBe(mdiDishwasher);
    expect(applianceIcon('Lavadora')).toBe(mdiWashingMachine);
    expect(applianceIcon('Lava e seca')).toBe(mdiWashingMachine);
    expect(applianceIcon('Secadora')).toBe(mdiTumbleDryer);
    expect(applianceIcon('Forno')).toBe(mdiDevices);
  });
});
