import { afterEach, describe, expect, it } from 'vitest';
import '../src/elements/climate-panel';
import type { HubbClimatePanel } from '../src/elements/climate-panel';
import '../src/elements/item-editor';
import '../src/elements/sheet';
import type { HubbSheet } from '../src/elements/sheet';
import { buildHouse } from '../src/model/build-house';
import { generateDashboard } from '../src/strategy/generate';
import { area, device, makeHass, type FakeHass } from './helpers/fake-hass';

/** What Home Assistant's own climate translations name, in the masculine they come in. */
const HA_WORDS: Record<string, string> = { low: 'Baixo', medium: 'Médio', high: 'Alto', diffuse: 'Difuso', off: 'Desligado', auto: 'Automático' };

function ac(attributes: Record<string, unknown>, platform = 'lg_thinq'): FakeHass {
  const h = makeHass({
    areas: [area('escritorio', 'Escritório')],
    entities: [
      {
        entity_id: 'climate.ar',
        area_id: 'escritorio',
        name: 'Ar',
        state: 'cool',
        platform,
        attributes: { hvac_modes: ['off', 'cool'], temperature: 23, supported_features: 1 | 8 | 16 | 32 | 128 | 256, ...attributes },
      },
    ],
  });
  h.formatEntityAttributeValue = (_st, _attribute, value) => HA_WORDS[String(value)] ?? String(value);
  return h;
}

async function panel(h: FakeHass): Promise<HubbClimatePanel> {
  const el = document.createElement('hubb-climate-panel') as HubbClimatePanel;
  el.hass = h;
  el.entityId = 'climate.ar';
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}

// happy-dom miscounts the options Lit puts in a select (selectedIndex lands on the wrong one), so the
// tests read the selected attribute, which is what a browser shows.
const marked = (select: HTMLSelectElement) => [...select.options].filter((o) => o.hasAttribute('selected'));

const texts = (el: Element, sel: string) => [...el.shadowRoot!.querySelectorAll(sel)].map((b) => b.textContent!.replace(/\s+/g, ' ').trim());

