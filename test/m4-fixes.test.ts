import { afterEach, describe, expect, it, vi } from 'vitest';
import '../src/elements/alarm-card';
import { HubbAlarmCard } from '../src/elements/alarm-card';
import '../src/elements/camera-tile';
import '../src/elements/status-strips';
import { resetWarned } from '../src/elements/status-strips';
import { buildHouse } from '../src/model/build-house';
import { consumptionOf } from '../src/model/energy';
import '../src/screens/room-screen';
import '../src/screens/security-screen';
import { generateDashboard } from '../src/strategy/generate';
import { area, device, makeHass, type FakeHass } from './helpers/fake-hass';

type El = HTMLElement & { hass: unknown; item?: unknown; updateComplete: Promise<unknown>; setConfig?(c: unknown): void };
const flush = () => new Promise((r) => setTimeout(r, 0));

async function mount(tag: string, props: Record<string, unknown>): Promise<El> {
  const el = document.createElement(tag) as El;
  Object.assign(el, props);
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}

describe('M4 review fixes', () => {
  afterEach(() => {
    resetWarned();
    document.body.replaceChildren();
  });

  it('asks Home Assistant for a fresh signed image each time the tab opens, whatever hass the hidden view kept', async () => {
    const h = makeHass({ entities: [{ entity_id: 'camera.garagem', state: 'idle', attributes: { entity_picture: '/api/camera_proxy/camera.garagem?token=old' } }] });
    let n = 0;
    h.callWS = vi.fn(async () => ({ path: `/api/camera_proxy/camera.garagem?authSig=${++n}` })) as FakeHass['callWS'];
    const tile = await mount('hubb-camera-tile', { hass: h, item: { entityId: 'camera.garagem', name: 'Garagem', roomName: null } });
    await flush();
    await tile.updateComplete;
    const src = () => tile.shadowRoot!.querySelector('img')?.getAttribute('src');
    expect(src()).toBe('/api/camera_proxy/camera.garagem?authSig=1');
    expect((h.callWS as ReturnType<typeof vi.fn>).mock.calls[0]![0]).toEqual({ type: 'auth/sign_path', path: '/api/camera_proxy/camera.garagem' });
    tile.remove();
    document.body.appendChild(tile);
    await flush();
    await tile.updateComplete;
    expect(src()).toBe('/api/camera_proxy/camera.garagem?authSig=2');
  });

  it('falls back to the picture of the state when signing is refused', async () => {
    const h = makeHass({ entities: [{ entity_id: 'camera.garagem', state: 'idle', attributes: { entity_picture: '/api/camera_proxy/camera.garagem?token=a' } }] });
    h.callWS = vi.fn(async () => {
      throw new Error('nope');
    }) as FakeHass['callWS'];
    const tile = await mount('hubb-camera-tile', { hass: h, item: { entityId: 'camera.garagem', name: 'Garagem', roomName: null } });
    await flush();
    await tile.updateComplete;
    expect(tile.shadowRoot!.querySelector('img')!.getAttribute('src')).toBe('/api/camera_proxy/camera.garagem?token=a');
  });

  it('leads an alert of a room with only sensors to a page that shows them', () => {
    const h = makeHass({
      areas: [area('lavanderia', 'Lavanderia')],
      entities: [
        { entity_id: 'binary_sensor.vazamento', area_id: 'lavanderia', state: 'on', attributes: { device_class: 'moisture' } },
        { entity_id: 'binary_sensor.porta', area_id: 'lavanderia', state: 'on', attributes: { device_class: 'door' } },
        { entity_id: 'sensor.temp', area_id: 'lavanderia', state: '22', attributes: { device_class: 'temperature' } },
      ],
    });
    expect(buildHouse(h).alerts[0]!.path).toBe('lavanderia');
    const view = generateDashboard({}, h).views.find((v) => v.path === 'lavanderia')!;
    const room = (view.cards[0] as unknown as { room: { openings: unknown[]; temperature: string | null } }).room;
    expect([room.openings.length, room.temperature]).toEqual([1, 'sensor.temp']);
  });

  it('never says Tudo fechado while a door or window does not answer', async () => {
    const h = makeHass({
      areas: [area('entrada', 'Entrada')],
      entities: [{ entity_id: 'binary_sensor.porta', area_id: 'entrada', name: 'Porta', state: 'unavailable', attributes: { device_class: 'door' } }],
    });
    const house = buildHouse(h);
    const el = document.createElement('hubb-security-screen') as El;
    el.setConfig!({ type: 'custom:hubb-security-screen', security: house.security });
    el.hass = h;
    document.body.appendChild(el);
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.all-closed')).toBeNull();
    expect([...el.shadowRoot!.querySelectorAll('.open-row')].map((r) => r.textContent!.replace(/\s+/g, ' ').trim())).toEqual(['Porta · Entrada · sem leitura']);
  });

  it('keeps the words of the alarm card readable on the red of a triggered alarm', () => {
    const css = (HubbAlarmCard.styles as unknown as { cssText: string }).cssText;
    expect(css).toMatch(/\.card\.triggered \.error\s*\{[^}]*color: inherit/);
    expect(css).toMatch(/\.card\.triggered [^{]*:focus-visible\s*\{[^}]*outline-color: var\(--hubb-alert-ink\)/);
  });

  it('keeps the toast of Home Assistant out, says Código incorreto only for a code refused, and waits before a second command', async () => {
    const h = makeHass({ entities: [{ entity_id: 'alarm_control_panel.alarme', state: 'disarmed', attributes: { supported_features: 3 } }] });
    const asked: unknown[][] = [];
    h.callService = vi.fn((...args: unknown[]) => {
      asked.push(args);
      return Promise.resolve();
    }) as FakeHass['callService'];
    const el = await mount('hubb-alarm-card', { hass: h, item: { entityId: 'alarm_control_panel.alarme', name: 'Alarme' } });
    const arm = () => el.shadowRoot!.querySelector('button.arm') as HTMLButtonElement;
    arm().click();
    await el.updateComplete;
    expect(arm().disabled).toBe(true);
    arm().click();
    expect(asked).toHaveLength(1);
    expect(asked[0]![4]).toBe(false);
    document.body.replaceChildren();
    const armed = makeHass({ entities: [{ entity_id: 'alarm_control_panel.alarme', state: 'armed_away', attributes: { code_format: 'number' } }] });
    armed.callService = vi.fn(() => Promise.reject(new Error('Integration timed out'))) as FakeHass['callService'];
    const card = await mount('hubb-alarm-card', { hass: armed, item: { entityId: 'alarm_control_panel.alarme', name: 'Alarme' } });
    (card.shadowRoot!.querySelector('button.key[data-key="1"]') as HTMLButtonElement).click();
    await card.updateComplete;
    (card.shadowRoot!.querySelector('button.disarm') as HTMLButtonElement).click();
    await flush();
    await card.updateComplete;
    expect(card.shadowRoot!.querySelector('.error')!.textContent!.trim()).toBe('Sem resposta');
  });

  it('keeps the alert strip a button, inside a region that announces it', async () => {
    const h = makeHass({ areas: [area('cozinha', 'Cozinha')], entities: [{ entity_id: 'binary_sensor.fumaca', state: 'on' }] });
    const el = await mount('hubb-status-strips', { hass: h, alerts: [{ entityId: 'binary_sensor.fumaca', kind: 'smoke', roomName: 'Cozinha', path: 'cozinha' }] });
    const button = el.shadowRoot!.querySelector('button.alert')!;
    expect(button.getAttribute('role')).toBeNull();
    expect(button.parentElement!.getAttribute('role')).toBe('alert');
  });

  it('matches the power of a plug that also has a child lock switch', () => {
    const h = makeHass({
      devices: [device('d_p', 'sala', 'Plug')],
      entities: [
        { entity_id: 'switch.plug', device_id: 'd_p', state: 'on' },
        { entity_id: 'switch.plug_child_lock', device_id: 'd_p', state: 'off', entity_category: 'config' },
        { entity_id: 'sensor.plug_w', device_id: 'd_p', state: '5', attributes: { device_class: 'power' } },
      ],
    });
    expect(consumptionOf(h, 'switch.plug').power).toBe('sensor.plug_w');
  });

  it('calls the consumption sheet Consumo under the name of the outlet', async () => {
    const h = makeHass({
      areas: [area('sala', 'Sala')],
      devices: [device('d_t', 'sala', 'Tomada TV')],
      entities: [
        { entity_id: 'switch.tomada', device_id: 'd_t', name: 'TV', state: 'on', attributes: { device_class: 'outlet' } },
        { entity_id: 'sensor.tomada_w', device_id: 'd_t', state: '120', attributes: { device_class: 'power' } },
      ],
    });
    const house = buildHouse(h);
    const el = document.createElement('hubb-room-screen') as El;
    el.setConfig!({ type: 'custom:hubb-room-screen', room: house.rooms[0]!, lightIds: [] });
    el.hass = h;
    document.body.appendChild(el);
    await el.updateComplete;
    el.shadowRoot!.querySelector('hubb-outlet-tile')!.dispatchEvent(new CustomEvent('hubb-open-power', { detail: { entityId: 'switch.tomada' }, bubbles: true, composed: true }));
    await el.updateComplete;
    const sheet = el.shadowRoot!.querySelector('hubb-sheet.device') as HTMLElement & { heading: string; subheading: string };
    expect([sheet.heading, sheet.subheading]).toEqual(['TV', 'Consumo · Sala']);
  });
});
