import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { HubbToast } from '../../src/elements/toast';
import '../../src/screens/review-screen';
import type { HubbReviewScreen } from '../../src/screens/review-screen';
import type { HubbConfig } from '../../src/model/types';
import { CASA2_CONFIG, casa2Hass } from '../fixtures/casa-exemplo-2';
import type { FakeHass } from '../helpers/fake-hass';

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const LIGHTS_ONLY: HubbConfig = { entities: { 'switch.escritorio_luz': { role: 'light' }, 'switch.varanda_luz': { role: 'light' } } };

function admin(h: FakeHass): FakeHass {
  h.user = { id: 'u1', name: 'Gustavo Exemplo', is_admin: true };
  return h;
}

/** Gives `h` a saved dashboard; every save replaces it, the way Home Assistant does. */
function withDashboard(h: FakeHass, saved: Record<string, unknown>, failSave = false): Record<string, unknown>[] {
  const saves: Record<string, unknown>[] = [];
  let current = saved;
  h.callWS = vi.fn(async (msg: Record<string, unknown>) => {
    if (msg.type === 'lovelace/config') return structuredClone(current);
    if (msg.type === 'lovelace/config/save') {
      if (failSave) throw new Error('Unauthorized');
      current = msg.config as Record<string, unknown>;
      saves.push(current);
      return null;
    }
    throw new Error(`unexpected ${String(msg.type)}`);
  }) as FakeHass['callWS'];
  return saves;
}

async function mount(h: FakeHass, options: HubbConfig): Promise<HubbReviewScreen> {
  const el = document.createElement('hubb-review-screen') as HubbReviewScreen;
  el.setConfig({ type: 'custom:hubb-review-screen', options });
  el.hass = h;
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}

async function tap(el: HubbReviewScreen, button: Element): Promise<void> {
  (button as HTMLButtonElement).click();
  await flush();
  await flush();
  await el.updateComplete;
}

const $$ = (el: HubbReviewScreen, sel: string) => [...el.shadowRoot!.querySelectorAll(sel)];
const roleButton = (el: HubbReviewScreen, label: string) => $$(el, '.role').find((b) => b.textContent!.trim() === label)!;
const entitiesOf = (saved: Record<string, unknown>) => (saved.strategy as HubbConfig).entities;

