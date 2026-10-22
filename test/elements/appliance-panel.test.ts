import { afterEach, describe, expect, it, vi } from 'vitest';
import type { HubbActionButton } from '../../src/elements/action-button';
import '../../src/elements/appliance-panel';
import type { HubbAppliancePanel } from '../../src/elements/appliance-panel';
import type { HubbEquipmentTile } from '../../src/elements/equipment-tile';
import { buildHouse } from '../../src/model/build-house';
import type { ApplianceItem } from '../../src/model/appliances';
import { CASA2_CONFIG, casa2Hass } from '../fixtures/casa-exemplo-2';
import { withState, type FakeHass } from '../helpers/fake-hass';

const washer = (h: FakeHass): ApplianceItem => buildHouse(h, CASA2_CONFIG).rooms.find((r) => r.areaId === 'terraco')!.appliances[0]!;

const PT: Record<string, string> = { colors: 'Cores', normal: 'Normal', whites: 'Brancas', quick: 'Rápido', low: 'Baixo', medium: 'Médio', high: 'Alto', Running: 'Lavando' };

function translated(state = 'Running', minutes = '40'): FakeHass {
  const h = casa2Hass(state, minutes);
  h.formatEntityState = (st, s) => PT[s ?? st.state] ?? s ?? st.state;
  return h;
}

async function mount(hass: FakeHass): Promise<HubbAppliancePanel> {
  const el = document.createElement('hubb-appliance-panel') as HubbAppliancePanel;
  el.hass = hass;
  el.item = washer(hass);
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}

const $ = (el: HubbAppliancePanel, sel: string) => el.shadowRoot!.querySelector(sel);
const labels = (el: HubbAppliancePanel, sel: string) =>
  [...el.shadowRoot!.querySelectorAll(sel)].map((b) => (b as HubbActionButton).item!.name);
const rows = (el: HubbAppliancePanel) =>
  [...el.shadowRoot!.querySelectorAll('.choice')].map((r) => [r.querySelector('.name')!.textContent, r.querySelector('.value')!.textContent]);

