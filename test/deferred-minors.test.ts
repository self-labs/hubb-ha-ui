import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setEditing } from '../src/editing';
import '../src/elements/climate-panel';
import type { HubbClimatePanel } from '../src/elements/climate-panel';
import { buildHouse } from '../src/model/build-house';
import type { HubbConfig } from '../src/model/types';
import '../src/screens/home-screen';
import type { HubbHomeScreen } from '../src/screens/home-screen';
import { sampleHouseHass } from './fixtures/sample-house';
import { admin, flush, USERS, withUsers } from './helpers/fake-dashboard';
import { area, device, makeHass, type FakeHass } from './helpers/fake-hass';

async function badge(options: HubbConfig): Promise<string> {
  const h = admin(sampleHouseHass());
  withUsers(h, USERS);
  const el = document.createElement('hubb-home-screen') as HubbHomeScreen;
  el.setConfig({ type: 'custom:hubb-home-screen', house: buildHouse(h, options), options });
  el.hass = h;
  document.body.appendChild(el);
  await flush();
  await flush();
  await el.updateComplete;
  const key = el.shadowRoot!.querySelector('.key')!;
  el.remove();
  return key.getAttribute('aria-label')!;
}

function ac(): FakeHass {
  return makeHass({
    areas: [area('sala', 'Sala')],
    entities: [
      {
        entity_id: 'climate.ar',
        area_id: 'sala',
        name: 'Ar',
        state: 'cool',
        attributes: { hvac_modes: ['off', 'cool', 'fan_only'], temperature: 23, target_temp_step: 1, min_temp: 16, max_temp: 30, supported_features: 1 | 128 | 256 },
      },
    ],
  });
}

const blink = (h: FakeHass, state: string, temperature: number | null) => {
  h.states['climate.ar'] = { ...h.states['climate.ar']!, state, attributes: { ...h.states['climate.ar']!.attributes, temperature } };
  return { ...h };
};

describe('what was left for later', () => {
  beforeEach(() => history.replaceState(null, '', '/hubb-casa/home'));
  afterEach(() => {
    setEditing(false);
    vi.useRealTimers();
    document.body.replaceChildren();
  });

  it('counts the people who no longer exist on the key of the review', async () => {
    const without = await badge({ type: 'custom:hubb' });
    const withStale = await badge({ type: 'custom:hubb', rooms: { cozinha: { hidden_for: ['u_saiu'] } } });
    const n = (label: string) => Number(label.match(/\d+/)?.[0] ?? 0);
    expect(n(withStale)).toBe(n(without) + 1);
  });

  it('hides an appliance marked by two entities from a resident when one of them is hidden for them', () => {
    const h = makeHass({
      user: { id: 'u_lia', name: 'Lia', is_admin: false },
      areas: [area('servico', 'Serviço')],
      devices: [device('d_lav', 'servico', 'Lavadora')],
      entities: [
        { entity_id: 'sensor.lavadora_estado', device_id: 'd_lav', state: 'idle' },
        { entity_id: 'button.lavadora_iniciar', device_id: 'd_lav', state: 'unknown' },
        { entity_id: 'light.servico', area_id: 'servico', name: 'Teto', state: 'off' },
      ],
    });
    const roles = { 'sensor.lavadora_estado': { role: 'appliance' }, 'button.lavadora_iniciar': { role: 'appliance' } };
    expect(buildHouse(h, { entities: roles }).rooms[0]!.appliances.length).toBe(1);
    const hidden = { entities: { ...roles, 'sensor.lavadora_estado': { role: 'appliance', hidden_for: ['u_lia'] } } };
    expect(buildHouse(h, hidden).rooms[0]!.appliances).toEqual([]);
  });

  it('keeps the taps on − and + through a blink of the air conditioner, and sends them', async () => {
    vi.useFakeTimers();
    const h = ac();
    const el = document.createElement('hubb-climate-panel') as HubbClimatePanel;
    el.hass = h;
    el.entityId = 'climate.ar';
    document.body.appendChild(el);
    await el.updateComplete;
    (el.shadowRoot!.querySelector('.warmer') as HTMLButtonElement).click();
    await el.updateComplete;
    el.hass = blink(h, 'unavailable', null);
    await el.updateComplete;
    el.hass = blink(h, 'cool', null);
    await el.updateComplete;
    el.hass = blink(h, 'cool', 23);
    await el.updateComplete;
    vi.advanceTimersByTime(1000);
    expect(h.calls.map((c) => [c.service, c.data])).toEqual([['set_temperature', { temperature: 24 }]]);
  });
});
