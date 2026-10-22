import { afterEach, describe, expect, it } from 'vitest';
import '../../src/elements/tablet-editor';
import type { HubbTabletEditor, TabletChange } from '../../src/elements/tablet-editor';
import { buildHouse } from '../../src/model/build-house';
import type { TabletOverride } from '../../src/model/types';
import { area, makeHass } from '../helpers/fake-hass';

function house() {
  const h = makeHass({
    areas: [area('sala', 'Sala'), area('quarto', 'Quarto')],
    entities: [
      { entity_id: 'light.teto', area_id: 'sala', name: 'Teto', state: 'off' },
      { entity_id: 'light.cama', area_id: 'quarto', name: 'Cama', state: 'off' },
      { entity_id: 'binary_sensor.presenca_sala', area_id: 'sala', name: 'Presença', state: 'off', attributes: { device_class: 'occupancy' } },
      { entity_id: 'binary_sensor.movimento_ipad', name: 'Movimento do iPad', state: 'off', attributes: { device_class: 'motion' } },
    ],
  });
  h.services = { notify: { mobile_app_ipad_da_lia: {}, persistent_notification: {} } };
  return { h, rooms: buildHouse(h).rooms };
}

async function editor(value: TabletOverride | null): Promise<{ el: HubbTabletEditor; changes: TabletChange[] }> {
  const { h, rooms } = house();
  const el = document.createElement('hubb-tablet-editor') as HubbTabletEditor;
  el.hass = h;
  el.rooms = rooms;
  el.userId = 'u_lia';
  el.name = 'Lia';
  el.value = value;
  const changes: TabletChange[] = [];
  el.addEventListener('hubb-tablet', (e) => changes.push((e as CustomEvent<TabletChange>).detail));
  document.body.appendChild(el);
  await el.updateComplete;
  return { el, changes };
}

const $ = (el: HubbTabletEditor, sel: string) => el.shadowRoot!.querySelector(sel);
const options = (el: HubbTabletEditor, sel: string) => [...(el.shadowRoot!.querySelector(sel) as HTMLSelectElement).options].map((o) => [o.value, o.textContent]);

describe('the editor of a wall tablet', () => {
  afterEach(() => document.body.replaceChildren());

  it('turning it on makes the user a tablet in the first room', async () => {
    const { el, changes } = await editor(null);
    expect($(el, '.is-tablet')!.getAttribute('aria-checked')).toBe('false');
    expect($(el, '.room')).toBeNull();
    ($(el, '.is-tablet') as HTMLButtonElement).click();
    expect(changes[0]!.userId).toBe('u_lia');
    expect(changes[0]!.patch).toEqual({ room: 'quarto' });
  });

  it('offers the minutes to rest, five by default, and never', async () => {
    const { el, changes } = await editor({ room: 'sala' });
    const buttons = [...el.shadowRoot!.querySelectorAll('.rest button')] as HTMLButtonElement[];
    expect(buttons.map((b) => b.textContent!.trim())).toEqual(['2 min', '5 min', '10 min', '15 min', 'Nunca']);
    expect(buttons.find((b) => b.classList.contains('current'))!.textContent!.trim()).toBe('5 min');
    buttons[2]!.click();
    expect(changes[0]!.patch).toEqual({ rest_after: 10 });
  });

  it('wakes with the sensors of its room by default, any motion sensor of the house, or none', async () => {
    const { el } = await editor({ room: 'sala' });
    expect(options(el, '.presence')).toEqual([
      ['', 'Sensores do cômodo'],
      ['binary_sensor.presenca_sala', 'Presença'],
      ['binary_sensor.movimento_ipad', 'Movimento do iPad'],
      ['none', 'Nenhum'],
    ]);
  });

  it('offers the devices of the Home Assistant app for the brightness of the screen', async () => {
    const { el, changes } = await editor({ room: 'sala' });
    expect(options(el, '.device')).toEqual([
      ['', 'Nenhum'],
      ['mobile_app_ipad_da_lia', 'mobile_app_ipad_da_lia'],
    ]);
    const select = $(el, '.device') as HTMLSelectElement;
    select.value = 'mobile_app_ipad_da_lia';
    select.dispatchEvent(new Event('change'));
    expect(changes[0]!.patch).toEqual({ notify: 'mobile_app_ipad_da_lia' });
  });

  it('turning it off makes the user an ordinary one again', async () => {
    const { el, changes } = await editor({ room: 'sala', rest_after: 10 });
    ($(el, '.is-tablet') as HTMLButtonElement).click();
    expect(changes[0]!.patch).toBeNull();
  });
});
