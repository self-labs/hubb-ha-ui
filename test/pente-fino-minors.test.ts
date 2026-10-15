import { afterEach, describe, expect, it } from 'vitest';
import '../src/elements/climate-card';
import '../src/elements/climate-panel';
import type { HubbClimatePanel } from '../src/elements/climate-panel';
import { sensorWords } from '../src/elements/sensor-tile';
import { normalizeRoom } from '../src/model/build-house';
import { readConfig } from '../src/model/config';
import { reviewItems } from '../src/model/review';
import type { Room } from '../src/model/types';
import { roomClimate } from '../src/summary';
import { area, device, makeHass, type FakeHass } from './helpers/fake-hass';

/** An air conditioner with the features and modes given. */
function ac(state: string, features: number, hvacModes: string[]): FakeHass {
  return makeHass({
    areas: [area('quarto', 'Quarto')],
    entities: [
      {
        entity_id: 'climate.ar',
        area_id: 'quarto',
        name: 'Ar',
        state,
        attributes: { hvac_modes: hvacModes, temperature: 23, supported_features: features },
      },
    ],
  });
}

async function panel(h: FakeHass, allowed?: { modes?: string[] | null }): Promise<HubbClimatePanel> {
  const el = document.createElement('hubb-climate-panel') as HubbClimatePanel;
  el.hass = h;
  el.entityId = 'climate.ar';
  if (allowed) el.allowed = allowed;
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}

async function card(h: FakeHass, modes?: string[]): Promise<HTMLElement & { updateComplete: Promise<unknown> }> {
  const el = document.createElement('hubb-climate-card') as HTMLElement & { hass: FakeHass; item: unknown; updateComplete: Promise<unknown> };
  el.hass = h;
  el.item = { entityId: 'climate.ar', name: 'Ar', kind: 'climate', modes };
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}

const services = (h: FakeHass) => h.calls.map((c) => [`${c.domain}.${c.service}`, c.data]);

