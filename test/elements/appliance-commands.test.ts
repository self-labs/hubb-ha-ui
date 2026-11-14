import { afterEach, describe, expect, it } from 'vitest';
import { HubbActionButton } from '../../src/elements/action-button';
import '../../src/elements/appliance-panel';
import type { HubbAppliancePanel } from '../../src/elements/appliance-panel';
import { buildHouse } from '../../src/model/build-house';
import { CASA2_CONFIG, casa2Hass } from '../fixtures/casa-exemplo-2';
import type { FakeHass } from '../helpers/fake-hass';

// The commands of the appliance sheet were the same tall cards as the actions of a room, with a small icon
// in a corner: on the sheet they read as tiles, not as buttons (Gustavo, 14/11). Here they are bars, side by
// side, and the one that makes sense now is the amber one.
const cssOf = (styles: unknown): string => ([] as unknown[]).concat(styles).map((s) => (s as { cssText: string }).cssText).join('\n');

async function mount(hass: FakeHass): Promise<HubbAppliancePanel> {
  const el = document.createElement('hubb-appliance-panel') as HubbAppliancePanel;
  el.hass = hass;
  el.item = buildHouse(hass, CASA2_CONFIG).rooms.find((r) => r.areaId === 'terraco')!.appliances[0]!;
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}

const buttons = (el: HubbAppliancePanel) => [...el.shadowRoot!.querySelectorAll<HubbActionButton>('.commands hubb-action-button')];

describe('the commands of the appliance sheet', () => {
  afterEach(() => document.body.replaceChildren());

  it('are bars, and only the first one, which makes sense now, is the main one', async () => {
    const el = await mount(casa2Hass('Running', '40'));
    const all = buttons(el);
    expect(all.map((b) => b.item!.name)).toEqual(['Pausar', 'Desligar', 'Parar']);
    expect(all.every((b) => b.variant === 'bar')).toBe(true);
    expect(all.map((b) => b.primary)).toEqual([true, false, false]);
  });

  it('make Iniciar the main one while it is stopped', async () => {
    const el = await mount(casa2Hass('End Of Cycle', '0'));
    expect(buttons(el).map((b) => [b.item!.name, b.primary])).toEqual([
      ['Iniciar', true],
      ['Desligar', false],
      ['Parar', false],
    ]);
  });

  it('have no main one when there is nothing to start or pause', async () => {
    const el = await mount(casa2Hass('Idle', '80'));
    const list = buttons(el);
    expect(list.filter((b) => b.primary).length).toBeLessThanOrEqual(1);
  });
});

describe('the action button', () => {
  it('stays a tall card for the actions of a room', () => {
    const el = new HubbActionButton();
    expect(el.variant).toBe('card');
    expect(el.primary).toBe(false);
  });

  it('puts the icon and the word of a bar in one row, so they share a centre line', () => {
    const css = cssOf(HubbActionButton.styles);
    expect(css).toMatch(/:host\(\[variant='bar'\]\) \.icon\s*\{[^}]*grid-row: 1;/);
    expect(css).toMatch(/:host\(\[variant='bar'\]\) \.name\s*\{[^}]*grid-row: 1;/);
    // An icon spanning two rows was centred on both, and the word, in row 1, sat 3 px above it.
    expect(css).not.toMatch(/grid-row: 1 \/ span 2/);
  });

  it('draws the bar in a row of icon and word, and the main one in amber', () => {
    const css = cssOf(HubbActionButton.styles);
    expect(css).toMatch(/:host\(\[variant='bar'\]\) \.action\s*\{[^}]*grid-template-columns: auto auto/);
    expect(css).toMatch(/:host\(\[primary\]\) \.action\s*\{[^}]*background: var\(--hubb-amber\)/);
  });
});
