import { afterEach, describe, expect, it, vi } from 'vitest';
import '../../src/elements/climate-panel';
import type { HubbClimatePanel } from '../../src/elements/climate-panel';
import { area, makeHass, type FakeHass } from '../helpers/fake-hass';

/** An LG seen through LG ThinQ: half degrees, and no target while it only ventilates. */
function lg(state = 'cool', failService = false): FakeHass {
  return makeHass({
    failService,
    areas: [area('escritorio', 'Escritório')],
    entities: [
      {
        entity_id: 'climate.ar',
        area_id: 'escritorio',
        name: 'Ar',
        state,
        attributes: {
          hvac_modes: ['off', 'auto', 'cool', 'dry', 'fan_only'],
          temperature: state === 'fan_only' ? null : 21,
          target_temp_step: 0.5,
          min_temp: 18,
          max_temp: 30,
          supported_features: 1 | 128 | 256,
        },
      },
    ],
  });
}

async function panel(h: FakeHass): Promise<HubbClimatePanel> {
  const el = document.createElement('hubb-climate-panel') as HubbClimatePanel;
  el.hass = h;
  el.entityId = 'climate.ar';
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}

const button = (el: HubbClimatePanel, sel: string) => el.shadowRoot!.querySelector(sel) as HTMLButtonElement;
const services = (h: FakeHass) => h.calls.map((c) => [c.service, c.data]);

describe('the commands of the air conditioner sheet', () => {
  afterEach(() => {
    vi.useRealTimers();
    document.body.replaceChildren();
  });

  it('drops a target not sent yet when the resident picks another mode, so Ventilar never gets one', async () => {
    vi.useFakeTimers();
    const h = lg();
    const el = await panel(h);
    button(el, '.colder').click();
    await el.updateComplete;
    const fan = [...el.shadowRoot!.querySelectorAll('.mode')].find((b) => b.textContent!.trim() === 'Ventilar') as HTMLButtonElement;
    fan.click();
    vi.advanceTimersByTime(2000);
    // LG answered "Command not supported in FAN" to the target that went out after the mode.
    expect(services(h)).toEqual([['set_hvac_mode', { hvac_mode: 'fan_only' }]]);
  });

  it('drops a target not sent yet when the device stops taking one', async () => {
    vi.useFakeTimers();
    const h = lg();
    const el = await panel(h);
    button(el, '.warmer').click();
    await el.updateComplete;
    // The mode changed elsewhere (the remote control) before the target went out.
    h.states['climate.ar'] = { ...h.states['climate.ar']!, state: 'fan_only', attributes: { ...h.states['climate.ar']!.attributes, temperature: null } };
    el.hass = { ...h };
    await el.updateComplete;
    vi.advanceTimersByTime(2000);
    el.remove();
    expect(services(h)).toEqual([]);
  });

  it('says on the sheet that the device refused, instead of the toast of Home Assistant, and shows the real target again', async () => {
    vi.useFakeTimers();
    const h = lg('cool', true);
    const quiet: unknown[] = [];
    const call = h.callService.bind(h);
    h.callService = (domain, service, data, target, notifyOnError) => {
      quiet.push(notifyOnError);
      return call(domain, service, data, target);
    };
    const el = await panel(h);
    button(el, '.warmer').click();
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.target')!.textContent).toBe('22°');
    vi.advanceTimersByTime(1000);
    vi.useRealTimers();
    await new Promise((r) => setTimeout(r, 0));
    await el.updateComplete;
    expect(quiet).toEqual([false]);
    expect(el.shadowRoot!.querySelector('.failed')!.textContent!.trim()).toBe('O aparelho não aceitou o comando.');
    expect(el.shadowRoot!.querySelector('.target')!.textContent).toBe('21°');
  });

  it('tells an administrator what the device answered', async () => {
    const h = lg('cool', true);
    h.user = { id: 'u', name: 'Instalador', is_admin: true };
    const el = await panel(h);
    button(el, '.power').click();
    await new Promise((r) => setTimeout(r, 0));
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.failed')!.textContent!.replace(/\s+/g, ' ').trim()).toBe('O aparelho não aceitou o comando. (service failed)');
  });
});
