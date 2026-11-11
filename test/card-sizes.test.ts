import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setEditing } from '../src/editing';
import '../src/elements/item-editor';
import { HubbCoverTile } from '../src/elements/cover-tile';
import { HubbLightTile } from '../src/elements/light-tile';
import { HubbSensorTile } from '../src/elements/sensor-tile';
import type { HubbToast } from '../src/elements/toast';
import { reportArea, resetLayoutForTests } from '../src/layout';
import { allLightIds, buildHouse } from '../src/model/build-house';
import { COLUMNS, defaultSize, LONG_NAME, rowSpans, sizeOf, spanOf, type Size, type SizedKind } from '../src/model/sizes';
import type { HubbConfig } from '../src/model/types';
import '../src/screens/room-screen';
import { admin, flush } from './helpers/fake-dashboard';
import { area, makeHass, type FakeHass } from './helpers/fake-hass';

const cssOf = (styles: unknown): string => ([] as unknown[]).concat(styles).map((s) => (s as { cssText: string }).cssText).join('\n');
const LONG = 'Tela tensionada da entrada';

describe('the size of a card on a phone', () => {
  it('stays a third of a row while the name fits one, and 22 characters fit', () => {
    expect(LONG_NAME).toBe(22);
    expect([defaultSize('light', 'phone', 'Teto'), defaultSize('light', 'phone', 'x'.repeat(22)), defaultSize('light', 'phone')]).toEqual(['small', 'small', 'small']);
  });

  it('is half a row for a name past 22 characters, and only for that card', () => {
    const names = ['Teto', LONG, 'Abajur'];
    expect(names.map((n) => sizeOf({}, `light.${n}`, 'light', 'phone', n))).toEqual(['small', 'medium', 'small']);
    expect(defaultSize('light', 'phone', 'x'.repeat(23))).toBe('medium');
  });

  it('applies to the covers, the sensors and the actions as it does to the lights', () => {
    const kinds: SizedKind[] = ['cover', 'action', 'outlet', 'equipment', 'fan', 'door', 'window', 'garage_door', 'presence', 'temperature', 'humidity'];
    expect(kinds.map((k) => defaultSize(k, 'phone', LONG))).toEqual(kinds.map(() => 'medium'));
  });

  it('keeps what the installer chose: the choice wins over the name', () => {
    const options = { entities: { 'light.a': { size: 'small' }, 'light.b': { size: 'large' } } } as HubbConfig;
    expect([sizeOf(options, 'light.a', 'light', 'phone', LONG), sizeOf(options, 'light.b', 'light', 'phone', 'Teto')]).toEqual(['small', 'large']);
  });

  it('does not move the cards that are always the whole row, nor the scenes', () => {
    expect(['climate', 'media', 'gate', 'lock', 'appliance'].map((k) => defaultSize(k as SizedKind, 'phone', LONG))).toEqual(Array(5).fill('large'));
    expect([defaultSize('scene', 'phone', LONG), defaultSize('scene', 'roomy', LONG)]).toEqual(['medium', 'small']);
  });

  it('is not touched on a tablet, where a third of a row has room for the name', () => {
    expect((['roomy', 'wide'] as const).map((layout) => defaultSize('light', layout, LONG))).toEqual(['small', 'small']);
  });
});

