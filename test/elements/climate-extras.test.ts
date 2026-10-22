import { afterEach, describe, expect, it, vi } from 'vitest';
import '../../src/elements/climate-panel';
import type { HubbClimatePanel } from '../../src/elements/climate-panel';
import '../../src/elements/item-editor';
import { buildHouse } from '../../src/model/build-house';
import { readConfig } from '../../src/model/config';
import { reviewItems } from '../../src/model/review';
import { area, device, makeHass, type FakeEntity, type FakeHass } from '../helpers/fake-hass';

/** The office air conditioner seen by LG ThinQ: its functions are entities of their own. */
function office(state = 'cool', extra: FakeEntity[] = []): FakeHass {
  return makeHass({
    areas: [area('escritorio', 'Escritório')],
    devices: [device('d_ar', 'escritorio', 'Ar do Escritório')],
    entities: [
      {
        entity_id: 'climate.ar',
        device_id: 'd_ar',
        state,
        platform: 'lg_thinq',
        attributes: {
          friendly_name: 'Ar do Escritório',
          hvac_modes: ['off', 'auto', 'cool', 'dry', 'fan_only'],
          temperature: state === 'auto' ? 18 : 23,
          target_temp_step: 0.5,
          min_temp: 18,
          max_temp: 30,
          supported_features: 1 | 128 | 256,
        },
      },
      { entity_id: 'switch.ar_power', device_id: 'd_ar', platform: 'lg_thinq', state: 'on', entity_category: 'config', translation_key: 'operation_power', attributes: { friendly_name: 'Ar do Escritório Power' } },
      { entity_id: 'switch.ar_iluminacao', device_id: 'd_ar', platform: 'lg_thinq', state: 'on', entity_category: 'config', translation_key: 'display_light', attributes: { friendly_name: 'Ar do Escritório Iluminação' } },
      { entity_id: 'switch.ar_economia', device_id: 'd_ar', platform: 'lg_thinq', state: 'off', entity_category: 'config', translation_key: 'power_save_enabled', attributes: { friendly_name: 'Ar do Escritório Economia de energia' } },
      {
        entity_id: 'number.ar_sleep_timer',
        platform: 'lg_thinq',
        device_id: 'd_ar',
        state: 'unknown',
        translation_key: 'sleep_timer_relative_hour_to_stop',
        attributes: { friendly_name: 'Ar do Escritório Sleep timer', min: 0, max: 100, step: 1, unit_of_measurement: 'h' },
      },
      { entity_id: 'sensor.ar_filtro', device_id: 'd_ar', platform: 'lg_thinq', state: '402', attributes: { friendly_name: 'Ar do Escritório Filter remaining', unit_of_measurement: 'h' } },
      { entity_id: 'switch.ar_wifi', device_id: 'd_ar', platform: 'lg_thinq', state: 'on', entity_category: 'diagnostic', attributes: { friendly_name: 'Ar do Escritório Wi-Fi' } },
      ...extra,
    ],
  });
}

async function panel(h: FakeHass, config: Record<string, unknown> = {}): Promise<HubbClimatePanel> {
  const item = buildHouse(h, config).rooms[0]!.climate[0]!;
  const el = document.createElement('hubb-climate-panel') as HubbClimatePanel;
  el.hass = h;
  el.entityId = 'climate.ar';
  el.allowed = item;
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}

const texts = (root: ParentNode, sel: string) => [...root.querySelectorAll(sel)].map((b) => b.textContent!.replace(/\s+/g, ' ').trim());
const services = (h: FakeHass) => h.calls.map((c) => [`${c.domain}.${c.service}`, c.data, c.target]);

