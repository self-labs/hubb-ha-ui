import { afterEach, describe, expect, it, vi } from 'vitest';
import '../../src/elements/appliance-panel';
import type { HubbAppliancePanel } from '../../src/elements/appliance-panel';
import { buildHouse } from '../../src/model/build-house';
import { applianceReach, findParts, type ApplianceItem } from '../../src/model/appliances';
import { applianceLine } from '../../src/summary';
import { CASA2_CONFIG, casa2Hass } from '../fixtures/casa-exemplo-2';
import type { FakeHass } from '../helpers/fake-hass';

/** The washer of casa 2 with the remote control sensor the Electrolux integration adds. */
function washerHass(connection = 'Connected', remote = 'Enabled', state = 'Idle', minutes = '80'): FakeHass {
  const h = casa2Hass(state, minutes);
  h.states['sensor.lavadora_connectivitystate']!.state = connection;
  h.entities['sensor.lavadora_connectivitystate']!.translation_key = 'connectivity_state';
  h.entities['sensor.lavadora_controle'] = {
    entity_id: 'sensor.lavadora_controle',
    device_id: 'd_lavadora',
    labels: [],
    platform: 'electrolux_status',
    translation_key: 'remote_control',
  };
  h.states['sensor.lavadora_controle'] = { entity_id: 'sensor.lavadora_controle', state: remote, attributes: { friendly_name: 'Lavadora Controle remoto' } };
  return h;
}

const washer = (h: FakeHass): ApplianceItem => buildHouse(h, CASA2_CONFIG).rooms.find((r) => r.areaId === 'terraco')!.appliances[0]!;

async function mount(hass: FakeHass): Promise<HubbAppliancePanel> {
  const el = document.createElement('hubb-appliance-panel') as HubbAppliancePanel;
  el.hass = hass;
  el.item = washer(hass);
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}

const $ = (el: HubbAppliancePanel, sel: string) => el.shadowRoot!.querySelector(sel);
const commandButtons = (el: HubbAppliancePanel) =>
  [...el.shadowRoot!.querySelectorAll('.commands hubb-action-button')].map((b) => b.shadowRoot!.querySelector('button') as HTMLButtonElement);
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('whether an appliance can take a command from the panel', () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it('finds the connection and the remote control sensors on the device, by their keys', () => {
    const h = washerHass();
    const parts = findParts(h, 'd_lavadora', 'sensor.lavadora_appliancestate');
    expect([parts.connection, parts.remote, parts.state]).toEqual(['sensor.lavadora_connectivitystate', 'sensor.lavadora_controle', 'sensor.lavadora_appliancestate']);
  });

  it('reads the values of Electrolux: only Enabled takes commands, and Disconnected is out of reach', () => {
    const reach = (connection: string, remote: string) => {
      const h = washerHass(connection, remote);
      return applianceReach(h, findParts(h, 'd_lavadora', 'sensor.lavadora_appliancestate'));
    };
    expect(reach('Connected', 'Enabled')).toBe('ok');
    expect(reach('Disconnected', 'Enabled')).toBe('offline');
    expect(['Disabled', 'Not Safety Relevant Enabled', 'NOT_SAFETY_RELEVANT_ENABLED', 'Temporary Locked'].map((r) => reach('Connected', r))).toEqual([
      'remote-off',
      'remote-off',
      'remote-off',
      'remote-off',
    ]);
    // What the panel cannot read says nothing: no warning out of an unknown or missing sensor.
    expect([reach('unknown', 'unavailable'), reach('Connected', 'unknown')]).toEqual(['ok', 'ok']);
    const frozen = washerHass('Disconnected', 'Disabled');
    const { connection: _c, remote: _r, ...old } = findParts(frozen, 'd_lavadora', 'sensor.lavadora_appliancestate');
    expect(applianceReach(frozen, old)).toBe('ok');
  });

  it('says it on the card line: no connection always, the remote control while it waits', () => {
    expect(applianceLine(washerHass('Disconnected'), washer(washerHass('Disconnected')))).toBe('Sem conexão');
    const off = washerHass('Connected', 'Disabled');
    expect(applianceLine(off, washer(off))).toBe('Controle remoto desligado');
    const working = washerHass('Connected', 'Disabled', 'Running', '40');
    expect(applianceLine(working, washer(working))).toBe('Lavando · faltam 40 min');
  });

  it('greys out the commands on the sheet and says why', async () => {
    const off = await mount(washerHass('Connected', 'Disabled'));
    expect($(off, '.notice')!.textContent!.trim()).toBe(
      'Controle remoto desligado no aparelho. Para usar os comandos daqui, ative o controle remoto no painel do aparelho.',
    );
    const buttons = commandButtons(off);
    expect(buttons.length).toBeGreaterThan(0);
    expect(buttons.every((b) => b.disabled)).toBe(true);
    buttons[0]!.click();
    expect((off.hass as FakeHass).calls).toEqual([]);
    document.body.replaceChildren();
    const offline = await mount(washerHass('Disconnected'));
    expect($(offline, '.notice')!.textContent!.trim()).toBe('Sem conexão com a internet. Os comandos voltam quando a conexão voltar.');
    expect(commandButtons(offline).every((b) => b.disabled)).toBe(true);
    document.body.replaceChildren();
    const ok = await mount(washerHass());
    expect($(ok, '.notice')).toBeNull();
    expect(commandButtons(ok).some((b) => b.disabled)).toBe(false);
  });

  it('shows one line of its own when a command fails, instead of the toast of Home Assistant', async () => {
    const h = washerHass();
    const asked: unknown[][] = [];
    h.callService = vi.fn((...args: unknown[]) => {
      asked.push(args);
      return Promise.reject({ code: 'home_assistant_error', message: "401, message='Unauthorized', url='https://api.example/command'" });
    }) as FakeHass['callService'];
    const el = await mount(h);
    commandButtons(el)[0]!.click();
    await flush();
    await el.updateComplete;
    expect(asked[0]![4]).toBe(false);
    expect($(el, '.failed')!.textContent!.trim()).toBe('Lavadora não recebeu o comando.');
    document.body.replaceChildren();
    h.user = { id: 'u1', name: 'Gustavo Exemplo', is_admin: true };
    const admin = await mount(h);
    commandButtons(admin)[0]!.click();
    await flush();
    await admin.updateComplete;
    expect($(admin, '.failed')!.textContent!.replace(/\s+/g, ' ').trim()).toBe(
      'Lavadora não recebeu o comando. A integração perdeu o acesso à conta do fabricante: recarregue a integração em Configurações, Dispositivos e serviços.',
    );
  });

  it('keeps the same line for a choice that fails, and clears it when a command goes through', async () => {
    const h = washerHass();
    let fail = true;
    h.callService = vi.fn(() => (fail ? Promise.reject(new Error('timeout')) : Promise.resolve())) as FakeHass['callService'];
    const el = await mount(h);
    const select = el.shadowRoot!.querySelector('.choice select') as HTMLSelectElement;
    select.value = 'quick';
    select.dispatchEvent(new Event('change'));
    await flush();
    await el.updateComplete;
    expect($(el, '.failed')!.textContent!.trim()).toBe('Lavadora não recebeu o comando.');
    fail = false;
    commandButtons(el)[0]!.click();
    await flush();
    await el.updateComplete;
    expect($(el, '.failed')).toBeNull();
  });
});
