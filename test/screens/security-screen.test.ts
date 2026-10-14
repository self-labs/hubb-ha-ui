import { afterEach, describe, expect, it } from 'vitest';
import '../../src/screens/security-screen';
import { buildHouse } from '../../src/model/build-house';
import { area, makeHass, type FakeHass } from '../helpers/fake-hass';

function h(camera = 'idle', picture: string | null = '/api/camera_proxy/camera.garagem?token=a'): FakeHass {
  return makeHass({
    areas: [area('quarto', 'Quarto'), area('entrada', 'Entrada')],
    entities: [
      { entity_id: 'alarm_control_panel.alarme', name: 'Alarme', state: 'disarmed', attributes: { supported_features: 3 } },
      { entity_id: 'binary_sensor.janela', area_id: 'quarto', name: 'Janela', state: 'on', attributes: { device_class: 'window' } },
      { entity_id: 'binary_sensor.porta', area_id: 'quarto', name: 'Porta', state: 'off', attributes: { device_class: 'door' } },
      { entity_id: 'cover.portao', area_id: 'entrada', name: 'Portão', state: 'closed', attributes: { device_class: 'gate', supported_features: 3 } },
      { entity_id: 'camera.garagem', name: 'Garagem', state: camera, attributes: picture ? { entity_picture: picture } : {} },
    ],
  });
}

async function mount(hass: FakeHass) {
  const house = buildHouse(hass);
  const el = document.createElement('hubb-security-screen') as HTMLElement & {
    hass: FakeHass;
    setConfig(c: unknown): void;
    updateComplete: Promise<unknown>;
  };
  el.setConfig({ type: 'custom:hubb-security-screen', security: house.security, shared: { alerts: house.alerts, security: true } });
  el.hass = hass;
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}

const headings = (el: Element) => [...el.shadowRoot!.querySelectorAll('main h2')].map((x) => x.textContent);

describe('hubb-security-screen', () => {
  afterEach(() => document.body.replaceChildren());

  it('shows the alarm, what is open, the access and the cameras, in that order', async () => {
    const el = await mount(h());
    expect(headings(el)).toEqual(['Alarme', 'Abertos agora', 'Acesso', 'Câmeras']);
    expect([...el.shadowRoot!.querySelectorAll('.open-row')].map((r) => r.textContent!.replace(/\s+/g, ' ').trim())).toEqual(['Janela · Quarto']);
    expect(el.shadowRoot!.querySelectorAll('hubb-access-tile')).toHaveLength(1);
  });

  it('says Tudo fechado when nothing is open', async () => {
    const hass = h();
    hass.states['binary_sensor.janela']!.state = 'off';
    const el = await mount(hass);
    expect(el.shadowRoot!.querySelector('.all-closed')!.textContent!.trim()).toBe('Tudo fechado');
  });

  it('takes the camera image once and keeps it while the tab stays open', async () => {
    const hass = h();
    const el = await mount(hass);
    const tile = el.shadowRoot!.querySelector('hubb-camera-tile')!;
    await (tile as unknown as { updateComplete: Promise<unknown> }).updateComplete;
    const img = () => tile.shadowRoot!.querySelector('img')!.getAttribute('src');
    expect(img()).toBe('/api/camera_proxy/camera.garagem?token=a');
    const next = { ...hass, states: { ...hass.states, 'camera.garagem': { ...hass.states['camera.garagem']!, attributes: { entity_picture: '/api/camera_proxy/camera.garagem?token=b' } } } };
    (el as unknown as { hass: unknown }).hass = next;
    await el.updateComplete;
    await (tile as unknown as { updateComplete: Promise<unknown> }).updateComplete;
    expect(img()).toBe('/api/camera_proxy/camera.garagem?token=a');
    tile.remove();
    el.shadowRoot!.querySelector('.cameras')!.appendChild(tile);
    await (tile as unknown as { updateComplete: Promise<unknown> }).updateComplete;
    expect(img()).toBe('/api/camera_proxy/camera.garagem?token=b');
  });

  it('shows Sem imagem for a camera that is down or whose image fails, and opens the live view on a tap', async () => {
    const el = await mount(h('unavailable'));
    const tile = el.shadowRoot!.querySelector('hubb-camera-tile')!;
    await (tile as unknown as { updateComplete: Promise<unknown> }).updateComplete;
    expect(tile.shadowRoot!.textContent).toContain('Sem imagem');
    document.body.replaceChildren();
    const ok = await mount(h());
    const t2 = ok.shadowRoot!.querySelector('hubb-camera-tile')!;
    await (t2 as unknown as { updateComplete: Promise<unknown> }).updateComplete;
    t2.shadowRoot!.querySelector('img')!.dispatchEvent(new Event('error'));
    await (t2 as unknown as { updateComplete: Promise<unknown> }).updateComplete;
    expect(t2.shadowRoot!.querySelector('img')).toBeNull();
    expect(t2.shadowRoot!.textContent).toContain('Sem imagem');
    let opened: unknown = null;
    ok.addEventListener('hass-more-info', (e) => (opened = (e as CustomEvent).detail));
    (t2.shadowRoot!.querySelector('button') as HTMLButtonElement).click();
    expect(opened).toEqual({ entityId: 'camera.garagem' });
  });
});