describe('the functions of an air conditioner that live in entities of their own', () => {
  afterEach(() => {
    vi.useRealTimers();
    document.body.replaceChildren();
  });

  it('gathers them from its device, in plain words, leaving out power, sensors and diagnostics', () => {
    const house = buildHouse(office(), {});
    expect(house.rooms[0]!.climate[0]!.extras).toEqual([
      { entityId: 'switch.ar_economia', name: 'Economia de energia', kind: 'switch' },
      { entityId: 'switch.ar_iluminacao', name: 'Luz do display', kind: 'switch' },
      { entityId: 'number.ar_sleep_timer', name: 'Modo dormir', kind: 'number' },
    ]);
    // They belong to its sheet: no tile in the room, nothing to review.
    expect(house.rooms[0]!.equipment).toEqual([]);
    expect(reviewItems(office(), {}).map((i) => i.entityId)).not.toContain('switch.ar_economia');
  });

  it('shows them under Mais ajustes, and the installer can leave some out', async () => {
    const el = await panel(office(), { entities: { 'climate.ar': { hide: ['switch.ar_economia'] } } });
    const more = el.shadowRoot!.querySelector('details.more')!;
    expect([...more.querySelectorAll('hubb-equipment-tile')].map((t) => (t as unknown as { item: { name: string } }).item.name)).toEqual(['Luz do display']);
    expect(texts(more, '.extra-number .name')).toEqual(['Modo dormir']);
    expect(texts(more, '.extra-number .value')).toEqual(['Desligado']);
  });

  it('leaves out a function the device does not answer for now', async () => {
    const h = office('cool', [
      { entity_id: 'switch.ar_jet', device_id: 'd_ar', platform: 'lg_thinq', state: 'unavailable', attributes: { friendly_name: 'Ar do Escritório Jet mode' } },
    ]);
    const el = await panel(h);
    expect([...el.shadowRoot!.querySelectorAll('hubb-equipment-tile')].map((t) => (t as unknown as { item: { name: string } }).item.name)).toEqual([
      'Economia de energia',
      'Luz do display',
    ]);
  });

  it('calls the display light Luz do display, by its key or by the name LG ThinQ gives it, and only on an air conditioner', () => {
    // No translation key: the name Home Assistant shows is all there is to go by.
    const h = office('cool', [
      { entity_id: 'switch.ar_display', device_id: 'd_ar', platform: 'smartthinq_sensors', state: 'on', entity_category: 'config', attributes: { friendly_name: 'Ar do Escritório Display light' } },
    ]);
    h.entities['switch.ar_iluminacao']!.translation_key = null;
    const names = buildHouse(h, {}).rooms[0]!.climate[0]!.extras!.map((x) => x.name);
    expect(names.filter((n) => n === 'Luz do display')).toHaveLength(2);
    expect(names).not.toContain('Iluminação');
    // A light named Iluminação that is not a function of an air conditioner keeps its name.
    const plain = makeHass({
      areas: [area('sala', 'Sala')],
      entities: [{ entity_id: 'light.iluminacao', area_id: 'sala', name: 'Iluminação', state: 'off', attributes: { supported_color_modes: ['onoff'] } }],
    });
    expect(buildHouse(plain, {}).rooms[0]!.lights.map((l) => l.name)).toEqual(['Iluminação']);
  });

  it('sets a timer with − and +, in the steps of the device', async () => {
    const h = office();
    const el = await panel(h);
    (el.shadowRoot!.querySelector('.extra-number .up') as HTMLButtonElement).click();
    expect(services(h)).toEqual([['number.set_value', { value: 1 }, { entity_id: 'number.ar_sleep_timer' }]]);
  });

  it('lets the installer pick them in the editor, saving the ones left out', async () => {
    const h = office();
    const item = buildHouse(h, {}).rooms[0]!.climate[0]!;
    const editor = document.createElement('hubb-item-editor') as HTMLElement & {
      hass: FakeHass;
      item: unknown;
      roomAreaId: string;
      extras: unknown;
      updateComplete: Promise<unknown>;
    };
    editor.hass = h;
    editor.item = { entityId: 'climate.ar', name: 'Ar', kind: 'climate', siblings: ['climate.ar'] };
    editor.roomAreaId = 'escritorio';
    editor.extras = item.extras;
    document.body.appendChild(editor);
    await editor.updateComplete;
    const toggles = () => [...editor.shadowRoot!.querySelectorAll('.panel-choice')] as HTMLButtonElement[];
    expect(toggles().map((b) => b.textContent!.trim())).toEqual(['Auto', 'Frio', 'Seco', 'Ventilar', 'Economia de energia', 'Luz do display', 'Modo dormir']);
    toggles()[4]!.click();
    await editor.updateComplete;
    let asked: unknown = null;
    editor.addEventListener('hubb-edit', (e) => (asked = (e as CustomEvent).detail));
    (editor.shadowRoot!.querySelector('button.save-choices') as HTMLButtonElement).click();
    expect(asked).toMatchObject({ entityId: 'climate.ar', patch: { modes: undefined, controls: undefined, hide: ['switch.ar_economia'] } });
  });

  it('accepts hide on an air conditioner in the YAML', () => {
    const r = readConfig(office(), { entities: { 'climate.ar': { hide: ['switch.ar_economia'] }, 'switch.ar_economia': { hide: ['x'] } } });
    expect(r.entities['climate.ar']?.hide).toEqual(['switch.ar_economia']);
    expect(r.problems.map((p) => [p.key, p.message])).toEqual([
      ['entities.switch.ar_economia.hide', 'hide só vale para um aparelho (role: appliance) ou um ar-condicionado.'],
    ]);
  });
});