describe('filling the rows of a phone', () => {
  const S: Size = 'small';
  const M: Size = 'medium';
  const L: Size = 'large';

  it('gives the sixth that a long name left to the last card of the row, and the third that it pushed down too', () => {
    expect(rowSpans([S, M, S])).toEqual([2, 4, 2]);
    expect(rowSpans([M, S, S])).toEqual([3, 3, 2]);
    expect(rowSpans([S, S, M])).toEqual([2, 4, 3]);
  });

  it('leaves alone a full row, the last row and a row of one card', () => {
    expect(rowSpans([S, S, S])).toEqual([2, 2, 2]);
    expect(rowSpans([M, M])).toEqual([3, 3]);
    expect(rowSpans([S, S, S, S])).toEqual([2, 2, 2, 2]);
    expect(rowSpans([S, L, S])).toEqual([2, 6, 2]);
    expect(rowSpans([M])).toEqual([3]);
    expect(rowSpans([])).toEqual([]);
  });

  it('fills the row that ends before a card of the whole row', () => {
    expect(rowSpans([S, S, L])).toEqual([2, 4, 6]);
  });

  it('leaves no hole between rows for any run of up to seven cards, and keeps their order', () => {
    const all: Size[][] = [[]];
    for (let n = 0; n < 7; n++) for (const run of all.filter((r) => r.length === n)) for (const size of [S, M, L]) all.push([...run, size]);
    const rowsOf = (spans: readonly number[]): number[][] => {
      const rows: number[][] = [];
      let used = COLUMNS;
      for (const span of spans) {
        if (used + span > COLUMNS) rows.push([]), (used = 0);
        rows[rows.length - 1]!.push(span);
        used += span;
      }
      return rows;
    };
    for (const run of all) {
      const spans = rowSpans(run);
      expect(spans, run.join()).toHaveLength(run.length);
      expect(rowsOf(spans).length, run.join()).toBe(rowsOf(run.map(spanOf)).length);
      for (const [i, row] of rowsOf(spans).entries()) {
        const last = i === rowsOf(spans).length - 1;
        if (!last && row.length > 1) expect(row.reduce((a, b) => a + b, 0), run.join()).toBe(COLUMNS);
      }
      for (const [i, span] of spans.entries()) expect([spanOf(run[i]!), 3, 4].includes(span), run.join()).toBe(true);
    }
  });
});

function sala(): FakeHass {
  return admin(
    makeHass({
      areas: [area('sala', 'Sala')],
      entities: [
        { entity_id: 'light.teto', area_id: 'sala', name: 'Teto', state: 'off' },
        { entity_id: 'light.tela', area_id: 'sala', name: LONG, state: 'off' },
        { entity_id: 'light.abajur', area_id: 'sala', name: 'Abajur', state: 'off' },
        { entity_id: 'switch.tv', area_id: 'sala', name: 'Televisão', state: 'off' },
        { entity_id: 'switch.cafeteira', area_id: 'sala', name: 'Cafeteira da bancada longa', state: 'off' },
        { entity_id: 'cover.cortina', area_id: 'sala', name: 'Cortina da varanda gourmet', state: 'closed' },
        { entity_id: 'cover.persiana', area_id: 'sala', name: 'Persiana', state: 'closed' },
        { entity_id: 'binary_sensor.porta', area_id: 'sala', name: 'Porta da varanda gourmet', state: 'off', attributes: { device_class: 'door' } },
        { entity_id: 'binary_sensor.janela', area_id: 'sala', name: 'Janela', state: 'off', attributes: { device_class: 'window' } },
        { entity_id: 'button.toldo', area_id: 'sala', name: 'Recolher o toldo da varanda', state: 'unknown' },
        { entity_id: 'button.luz', area_id: 'sala', name: 'Luz', state: 'unknown' },
      ],
    }),
  );
}
const ROLES = { 'switch.tv': { role: 'outlet' }, 'switch.cafeteira': { role: 'equipment' }, 'button.toldo': { role: 'action' }, 'button.luz': { role: 'action' } };
type Screen = HTMLElement & { hass: FakeHass; setConfig(c: unknown): void; updateComplete: Promise<unknown> };
async function room(h: FakeHass, options: HubbConfig): Promise<Screen> {
  const house = buildHouse(h, options);
  const el = document.createElement('hubb-room-screen') as Screen;
  el.setConfig({ type: 'custom:hubb-room-screen', room: house.rooms[0]!, lightIds: allLightIds(house), options });
  el.hass = h;
  document.body.appendChild(el);
  await flush();
  await el.updateComplete;
  return el;
}
const sizeClass = (el: Element) => [...el.classList].find((c) => c.startsWith('size-'));
/** The size class of each card that matches, by the name it shows. */
const sizesByName = (el: Element, selector: string): Record<string, string | undefined> =>
  Object.fromEntries([...el.shadowRoot!.querySelectorAll(selector)].map((t) => [(t as unknown as { item: { name: string } }).item.name, sizeClass(t)]));