describe('the review of pente fino 1', () => {
  afterEach(() => document.body.replaceChildren());

  it('does not let a cancelled touch on the outside close the next sheet on the release of a long press', async () => {
    const el = document.createElement('hubb-sheet') as HubbSheet;
    el.open = true;
    document.body.appendChild(el);
    await el.updateComplete;
    const backdrop = () => el.shadowRoot!.querySelector('.backdrop') as HTMLElement;
    // A swipe that began on the outside: the browser cancels it, no click follows.
    backdrop().dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    backdrop().dispatchEvent(new MouseEvent('pointercancel', { bubbles: true }));
    el.close();
    await el.updateComplete;
    el.open = true;
    await el.updateComplete;
    // The release of the long press that opened it again.
    backdrop().click();
    await el.updateComplete;
    expect(el.open).toBe(true);
  });

  it('says the setting is on something else when its value has no name, instead of showing the first choice', async () => {
    const el = await panel(ac({ preset_modes: ['none', 'sleep', 'comfort', 'auto_sense'], preset_mode: 'auto_sense' }, 'electrolux_status'));
    const select = el.shadowRoot!.querySelector('select.preset') as HTMLSelectElement;
    expect(marked(select).map((o) => [o.textContent!.trim(), o.disabled])).toEqual([['Outra opção', true]]);
    expect([...select.options].slice(1).map((o) => o.textContent!.trim())).toEqual(['Nenhuma', 'Dormir', 'Conforto']);
  });

  it('names every position of an infrared swing that goes from highest to lowest', async () => {
    const el = await panel(ac({ swing_modes: ['off', 'auto', 'highest', 'high', 'middle', 'low', 'lowest'], swing_mode: 'lowest' }, 'tasmota_ir'));
    const select = el.shadowRoot!.querySelector('select.swing') as HTMLSelectElement;
    expect([...select.options].map((o) => o.textContent!.trim())).toEqual(['Desligada', 'Auto', 'Mais alta', 'Alta', 'Meio', 'Baixa', 'Mais baixa']);
    expect(marked(select).map((o) => o.textContent!.trim())).toEqual(['Mais baixa']);
  });

  it('keeps the words of a row in one gender, the panel ones first, whatever Home Assistant serves', async () => {
    const el = await panel(ac({ fan_modes: ['low', 'LOW_MID', 'medium', 'MID_HIGH', 'high', 'diffuse'], fan_mode: 'low' }, 'smartthinq_sensors'));
    expect(texts(el, 'select.fan option')).toEqual(['Baixa', 'Média baixa', 'Média', 'Média alta', 'Alta', 'Difusa']);
  });

  it('offers in the editor only the settings the sheet would show', async () => {
    const h = ac(
      {
        fan_modes: ['low', 'high'],
        swing_modes: ['Off', 'Top', 'MiddleTop1', 'Bottom', 'Swing'],
        preset_modes: ['none', 'sleep'],
      },
      'smartthinq_sensors',
    );
    const editor = document.createElement('hubb-item-editor') as HTMLElement & { hass: FakeHass; item: unknown; roomAreaId: string; updateComplete: Promise<unknown> };
    editor.hass = h;
    editor.item = { entityId: 'climate.ar', name: 'Ar', kind: 'climate', siblings: ['climate.ar'] };
    editor.roomAreaId = 'escritorio';
    document.body.appendChild(editor);
    await editor.updateComplete;
    // Only "Off" of the swing has a name: the sheet never shows it, so the editor does not offer it.
    expect(texts(editor, '.panel-choice')).toEqual(['Frio', 'Ventilação', 'Predefinição']);
  });

  it('leaves the thermometer inside an air conditioner off the Sensores cards, and still reads it for the room', () => {
    const h = makeHass({
      areas: [area('escritorio', 'Escritório')],
      devices: [device('d_ar', 'escritorio', 'Ar do Escritório')],
      entities: [
        { entity_id: 'climate.ar', device_id: 'd_ar', state: 'cool', attributes: { hvac_modes: ['off', 'cool'] } },
        // smartthinq_sensors names it in English: a card would read "Room temperature".
        { entity_id: 'sensor.ar_room_temperature', device_id: 'd_ar', state: '28', attributes: { device_class: 'temperature', unit_of_measurement: '°C', friendly_name: 'Room temperature' } },
        { entity_id: 'sensor.escritorio_umidade', area_id: 'escritorio', name: 'Umidade', state: '60', attributes: { device_class: 'humidity', unit_of_measurement: '%' } },
      ],
    });
    const room = buildHouse(h, {}).rooms[0]!;
    expect(room.sensors.map((s) => s.entityId)).toEqual(['sensor.escritorio_umidade']);
    expect(room.temperature).toBe('sensor.ar_room_temperature');
  });

  it('keeps the page of a sensor-only room whose last sensor was hidden, so it can come back', () => {
    const h = makeHass({
      user: { id: 'u', name: 'Instalador', is_admin: true },
      areas: [area('sala', 'Sala'), area('varanda', 'Varanda')],
      entities: [
        { entity_id: 'light.sala', area_id: 'sala', name: 'Teto', state: 'off' },
        { entity_id: 'binary_sensor.varanda_porta', area_id: 'varanda', name: 'Porta', state: 'off', attributes: { device_class: 'door' } },
      ],
    });
    const config = { entities: { 'binary_sensor.varanda_porta': { role: 'hidden' } } };
    const house = buildHouse(h, config);
    expect(house.sensorRooms.find((r) => r.areaId === 'varanda')?.hidden.map((i) => i.entityId)).toEqual(['binary_sensor.varanda_porta']);
    const views = generateDashboard(config, h).views as { path: string; cards: { room?: { hidden: { entityId: string }[] } }[] }[];
    const varanda = views.find((v) => v.path === 'varanda')!;
    expect(varanda.cards[0]!.room!.hidden.map((i) => i.entityId)).toEqual(['binary_sensor.varanda_porta']);
  });
});
