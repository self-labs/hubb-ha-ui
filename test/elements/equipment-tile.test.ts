import { mdiPower } from '@mdi/js';
import { afterEach, describe, expect, it } from 'vitest';
import '../../src/elements/equipment-tile';
import type { HubbEquipmentTile } from '../../src/elements/equipment-tile';
import type { EquipmentItem } from '../../src/model/types';
import { makeHass, type FakeHass } from '../helpers/fake-hass';

async function mount(hass: FakeHass, item: EquipmentItem): Promise<HubbEquipmentTile> {
  const el = document.createElement('hubb-equipment-tile') as HubbEquipmentTile;
  el.hass = hass;
  el.item = item;
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}

describe('hubb-equipment-tile', () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it('says Desligado, then Ligando… on a tap, and switches through the switch domain', async () => {
    const h = makeHass({ entities: [{ entity_id: 'switch.bomba', state: 'off' }] });
    const el = await mount(h, { entityId: 'switch.bomba', name: 'Bomba', icon: null });
    expect(el.shadowRoot!.querySelector('.state')!.textContent).toBe('Desligado');
    (el.shadowRoot!.querySelector('button') as HTMLButtonElement).click();
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.state')!.textContent).toBe('Ligando…');
    expect(h.calls).toEqual([{ domain: 'switch', service: 'turn_on', data: undefined, target: { entity_id: 'switch.bomba' } }]);
  });

  it('draws the icon of the configuration with ha-icon, else the power icon', async () => {
    const h = makeHass({ entities: [{ entity_id: 'switch.bomba', state: 'on' }] });
    const withIcon = await mount(h, { entityId: 'switch.bomba', name: 'Bomba', icon: 'mdi:pool' });
    expect((withIcon.shadowRoot!.querySelector('.icon ha-icon') as HTMLElement & { icon?: string }).icon).toBe('mdi:pool');
    expect(withIcon.shadowRoot!.querySelector('.state')!.textContent).toBe('Ligado');
    const plain = await mount(h, { entityId: 'switch.bomba', name: 'Bomba', icon: null });
    expect(plain.shadowRoot!.querySelector('.icon ha-icon')).toBeNull();
    expect(plain.shadowRoot!.querySelector('.icon svg path')!.getAttribute('d')).toBe(mdiPower);
  });
});