describe('the room screen on a phone', () => {
  beforeEach(() => history.replaceState(null, '', '/hubb-ui/sala'));
  afterEach(() => {
    setEditing(false);
    resetLayoutForTests();
    for (const el of document.querySelectorAll('hubb-room-screen')) (el.shadowRoot?.querySelector('hubb-toast') as HubbToast | null)?.hide();
    document.body.replaceChildren();
  });

  it('draws only the light with a long name half a row, the others a third', async () => {
    const el = await room(sala(), {});
    expect(sizesByName(el, 'hubb-light-tile')).toEqual({ Teto: 'size-small', [LONG]: 'size-medium', Abajur: 'size-small' });
  });

  it('does the same for the outlets, the equipment, the curtains, the sensors and the actions', async () => {
    const el = await room(sala(), { entities: ROLES } as HubbConfig);
    expect(sizesByName(el, 'hubb-outlet-tile')).toEqual({ Televisão: 'size-small' });
    expect(sizesByName(el, 'hubb-equipment-tile')).toEqual({ 'Cafeteira da bancada longa': 'size-medium' });
    expect(sizesByName(el, 'hubb-cover-tile')).toEqual({ 'Cortina da varanda gourmet': 'size-medium', Persiana: 'size-small' });
    expect(sizesByName(el, 'hubb-sensor-tile')).toEqual({ 'Porta da varanda gourmet': 'size-medium', Janela: 'size-small' });
    expect(sizesByName(el, 'hubb-action-button')).toEqual({ 'Recolher o toldo da varanda': 'size-medium', Luz: 'size-small' });
  });

  it('keeps the size the installer chose for a card', async () => {
    const el = await room(sala(), { entities: { 'light.tela': { size: 'small' }, 'light.abajur': { size: 'large' } } } as HubbConfig);
    expect(sizesByName(el, 'hubb-light-tile')).toEqual({ Teto: 'size-small', [LONG]: 'size-small', Abajur: 'size-large' });
  });

  it('makes the long card take the sixth that was left beside a third, so the row has no hole', async () => {
    const el = await room(sala(), { entities: ROLES } as HubbConfig);
    const classesOf = (selector: string) =>
      Object.fromEntries(
        [...el.shadowRoot!.querySelectorAll(selector)].map((t) => [(t as unknown as { item: { name: string } }).item.name, [...t.classList].filter((c) => /^(size|span)-/.test(c)).join(' ')]),
      );
    // Teto + the long one fill five of six columns and Abajur goes down: the long one takes the sixth.
    expect(classesOf('hubb-light-tile')).toEqual({ Teto: 'size-small', [LONG]: 'size-medium span-4', Abajur: 'size-small' });
    // The outlets and the equipment are one grid, and its last row stays as it is: a third and half a row.
    expect(classesOf('hubb-outlet-tile')).toEqual({ Televisão: 'size-small' });
    expect(classesOf('hubb-equipment-tile')).toEqual({ 'Cafeteira da bancada longa': 'size-medium' });
  });

  it('draws the same fill in the edit mode', async () => {
    setEditing(true);
    const el = await room(sala(), {});
    const tiles = [...el.shadowRoot!.querySelectorAll('.edit-tile')].filter((t) => t.querySelector('.name')?.textContent === LONG);
    expect(tiles.map((t) => t.className)).toEqual(['edit-tile size-medium span-4']);
  });

  it('leaves everything a third of a row on a tablet', async () => {
    reportArea({ left: 0, top: 0, width: 700, height: 900 }, 900);
    const el = await room(sala(), { entities: ROLES } as HubbConfig);
    const all = ['hubb-light-tile', 'hubb-cover-tile', 'hubb-sensor-tile', 'hubb-action-button'].flatMap((s) => Object.values(sizesByName(el, s)));
    expect(new Set(all)).toEqual(new Set(['size-small']));
    // No fill either: the rows of twelve columns are the ones the installer sees.
    expect(el.shadowRoot!.querySelector('[class*="span-"]')).toBeNull();
  });

  it('shows the installer the same sizes in the edit mode, and tells the editor what a card is by itself', async () => {
    setEditing(true);
    const el = await room(sala(), { entities: { 'light.tela': { size: 'small' } } } as HubbConfig);
    const tiles = [...el.shadowRoot!.querySelectorAll('.edit-tile')].filter((t) => t.querySelector('.name')?.textContent === LONG);
    // The long one chosen small: it is drawn small; the editor still hears "medium" for it.
    expect(tiles.map(sizeClass)).toEqual(['size-small']);
    (tiles[0] as HTMLButtonElement).click();
    await el.updateComplete;
    const editor = el.shadowRoot!.querySelector('hubb-item-editor') as HTMLElement & { item: { autoSize?: string } };
    expect(editor.item.autoSize).toBe('medium');
  });
});