describe('hubb-review-screen', () => {
  let writeText: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    history.replaceState(null, '', '/hubb-casa/revisar');
    writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true });
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
  });
  afterEach(() => {
    (document.querySelector('hubb-review-screen')?.shadowRoot?.querySelector('hubb-toast') as HubbToast | null)?.hide();
    document.body.replaceChildren();
  });

  it('lists each group with its count and the roles of each item, the suggested one highlighted', async () => {
    const el = await mount(admin(casa2Hass()), LIGHTS_ONLY);
    expect($$(el, 'main h2').map((h) => h.textContent)).toEqual(['Escolha como mostrar (1)', 'Aparelhos encontrados (1)']);
    const roles = [...$$(el, '.item')[0]!.querySelectorAll('.role')];
    expect(roles.map((b) => b.textContent!.trim())).toEqual(['Luz', 'Tomada', 'Equipamento', 'Portão', 'Não mostrar']);
    expect(roles.filter((b) => b.classList.contains('suggested')).map((b) => b.textContent!.trim())).toEqual(['Não mostrar']);
    expect($$(el, '.item')[0]!.querySelector('.where')!.textContent).toBe('Escritório · switch.jet_mode');
  });

  it('saves the role tapped into the dashboard, and Desfazer takes it back out', async () => {
    const h = admin(casa2Hass());
    const saves = withDashboard(h, { strategy: { type: 'custom:hubb', ...CASA2_CONFIG } });
    const el = await mount(h, CASA2_CONFIG);
    await tap(el, roleButton(el, 'Não mostrar'));
    expect(saves).toHaveLength(1);
    expect(entitiesOf(saves[0]!)).toEqual({ ...CASA2_CONFIG.entities, 'switch.jet_mode': { role: 'hidden' } });
    expect(writeText).not.toHaveBeenCalled();
    const toast = el.shadowRoot!.querySelector('hubb-toast') as HubbToast;
    await toast.updateComplete;
    expect(toast.shadowRoot!.querySelector('.toast')!.textContent).toContain('Jet mode não aparece mais no painel.');
    (toast.shadowRoot!.querySelector('.toast button') as HTMLButtonElement).click();
    await flush();
    await flush();
    expect(saves).toHaveLength(2);
    expect(entitiesOf(saves[1]!)).toEqual(CASA2_CONFIG.entities);
  });

  it('takes the item out of the list as soon as it is saved, without waiting for Home Assistant to rebuild, and Desfazer brings it back', async () => {
    const h = admin(casa2Hass());
    withDashboard(h, { strategy: { type: 'custom:hubb', ...CASA2_CONFIG } });
    const el = await mount(h, CASA2_CONFIG);
    const listed = () => $$(el, '.item .where').some((w) => w.textContent!.includes('switch.jet_mode'));
    expect(listed()).toBe(true);
    await tap(el, roleButton(el, 'Não mostrar'));
    expect(listed()).toBe(false);
    const toast = el.shadowRoot!.querySelector('hubb-toast') as HubbToast;
    await toast.updateComplete;
    (toast.shadowRoot!.querySelector('.toast button') as HTMLButtonElement).click();
    await flush();
    await flush();
    await el.updateComplete;
    expect(listed()).toBe(true);
  });

  it('saves every suggestion at once with "Aceitar todas as sugestões", and says how many', async () => {
    const h = admin(casa2Hass());
    const saves = withDashboard(h, { strategy: { type: 'custom:hubb', ...LIGHTS_ONLY } });
    const el = await mount(h, LIGHTS_ONLY);
    const apply = el.shadowRoot!.querySelector('.primary')!;
    expect(apply.textContent!.trim()).toBe('Aceitar todas as sugestões');
    await tap(el, apply);
    expect(entitiesOf(saves[0]!)).toEqual({
      ...LIGHTS_ONLY.entities,
      'switch.jet_mode': { role: 'hidden' },
      'sensor.lavadora_appliancestate': { role: 'appliance' },
    });
    const toast = el.shadowRoot!.querySelector('hubb-toast') as HubbToast;
    await toast.updateComplete;
    expect(toast.shadowRoot!.querySelector('.toast')!.textContent).toContain('2 itens salvos.');
  });

  it('says what a role does when it is saved', async () => {
    const h = admin(casa2Hass());
    withDashboard(h, { strategy: { type: 'custom:hubb', ...CASA2_CONFIG } });
    const el = await mount(h, CASA2_CONFIG);
    await tap(el, roleButton(el, 'Luz'));
    const toast = el.shadowRoot!.querySelector('hubb-toast') as HubbToast;
    await toast.updateComplete;
    expect(toast.shadowRoot!.querySelector('.toast')!.textContent).toContain('Jet mode agora aparece como Luz.');
  });

  it('copies the line instead when the dashboard is no longer a hubb strategy ("Take control")', async () => {
    const h = admin(casa2Hass());
    const saves = withDashboard(h, { views: [{ title: 'Casa' }] });
    const el = await mount(h, CASA2_CONFIG);
    await tap(el, roleButton(el, 'Não mostrar'));
    expect(saves).toEqual([]);
    expect(writeText).toHaveBeenCalledWith('switch.jet_mode: { role: hidden }');
    expect(el.shadowRoot!.querySelector('.notice')!.textContent).toBe('Não deu para salvar aqui. A linha foi copiada: cole no YAML do painel.');
  });

  it('copies the line instead when Home Assistant refuses the save', async () => {
    const h = admin(casa2Hass());
    withDashboard(h, { strategy: { type: 'custom:hubb', ...CASA2_CONFIG } }, true);
    const el = await mount(h, CASA2_CONFIG);
    await tap(el, roleButton(el, 'Luz'));
    expect(writeText).toHaveBeenCalledWith('switch.jet_mode: { role: light }');
    expect(el.shadowRoot!.querySelector('.notice')!.textContent).toBe('Não deu para salvar aqui. A linha foi copiada: cole no YAML do painel.');
  });

  it('copies every suggested line when it cannot save them', async () => {
    const el = await mount(admin(casa2Hass()), LIGHTS_ONLY);
    await tap(el, el.shadowRoot!.querySelector('.primary')!);
    expect(writeText).toHaveBeenCalledWith(
      'entities:\n  switch.jet_mode: { role: hidden }\n  sensor.lavadora_appliancestate: { role: appliance }',
    );
    expect(el.shadowRoot!.querySelector('.notice')!.textContent).toBe('Não deu para salvar aqui. As linhas foram copiadas: cole no YAML do painel.');
  });

  it('leaves the line on the screen to copy by hand when it can neither save nor copy', async () => {
    Object.defineProperty(window, 'isSecureContext', { value: false, configurable: true });
    Object.defineProperty(document, 'execCommand', { value: () => false, configurable: true });
    const el = await mount(admin(casa2Hass()), CASA2_CONFIG);
    await tap(el, $$(el, '.role')[0]!);
    expect(el.shadowRoot!.querySelector('.notice')!.textContent).toBe('Não deu para salvar nem copiar. Copie a linha abaixo e cole no YAML do painel.');
    expect(el.shadowRoot!.querySelector('.manual')!.textContent).toBe('switch.jet_mode: { role: light }');
  });

  it('takes a wrong line out of the YAML with Remover, and Desfazer puts it back', async () => {
    const h = admin(casa2Hass());
    const options: HubbConfig = { ...CASA2_CONFIG, entities: { ...CASA2_CONFIG.entities, 'camera.frente_av_hd': { name: 'Frente' } } };
    const saves = withDashboard(h, { strategy: { type: 'custom:hubb', ...options } });
    const el = await mount(h, options);
    const errors = () => $$(el, '.item').filter((i) => i.querySelector('strong')!.textContent === 'entities.camera.frente_av_hd');
    expect(errors()).toHaveLength(1);
    await tap(el, errors()[0]!.querySelector('.drop')!);
    expect(entitiesOf(saves[0]!)).toEqual(CASA2_CONFIG.entities);
    await el.updateComplete;
    expect(errors()).toHaveLength(0);
    const toast = el.shadowRoot!.querySelector('hubb-toast') as HubbToast;
    await toast.updateComplete;
    expect(toast.shadowRoot!.querySelector('.toast')!.textContent).toContain('entities.camera.frente_av_hd saiu do YAML do painel.');
    (toast.shadowRoot!.querySelector('.toast button') as HTMLButtonElement).click();
    await flush();
    await flush();
    expect(entitiesOf(saves[1]!)).toEqual(options.entities);
  });

  it('takes every wrong line out at once with "Remover todos", in one save', async () => {
    const h = admin(casa2Hass());
    const options: HubbConfig = {
      ...CASA2_CONFIG,
      house_power: 'sensor.sumiu',
      entities: { ...CASA2_CONFIG.entities, 'camera.frente_av_hd': {}, 'script.desligar_casa': { role: 'action' } },
    };
    const saves = withDashboard(h, { strategy: { type: 'custom:hubb', ...options } });
    const el = await mount(h, options);
    const all = el.shadowRoot!.querySelector('.drop-all')!;
    expect(all.textContent!.trim()).toBe('Remover todos (3)');
    await tap(el, all);
    expect(saves).toHaveLength(1);
    expect(saves[0]!.strategy).toEqual({ type: 'custom:hubb', ...CASA2_CONFIG });
    expect(el.shadowRoot!.querySelector('#group-config')).toBeNull();
  });

  it('says what to delete by hand when it cannot remove the line', async () => {
    const h = admin(casa2Hass());
    const options: HubbConfig = { ...CASA2_CONFIG, house_power: 'sensor.sumiu' };
    withDashboard(h, { strategy: { type: 'custom:hubb', ...options } }, true);
    const el = await mount(h, options);
    await tap(el, el.shadowRoot!.querySelector('.item .drop')!);
    expect(el.shadowRoot!.querySelector('.notice')!.textContent).toBe('Não deu para remover aqui. Apague house_power no YAML do painel.');
  });

  it('says there is nothing to review', async () => {
    const el = await mount(admin(casa2Hass()), { entities: { ...CASA2_CONFIG.entities, 'switch.jet_mode': { role: 'hidden' } } });
    expect(el.shadowRoot!.querySelector('.empty')!.textContent!.trim()).toBe('Nada para revisar.');
    expect(el.shadowRoot!.querySelector('.primary')).toBeNull();
  });

  it('shows nothing of the house to someone who is not an administrator', async () => {
    const el = await mount(casa2Hass(), CASA2_CONFIG);
    expect(el.shadowRoot!.querySelector('.hero p')!.textContent).toBe('Só administradores veem esta tela.');
    expect($$(el, '.item')).toHaveLength(0);
  });
});
