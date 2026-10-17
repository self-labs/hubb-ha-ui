import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import readme from '../README.md?raw';
import type { HubbToast } from '../src/elements/toast';
import { reviewItems, roomlessSwitches } from '../src/model/review';
import '../src/screens/review-screen';
import type { HubbReviewScreen } from '../src/screens/review-screen';
import { REVIEW, S } from '../src/strings';
import type { HubbConfig } from '../src/model/types';
import { admin, flush } from './helpers/fake-dashboard';
import { area, device, makeHass, type FakeEntity, type FakeHass } from './helpers/fake-hass';

const ROOMS = [area('sala', 'Sala de estar'), area('cozinha', 'Cozinha'), area('quarto', 'Quarto')];

/** A 16-channel board as one device with no area, two of its relays shown as lights, and a light already in the kitchen. */
function board(extra: FakeEntity[] = [], areas = ROOMS): FakeHass {
  return admin(
    makeHass({
      areas,
      devices: [device('d_m1', null, 'Hubb M1'), device('d_adguard', null, 'AdGuard Home')],
      entities: [
        { entity_id: 'light.hubb_m1_output01', device_id: 'd_m1', name: 'Luz', state: 'off' },
        { entity_id: 'light.hubb_m1_output02', device_id: 'd_m1', name: 'Bancada', state: 'off' },
        { entity_id: 'light.teto', area_id: 'cozinha', name: 'Teto', state: 'off' },
        ...extra,
      ],
    }),
  );
}

/** The channels of a board still exposed as switches, the way Tasmota and the KCS firmware bring them. */
const SWITCHES: FakeEntity[] = [
  { entity_id: 'switch.hubb_m1_output10', device_id: 'd_m1', name: 'output10', state: 'off' },
  { entity_id: 'switch.hubb_m1_output03', device_id: 'd_m1', name: 'output03', state: 'off' },
  { entity_id: 'switch.adguard_protecao', device_id: 'd_adguard', name: 'Proteção', state: 'on' },
  { entity_id: 'switch.adguard_log', device_id: 'd_adguard', name: 'Log', state: 'on', entity_category: 'config' },
  { entity_id: 'switch.oculto', device_id: 'd_m1', name: 'Oculto', state: 'off', hidden: true },
  { entity_id: 'switch.solto', name: 'Solto', state: 'off' },
  { entity_id: 'switch.bomba', area_id: 'cozinha', name: 'Bomba', state: 'off' },
];

/** Records the registry writes; `fail` refuses them. */
function withRegistry(h: FakeHass, fail = false): Record<string, unknown>[] {
  const writes: Record<string, unknown>[] = [];
  h.callWS = vi.fn(async (msg: Record<string, unknown>) => {
    if (msg.type === 'config/entity_registry/update') {
      if (fail) throw new Error('timeout');
      writes.push(msg);
      return { entity_entry: {} };
    }
    throw new Error(`unexpected ${String(msg.type)}`);
  }) as FakeHass['callWS'];
  return writes;
}

async function mount(h: FakeHass, options: HubbConfig = {}): Promise<HubbReviewScreen> {
  const el = document.createElement('hubb-review-screen') as HubbReviewScreen;
  el.setConfig({ type: 'custom:hubb-review-screen', options });
  el.hass = h;
  document.body.appendChild(el);
  await flush();
  await el.updateComplete;
  return el;
}

const items = (el: HubbReviewScreen) => [...el.shadowRoot!.querySelectorAll('.item')] as HTMLElement[];
const itemOf = (el: HubbReviewScreen, name: string) => items(el).find((i) => i.querySelector('strong')!.textContent === name)!;
const selectOf = (item: HTMLElement) => item.querySelector('select.room') as HTMLSelectElement;
const moveOf = (item: HTMLElement) => item.querySelector('button.move') as HTMLButtonElement;
const toast = (el: HubbReviewScreen) => el.shadowRoot!.querySelector('hubb-toast') as HubbToast;
const notice = (el: HubbReviewScreen) => el.shadowRoot!.querySelector('.notice')!.textContent;

async function settle(el: HubbReviewScreen): Promise<void> {
  await flush();
  await flush();
  await el.updateComplete;
}

async function pick(el: HubbReviewScreen, item: HTMLElement, value: string): Promise<void> {
  const select = selectOf(item);
  select.value = value;
  select.dispatchEvent(new Event('change'));
  await settle(el);
}

