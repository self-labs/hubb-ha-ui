import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
  await el.updateComplete;
}

const $$ = (el: HubbReviewScreen, sel: string) => [...el.shadowRoot!.querySelectorAll(sel)];

describe('hubb-review-screen', () => {
  let writeText: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true });
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
  });
  afterEach(() => {
    document.body.replaceChildren();
  });

  it('lists each group with its count and the roles of each item, the suggested one highlighted', async () => {
    const el = await mount(admin(casa2Hass()), LIGHTS_ONLY);
    expect($$(el, 'main h2').map((h) => h.textContent)).toEqual(['Sem papel (1)', 'Aparelhos sugeridos (1)']);
    const roles = [...$$(el, '.item')[0]!.querySelectorAll('.role')];
    expect(roles.map((b) => b.textContent!.trim())).toEqual(['Luz', 'Tomada', 'Equipamento', 'Ocultar']);
    expect(roles.filter((b) => b.classList.contains('suggested')).map((b) => b.textContent!.trim())).toEqual(['Ocultar']);
    expect($$(el, '.item')[0]!.querySelector('.where')!.textContent).toBe('Escritório · switch.jet_mode');
  });

  it('copies the line of a role and says so', async () => {
    const el = await mount(admin(casa2Hass()), CASA2_CONFIG);
    await tap(el, $$(el, '.role').find((b) => b.textContent!.trim() === 'Ocultar')!);
    expect(writeText).toHaveBeenCalledWith('switch.jet_mode: { role: hidden }');
    expect(el.shadowRoot!.querySelector('.notice')!.textContent).toBe('Linha copiada');
  });

  it('copies every suggested role at once with "Copiar tudo"', async () => {
    const el = await mount(admin(casa2Hass()), LIGHTS_ONLY);
    await tap(el, el.shadowRoot!.querySelector('.primary')!);
    expect(writeText).toHaveBeenCalledWith(
      'entities:\n  switch.jet_mode: { role: hidden }\n  sensor.lavadora_appliancestate: { role: appliance }',
    );
    expect(el.shadowRoot!.querySelector('.notice')!.textContent).toBe('Linhas copiadas');
  });

  it('leaves the line on the screen to copy by hand when the device copies nothing', async () => {
    Object.defineProperty(window, 'isSecureContext', { value: false, configurable: true });
    Object.defineProperty(document, 'execCommand', { value: () => false, configurable: true });
    const el = await mount(admin(casa2Hass()), CASA2_CONFIG);
    await tap(el, $$(el, '.role')[0]!);
    expect(el.shadowRoot!.querySelector('.notice')!.textContent).toBe('Copie a linha');
    expect(el.shadowRoot!.querySelector('.manual')!.textContent).toBe('switch.jet_mode: { role: light }');
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