describe('hubb-appliance-panel', () => {
  afterEach(() => {
    vi.useRealTimers();
    document.body.replaceChildren();
  });

  it('shows how long is left in large, the state under it, and the commands that make sense now', async () => {
    const el = await mount(translated('Running', '40'));
    expect($(el, '.now strong')!.textContent).toBe('40 min para terminar');
    expect($(el, '.now span')!.textContent).toBe('Lavando');
    expect(labels(el, '.commands hubb-action-button')).toEqual(['Pausar', 'Desligar', 'Parar']);
  });

  it('offers Iniciar and Desligar while stopped and switched on, with the state in large', async () => {
    const el = await mount(casa2Hass('End Of Cycle', '0'));
    expect($(el, '.now strong')!.textContent).toBe('Ciclo concluído');
    expect($(el, '.now span')).toBeNull();
    expect(labels(el, '.commands hubb-action-button')).toEqual(['Iniciar', 'Desligar', 'Parar']);
  });

  it('reads Idle as switched off: Ligar and Iniciar, and Iniciar switches it on first', async () => {
    vi.useFakeTimers();
    const idle = casa2Hass('Idle', '80');
    const el = await mount(idle);
    expect($(el, '.now strong')!.textContent).toBe('Desligada');
    expect(labels(el, '.commands hubb-action-button')).toEqual(['Ligar', 'Iniciar', 'Parar']);
    const start = el.shadowRoot!.querySelectorAll('.commands hubb-action-button')[1] as HubbActionButton;
    await start.updateComplete;
    (start.shadowRoot!.querySelector('button') as HTMLButtonElement).click();
    await vi.advanceTimersByTimeAsync(1000);
    expect(idle.calls.map((c) => c.target)).toEqual([{ entity_id: 'button.lavadora_executecommand_2' }]);
    el.hass = withState(idle, 'sensor.lavadora_appliancestate', 'Ready To Start');
    await vi.advanceTimersByTimeAsync(500);
    expect(idle.calls.map((c) => c.target)).toEqual([
      { entity_id: 'button.lavadora_executecommand_2' },
      { entity_id: 'button.lavadora_executecommand_5' },
    ]);
  });

  it('lists the choices with their translated options, and leaves out the unknown one', async () => {
    const el = await mount(translated());
    expect(rows(el)).toEqual([
      ['Programa', 'Cores'],
      ['Nível de roupas', 'Alto'],
    ]);
    const select = $(el, '.choice select') as HTMLSelectElement;
    expect([...select.options].map((o) => o.textContent)).toEqual(['Normal', 'Cores', 'Brancas', 'Rápido']);
  });

  it('picks an option with select.select_option and shows it at once', async () => {
    const h = translated();
    const el = await mount(h);
    const select = $(el, '.choice select') as HTMLSelectElement;
    select.value = 'whites';
    select.dispatchEvent(new Event('change'));
    await el.updateComplete;
    expect(h.calls).toEqual([{ domain: 'select', service: 'select_option', data: { option: 'whites' }, target: { entity_id: 'select.lavadora_programid' } }]);
    expect(rows(el)[0]).toEqual(['Programa', 'Brancas']);
  });

  it('says Sem resposta when the choice is not confirmed in 3 s', async () => {
    vi.useFakeTimers();
    const el = await mount(translated());
    const select = $(el, '.choice select') as HTMLSelectElement;
    select.value = 'quick';
    select.dispatchEvent(new Event('change'));
    await el.updateComplete;
    await vi.advanceTimersByTimeAsync(3100);
    await el.updateComplete;
    expect(rows(el)[0]).toEqual(['Programa', 'Sem resposta']);
  });

  it('shows the options the program takes and leaves out the unavailable one', async () => {
    const el = await mount(translated());
    const names = [...el.shadowRoot!.querySelectorAll('.options hubb-equipment-tile')].map((t) => (t as HubbEquipmentTile).item!.name);
    expect(names).toEqual(['Enxágue extra', 'Turbo centrifugação', 'Reuso de água']);
  });

  it('offers Ligar and Iniciar to a washer that is switched off, and Iniciar and Desligar once it waits switched on', async () => {
    const ready = await mount(casa2Hass('Ready To Start', '80'));
    expect(labels(ready, '.commands hubb-action-button')).toEqual(['Iniciar', 'Desligar', 'Parar']);
    document.body.replaceChildren();
    const off = await mount(casa2Hass('Off', '0'));
    expect(labels(off, '.commands hubb-action-button')).toEqual(['Ligar', 'Iniciar', 'Parar']);
  });

  it('takes back a choice: picking the current option while another waits sends it', async () => {
    const h = translated();
    const el = await mount(h);
    const select = $(el, '.choice select') as HTMLSelectElement;
    select.value = 'whites';
    select.dispatchEvent(new Event('change'));
    await el.updateComplete;
    select.value = 'colors';
    select.dispatchEvent(new Event('change'));
    await el.updateComplete;
    expect(h.calls.map((c) => c.data)).toEqual([{ option: 'whites' }, { option: 'colors' }]);
    expect(rows(el)[0]).toEqual(['Programa', 'Cores']);
  });

  it('keeps the list on the option Home Assistant reports after a change made elsewhere', async () => {
    const h = translated();
    const el = await mount(h);
    const select = $(el, '.choice select') as HTMLSelectElement;
    select.value = 'whites';
    select.dispatchEvent(new Event('change'));
    el.hass = withState(h, 'select.lavadora_programid', 'whites');
    await el.updateComplete;
    el.hass = withState(h, 'select.lavadora_programid', 'quick');
    await el.updateComplete;
    expect(select.value).toBe('quick');
    expect(rows(el)[0]).toEqual(['Programa', 'Rápido']);
  });

  it('puts the commands on one row, with as many columns as buttons, up to three', async () => {
    const el = await mount(casa2Hass('Running', '40'));
    expect(($(el, '.commands') as HTMLElement).getAttribute('style')).toContain('repeat(3, minmax(0, 1fr))');
    expect(el.shadowRoot!.querySelector('.more')).toBeNull();
  });
});