async function move(el: HubbReviewScreen, name: string, value: string): Promise<void> {
  await pick(el, itemOf(el, name), value);
  moveOf(itemOf(el, name)).click();
  await settle(el);
}

describe('choosing the room of an entity in Revisar o painel', () => {
  beforeEach(() => history.replaceState(null, '', '/hubb-casa/revisar'));
  afterEach(() => {
    vi.useRealTimers();
    for (const el of document.querySelectorAll('hubb-review-screen')) (el.shadowRoot?.querySelector('hubb-toast') as HubbToast | null)?.hide();
    document.body.replaceChildren();
  });

  it('offers the rooms of the house, by name, on each item with no room', async () => {
    const el = await mount(board());
    const item = itemOf(el, 'Luz');
    expect(item.querySelector('label')!.textContent!.trim()).toBe('Cômodo');
    expect([...selectOf(item).options].map((o) => o.textContent!.trim())).toEqual(['Escolha o cômodo', 'Cozinha', 'Quarto', 'Sala de estar']);
    expect(selectOf(item).value).toBe('');
    expect(moveOf(item).disabled).toBe(true);
    expect(item.querySelector('.why')!.textContent!.trim()).toBe(REVIEW.noArea);
  });

  it('writes nothing when the room is only chosen: the arrows of a keyboard browse the list', async () => {
    const h = board();
    const writes = withRegistry(h);
    const el = await mount(h);
    await pick(el, itemOf(el, 'Luz'), 'cozinha');
    await pick(el, itemOf(el, 'Luz'), 'quarto');
    expect(writes).toEqual([]);
    expect(selectOf(itemOf(el, 'Luz')).value).toBe('quarto');
    expect(moveOf(itemOf(el, 'Luz')).disabled).toBe(false);
  });

  it('puts only that entity in the room on Mover, never its device, and offers Desfazer', async () => {
    const h = board();
    const writes = withRegistry(h);
    const el = await mount(h);
    await move(el, 'Luz', 'cozinha');
    expect(writes).toEqual([{ type: 'config/entity_registry/update', entity_id: 'light.hubb_m1_output01', area_id: 'cozinha' }]);
    expect(selectOf(itemOf(el, 'Luz')).value).toBe('');
    await toast(el).updateComplete;
    expect(toast(el).shadowRoot!.querySelector('.toast span')!.textContent).toBe('Luz foi para Cozinha.');
    (toast(el).shadowRoot!.querySelector('.toast button') as HTMLButtonElement).click();
    await flush();
    expect(writes[1]).toEqual({ type: 'config/entity_registry/update', entity_id: 'light.hubb_m1_output01', area_id: null });
  });

  it('leaves the list once Home Assistant has the area, and keeps the focus on the list', async () => {
    const h = board();
    withRegistry(h);
    const el = await mount(h);
    await move(el, 'Luz', 'cozinha');
    expect(el.shadowRoot!.activeElement?.tagName).toBe('H2');
    el.hass = { ...h, entities: { ...h.entities, 'light.hubb_m1_output01': { ...h.entities['light.hubb_m1_output01']!, area_id: 'cozinha' } } };
    await settle(el);
    expect(items(el).map((i) => i.querySelector('strong')!.textContent)).not.toContain('Luz');
    expect(selectOf(itemOf(el, 'Bancada')).value).toBe('');
  });

  it('says so when Home Assistant refuses, for longer than a copied line, and moves nothing', async () => {
    const h = board();
    withRegistry(h, true);
    const el = await mount(h);
    await pick(el, itemOf(el, 'Luz'), 'cozinha');
    vi.useFakeTimers();
    moveOf(itemOf(el, 'Luz')).click();
    await vi.advanceTimersByTimeAsync(0);
    await el.updateComplete;
    expect(notice(el)).toBe('Não deu para mudar o cômodo. Confira a conexão e tente de novo.');
    await toast(el).updateComplete;
    expect(toast(el).shadowRoot!.querySelector('.toast')).toBeNull();
    await vi.advanceTimersByTimeAsync(4000);
    await el.updateComplete;
    expect(notice(el)).toBe(REVIEW.areaFailed);
    await vi.advanceTimersByTimeAsync(1100);
    await el.updateComplete;
    expect(notice(el)).toBe('');
  });

  it('says so when the connection has no websocket', async () => {
    const h = board();
    delete h.callWS;
    const el = await mount(h);
    await move(el, 'Luz', 'cozinha');
    expect(notice(el)).toBe(REVIEW.areaFailed);
  });

  it('points to where rooms are made when the house has none', async () => {
    const el = await mount(board([], []));
    const item = itemOf(el, 'Luz');
    expect(selectOf(item)).toBeNull();
    expect(item.querySelector('.place .none')!.textContent!.trim()).toBe('Crie os cômodos em Configurações > Áreas, rótulos e zonas.');
  });

  it('leaves out the rooms the panel hides', async () => {
    const el = await mount(board(), { rooms: { quarto: { hidden: true } } });
    expect([...selectOf(itemOf(el, 'Luz')).options].map((o) => o.textContent!.trim())).toEqual(['Escolha o cômodo', 'Cozinha', 'Sala de estar']);
  });

  it('tells the installer the room goes on the entity, not on the board', () => {
    expect(REVIEW.noArea).toBe('Não aparece no painel porque não está em nenhuma área. Escolha o cômodo abaixo: ele vale só para esta entidade, não para o dispositivo.');
    expect(S.emptyHouseAdmin).toBe(
      'Escolha o cômodo de cada luz ou interruptor em Revisar o painel, ou nas configurações da entidade: dê um nome a ela e desligue "Usar a área do dispositivo".',
    );
    expect(readme).toContain('The room chosen in the editor of an item takes precedence over the area of Home Assistant');
  });
});