describe('the target in Auto', () => {
  afterEach(() => {
    vi.useRealTimers();
    document.body.replaceChildren();
  });

  it('moves by whole degrees in Auto too: LG takes 18,5 in Auto and keeps 18 (test on the owner\'s unit, 15/10)', async () => {
    vi.useFakeTimers();
    const h = office('auto');
    const el = await panel(h);
    (el.shadowRoot!.querySelector('.warmer') as HTMLButtonElement).click();
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.target')!.textContent).toBe('19°');
    vi.advanceTimersByTime(1000);
    expect(services(h)).toEqual([['climate.set_temperature', { temperature: 19 }, { entity_id: 'climate.ar' }]]);
  });

  it('moves by whole degrees in every mode, like a remote control (Gustavo, 15/10)', async () => {
    vi.useFakeTimers();
    const h = office('cool');
    const el = await panel(h);
    (el.shadowRoot!.querySelector('.warmer') as HTMLButtonElement).click();
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.target')!.textContent).toBe('24°');
    vi.advanceTimersByTime(1000);
    expect(services(h)).toEqual([['climate.set_temperature', { temperature: 24 }, { entity_id: 'climate.ar' }]]);
  });

  it('takes a half degree set elsewhere to the next whole degree, up or down', async () => {
    const h = office('cool');
    h.states['climate.ar']!.attributes.temperature = 23.5;
    const up = await panel(h);
    (up.shadowRoot!.querySelector('.warmer') as HTMLButtonElement).click();
    await up.updateComplete;
    expect(up.shadowRoot!.querySelector('.target')!.textContent).toBe('24°');
    up.remove();
    const down = await panel(h);
    (down.shadowRoot!.querySelector('.colder') as HTMLButtonElement).click();
    await down.updateComplete;
    expect(down.shadowRoot!.querySelector('.target')!.textContent).toBe('23°');
  });

  it('never moves the wrong way when the device sits below the lowest target Home Assistant allows', async () => {
    vi.useFakeTimers();
    const h = office('auto');
    h.states['climate.ar']!.attributes.temperature = 17;
    const el = await panel(h);
    (el.shadowRoot!.querySelector('.colder') as HTMLButtonElement).click();
    await el.updateComplete;
    vi.advanceTimersByTime(1000);
    expect(el.shadowRoot!.querySelector('.target')!.textContent).toBe('17°');
    expect(services(h)).toEqual([]);
  });
});