describe('the minors of pente fino 1', () => {
  afterEach(() => document.body.replaceChildren());

  it('writes °F when the thermometer reads in Fahrenheit, on its card and on the room line', () => {
    const h = makeHass({
      areas: [area('sala', 'Sala')],
      entities: [
        { entity_id: 'sensor.f', area_id: 'sala', state: '75.2', attributes: { device_class: 'temperature', unit_of_measurement: '°F' } },
        { entity_id: 'sensor.c', area_id: 'sala', state: '24.4', attributes: { device_class: 'temperature', unit_of_measurement: '°C' } },
      ],
    });
    expect(sensorWords(h, { entityId: 'sensor.f', name: 'Temperatura', kind: 'temperature' }).text).toBe('75,2°F');
    expect(sensorWords(h, { entityId: 'sensor.c', name: 'Temperatura', kind: 'temperature' }).text).toBe('24,4°');
    expect(roomClimate(h, { temperature: 'sensor.f', humidity: null } as Room)).toBe('75°F');
  });

  it('gives a dashboard frozen on 2026.10.8 its Sensores from what its rooms already carry', () => {
    const frozen = {
      areaId: 'sala',
      name: 'Sala',
      openings: [{ entityId: 'binary_sensor.porta', name: 'Porta da varanda', kind: 'door', roomName: 'Sala', path: 'sala' }],
      presence: ['binary_sensor.presenca'],
      temperature: 'sensor.temperatura',
      humidity: null,
      lights: [],
    } as unknown as Room;
    expect(normalizeRoom(frozen).sensors).toEqual([
      { entityId: 'binary_sensor.porta', name: 'Porta da varanda', kind: 'door' },
      { entityId: 'binary_sensor.presenca', name: 'Presença', kind: 'presence' },
      { entityId: 'sensor.temperatura', name: 'Temperatura', kind: 'temperature' },
    ]);
    // A room of this version keeps its own list, even an empty one.
    expect(normalizeRoom({ ...frozen, sensors: [] }).sensors).toEqual([]);
  });

  it('shows an infrared air conditioner in an unknown state as off, and turns it on', async () => {
    const h = ac('unknown', 1 | 128 | 256, ['off', 'cool']);
    const el = await panel(h);
    const power = el.shadowRoot!.querySelector('.power') as HTMLButtonElement;
    expect([power.getAttribute('aria-pressed'), power.getAttribute('aria-label')]).toEqual(['false', 'Ligar']);
    power.click();
    expect(services(h)).toEqual([['climate.turn_on', undefined]]);
  });

  it('has no power button for an air conditioner that cannot be turned off', async () => {
    const h = ac('cool', 1, ['cool', 'dry']);
    expect((await panel(h)).shadowRoot!.querySelector('.power')).toBeNull();
    expect((await card(h)).shadowRoot!.querySelector('.power')).toBeNull();
  });

  it('turns on in a mode the installer kept, from the sheet and from the card', async () => {
    const h = ac('off', 1, ['off', 'cool', 'dry']);
    (( await panel(h, { modes: ['dry'] })).shadowRoot!.querySelector('.power') as HTMLButtonElement).click();
    (( await card(h, ['dry'])).shadowRoot!.querySelector('.power') as HTMLButtonElement).click();
    expect(services(h)).toEqual([
      ['climate.set_hvac_mode', { hvac_mode: 'dry' }],
      ['climate.set_hvac_mode', { hvac_mode: 'dry' }],
    ]);
  });

  it('says what is wrong with modes and controls in the YAML', () => {
    const h = makeHass({
      areas: [area('sala', 'Sala')],
      entities: [
        { entity_id: 'climate.ar', area_id: 'sala', state: 'off' },
        { entity_id: 'light.teto', area_id: 'sala', state: 'off' },
      ],
    });
    const r = readConfig(h, {
      entities: {
        'climate.ar': { controls: 'fan' as unknown as string[] },
        'light.teto': { modes: ['cool'], controls: ['fan'] },
      },
    });
    expect(r.problems.map((p) => [p.key, p.message])).toEqual([
      ['entities.climate.ar.controls', 'controls precisa ser uma lista, por exemplo [fan, swing].'],
      ['entities.light.teto.modes', 'modes só vale para ar-condicionado (climate).'],
      ['entities.light.teto.controls', 'controls só vale para ar-condicionado (climate).'],
    ]);
    expect(r.entities['light.teto']?.modes).toBeUndefined();
  });

  it('finds same-named appliances and same-named sensors, but not a sensor or an appliance named after a control', () => {
    const h = makeHass({
      areas: [area('servico', 'Área de serviço')],
      devices: [device('d_a', 'servico', 'Lavadora'), device('d_b', 'servico', 'Lavadora')],
      entities: [
        { entity_id: 'sensor.lavadora_a', device_id: 'd_a', state: 'idle', platform: 'lg_thinq' },
        { entity_id: 'sensor.lavadora_b', device_id: 'd_b', state: 'idle', platform: 'smartthinq_sensors' },
        { entity_id: 'switch.lavadora', area_id: 'servico', name: 'Lavadora', state: 'on', attributes: { device_class: 'outlet' } },
        { entity_id: 'binary_sensor.porta_a', area_id: 'servico', name: 'Porta', state: 'off', platform: 'zha', attributes: { device_class: 'door' } },
        { entity_id: 'binary_sensor.porta_b', area_id: 'servico', name: 'Porta', state: 'off', platform: 'sonoff', attributes: { device_class: 'door' } },
        { entity_id: 'binary_sensor.portao', area_id: 'servico', name: 'Portão', state: 'off', attributes: { device_class: 'garage_door' } },
        { entity_id: 'cover.portao', area_id: 'servico', name: 'Portão', state: 'closed', attributes: { device_class: 'gate' } },
      ],
    });
    const config = { entities: { 'sensor.lavadora_a': { role: 'appliance' }, 'sensor.lavadora_b': { role: 'appliance' } } };
    const ids = reviewItems(h, config)
      .filter((i) => i.group === 'duplicate')
      .map((i) => i.entityId);
    expect(ids).toEqual(['sensor.lavadora_a', 'sensor.lavadora_b', 'binary_sensor.porta_a', 'binary_sensor.porta_b']);
  });
});