describe('the editor of a card that went half a row by its name', () => {
  type Editor = HTMLElement & { hass: FakeHass; item: unknown; roomAreaId: string; settings: unknown; updateComplete: Promise<unknown> };
  async function open(settings: unknown): Promise<Editor> {
    const editor = document.createElement('hubb-item-editor') as Editor;
    editor.hass = sala();
    editor.item = { entityId: 'light.tela', name: LONG, kind: 'light', siblings: ['light.teto', 'light.tela'], autoSize: 'medium' };
    editor.roomAreaId = 'sala';
    editor.settings = settings;
    document.body.appendChild(editor);
    await editor.updateComplete;
    return editor;
  }
  const pressed = (e: Editor) => [...e.shadowRoot!.querySelectorAll('button.size')].map((b) => b.getAttribute('aria-pressed'));
  afterEach(() => document.body.replaceChildren());

  it('marks Médio, and saves Pequeno as a choice instead of dropping it as the default', async () => {
    const editor = await open(undefined);
    expect(pressed(editor)).toEqual(['false', 'true', 'false']);
    let asked: unknown = null;
    editor.addEventListener('hubb-edit', (e) => (asked = (e as CustomEvent).detail));
    (editor.shadowRoot!.querySelectorAll('button.size')[0] as HTMLButtonElement).click();
    expect(asked).toMatchObject({ patch: { size: 'small' } });
  });

  it('marks the size the installer chose, and gives the automatic one back by writing nothing', async () => {
    const editor = await open({ size: 'small' });
    expect(pressed(editor)).toEqual(['true', 'false', 'false']);
    let asked: { patch?: Record<string, unknown> } | null = null;
    editor.addEventListener('hubb-edit', (e) => (asked = (e as CustomEvent).detail));
    (editor.shadowRoot!.querySelectorAll('button.size')[1] as HTMLButtonElement).click();
    expect(asked!.patch).toEqual({ size: undefined });
  });
});

describe('the name of a tile', () => {
  it('runs over two lines before it is cut, and the tile fills the cell so a row ends on one height', () => {
    for (const tile of [HubbLightTile, HubbCoverTile, HubbSensorTile]) {
      const css = cssOf(tile.styles);
      expect(css, tile.name).toMatch(/\.name\s*\{[^}]*-webkit-line-clamp: 2/);
      expect(css.match(/\.name\s*\{[^}]*\}/)![0], tile.name).not.toContain('nowrap');
      expect(css, tile.name).toMatch(/\.(tile|sensor)\s*\{[^}]*height: 100%/);
    }
  });
});