describe('the switches with no room, in Revisar o painel', () => {
  beforeEach(() => history.replaceState(null, '', '/hubb-casa/revisar'));
  afterEach(() => {
    for (const el of document.querySelectorAll('hubb-review-screen')) (el.shadowRoot?.querySelector('hubb-toast') as HubbToast | null)?.hide();
    document.body.replaceChildren();
  });

  it('gathers them by device, in channel order, leaving out hidden, configuration and placed switches', () => {
    expect(roomlessSwitches(board(SWITCHES), {})).toEqual([
      { name: 'AdGuard Home', switches: [{ entityId: 'switch.adguard_protecao', name: 'Proteção' }] },
      {
        name: 'Hubb M1',
        switches: [
          { entityId: 'switch.hubb_m1_output03', name: 'output03' },
          { entityId: 'switch.hubb_m1_output10', name: 'output10' },
        ],
      },
      { name: 'Sem dispositivo', switches: [{ entityId: 'switch.solto', name: 'Solto' }] },
    ]);
  });

  it('keeps them out of the number on the key, and behind a button: a house has dozens of system switches', async () => {
    const h = board(SWITCHES);
    const before = reviewItems(board(), {}).length;
    expect(reviewItems(h, {}).length).toBe(before + 1);
    const el = await mount(h);
    expect(items(el).map((i) => i.querySelector('strong')!.textContent)).not.toContain('output03');
    const open = el.shadowRoot!.querySelector('button.quiet') as HTMLButtonElement;
    expect(open.textContent!.trim()).toBe('Mostrar interruptores sem cômodo (4)');
    expect(open.getAttribute('aria-expanded')).toBe('false');
    open.click();
    await settle(el);
    expect(open.getAttribute('aria-expanded')).toBe('true');
    expect([...el.shadowRoot!.querySelectorAll('.quiet-list h3')].map((x) => x.textContent!.trim())).toEqual(['AdGuard Home', 'Hubb M1', 'Sem dispositivo']);
    expect(el.shadowRoot!.querySelector('.quiet-list .hint')!.textContent!.trim()).toBe(REVIEW.quietHint);
  });

  it('puts a channel of the board in a room on Mover, and only that channel', async () => {
    const h = board(SWITCHES);
    const writes = withRegistry(h);
    const el = await mount(h);
    (el.shadowRoot!.querySelector('button.quiet') as HTMLButtonElement).click();
    await settle(el);
    await move(el, 'output03', 'sala');
    expect(writes).toEqual([{ type: 'config/entity_registry/update', entity_id: 'switch.hubb_m1_output03', area_id: 'sala' }]);
    await toast(el).updateComplete;
    expect(toast(el).shadowRoot!.querySelector('.toast span')!.textContent).toBe('output03 foi para Sala de estar.');
  });
});
