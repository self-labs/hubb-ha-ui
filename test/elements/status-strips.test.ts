import { afterEach, describe, expect, it, vi } from 'vitest';
import '../../src/elements/status-strips';
import { alertText, resetWarned } from '../../src/elements/status-strips';
import type { AlertItem } from '../../src/model/types';
import { makeHass, type FakeHass } from '../helpers/fake-hass';

const SMOKE: AlertItem = { entityId: 'binary_sensor.fumaca', kind: 'smoke', roomName: 'Cozinha', path: 'cozinha' };
const LEAK: AlertItem = { entityId: 'binary_sensor.vazamento', kind: 'moisture', roomName: null, path: null };
const ALARM: AlertItem = { entityId: 'alarm_control_panel.alarme', kind: 'alarm', roomName: null, path: null };

function hass(smoke = 'on', leak = 'off', alarm = 'disarmed'): FakeHass {
  return makeHass({
    entities: [
      { entity_id: SMOKE.entityId, state: smoke },
      { entity_id: LEAK.entityId, state: leak },
      { entity_id: ALARM.entityId, state: alarm },
    ],
  });
}

async function mount(h: FakeHass, alerts: AlertItem[] = [SMOKE, LEAK, ALARM]): Promise<HTMLElement & { hass: FakeHass; updateComplete: Promise<unknown> }> {
  const el = document.createElement('hubb-status-strips') as HTMLElement & { hass: FakeHass; alerts: AlertItem[]; updateComplete: Promise<unknown> };
  el.hass = h;
  el.alerts = alerts;
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}

const text = (el: Element, sel: string) => el.shadowRoot!.querySelector(sel)?.textContent?.replace(/\s+/g, ' ').trim() ?? null;

describe('hubb-status-strips', () => {
  afterEach(() => {
    resetWarned();
    document.body.replaceChildren();
    history.replaceState(null, '', '/');
  });

  it('says what and where, only for sensors that are on', async () => {
    expect(text(await mount(hass('on')), '.alert')).toBe('Fumaça · Cozinha');
    document.body.replaceChildren();
    expect(text(await mount(hass('unavailable', 'unknown')), '.alert')).toBeNull();
    document.body.replaceChildren();
    expect(text(await mount(hass('off', 'on')), '.alert')).toBe('Vazamento detectado');
    document.body.replaceChildren();
    expect(text(await mount(hass('off', 'off', 'triggered')), '.alert')).toBe('Alarme disparado');
  });

  it('names the first and counts the rest', () => {
    expect(alertText([SMOKE, LEAK])).toBe('Fumaça · Cozinha e mais 1');
  });

  it('leads to the room, or to the security tab when there is no room', async () => {
    history.replaceState(null, '', '/hubb-casa/home');
    const el = await mount(hass('on'));
    (el.shadowRoot!.querySelector('.alert') as HTMLButtonElement).click();
    expect(location.pathname).toBe('/hubb-casa/cozinha');
    document.body.replaceChildren();
    const leak = await mount(hass('off', 'on'));
    (leak.shadowRoot!.querySelector('.alert') as HTMLButtonElement).click();
    expect(location.pathname).toBe('/hubb-casa/seguranca');
  });

  it('vibrates once for a new alert, not on every screen', async () => {
    const buzz = vi.fn();
    window.addEventListener('haptic', buzz);
    await mount(hass('on'));
    await mount(hass('on'));
    expect(buzz).toHaveBeenCalledTimes(1);
    window.removeEventListener('haptic', buzz);
  });

  it('says the house is out of reach when Home Assistant lost the connection', async () => {
    const h = hass('off');
    h.connected = false;
    expect(text(await mount(h, []), '.offline')).toBe('Sem conexão com a casa. Tentando de novo…');
    document.body.replaceChildren();
    expect(text(await mount(hass('off'), []), '.offline')).toBeNull();
  });
});
