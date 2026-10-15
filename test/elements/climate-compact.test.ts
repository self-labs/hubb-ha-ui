import { afterEach, describe, expect, it } from 'vitest';
import '../../src/elements/climate-panel';
import type { HubbClimatePanel } from '../../src/elements/climate-panel';
import '../../src/elements/item-editor';
import { buildHouse } from '../../src/model/build-house';
import { readConfig } from '../../src/model/config';
import { area, makeHass, type FakeHass } from '../helpers/fake-hass';

/** An LG seen through SmartThinQ: raw swing values with no translation, fan speeds the panel names. */
function lg(state = 'cool'): FakeHass {
  return makeHass({
    areas: [area('escritorio', 'Escritório')],
    entities: [
      {
        entity_id: 'climate.ar',
        area_id: 'escritorio',
        name: 'Ar',
        state,
        attributes: {
          hvac_modes: ['off', 'auto', 'dry', 'cool', 'fan_only'],
          fan_modes: ['low', 'LOW_MID', 'medium', 'MID_HIGH', 'high', 'diffuse'],
          fan_mode: 'low',
          swing_modes: ['Off', 'Top', 'MiddleTop1', 'Bottom', 'Swing'],
          swing_mode: 'Off',
          temperature: 23,
          current_temperature: 27,
          supported_features: 1 | 8 | 32 | 128 | 256,
        },
      },
    ],
  });
}

async function panel(h: FakeHass, allowed?: { modes?: string[] | null; controls?: string[] | null }): Promise<HubbClimatePanel> {
  const el = document.createElement('hubb-climate-panel') as HubbClimatePanel & { allowed?: unknown };
  el.hass = h;
  el.entityId = 'climate.ar';
  if (allowed) el.allowed = allowed;
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}

const texts = (el: Element, sel: string) => [...el.shadowRoot!.querySelectorAll(sel)].map((b) => b.textContent!.replace(/\s+/g, ' ').trim());
const services = (h: FakeHass) => h.calls.map((c) => [`${c.domain}.${c.service}`, c.data]);

describe('the compact sheet of an air conditioner', () => {
  afterEach(() => document.body.replaceChildren());

  it('puts the power next to the temperature and leaves Desligado out of the modes', async () => {
    const h = lg();
    const el = await panel(h);
    expect(el.shadowRoot!.querySelector('.top .power')).not.toBeNull();
    expect(texts(el, '.mode')).toEqual(['Auto', 'Seco', 'Frio', 'Ventilar']);
    (el.shadowRoot!.querySelector('.top .power') as HTMLButtonElement).click();
    expect(services(h)).toEqual([['climate.turn_off', undefined]]);
  });

  it('keeps ventilation and swing closed under Mais ajustes', async () => {
    const el = await panel(lg());
    const more = el.shadowRoot!.querySelector('details.more')!;
    expect(more.hasAttribute('open')).toBe(false);
    expect(more.querySelector('summary')!.textContent!.trim()).toBe('Mais ajustes');
    expect(more.querySelector('.fan')).not.toBeNull();
  });

  it('shows only the values it can name, and drops a setting left with one choice', async () => {
    const el = await panel(lg());
    // "diffuse" is named by Home Assistant itself, so the panel gives it a word that fits the row.
    expect(texts(el, '.fan')).toEqual(['Baixa', 'Média baixa', 'Média', 'Média alta', 'Alta', 'Difusa']);
    // Off is the only swing value with a name: a select of one choice says nothing.
    expect(el.shadowRoot!.querySelector('select.swing')).toBeNull();
  });

  it('shows only the modes and the settings the installer chose', async () => {
    const el = await panel(lg(), { modes: ['cool', 'dry'], controls: [] });
    expect(texts(el, '.mode')).toEqual(['Seco', 'Frio']);
    expect(el.shadowRoot!.querySelector('details.more')).toBeNull();
  });
});

describe('choosing what the sheet of an air conditioner shows', () => {
  afterEach(() => document.body.replaceChildren());

  it('reads the modes and the settings from the YAML and hands them to the room', () => {
    const h = lg();
    const config = { entities: { 'climate.ar': { modes: ['cool', 'dry'], controls: ['fan'] } } };
    expect(readConfig(h, config).problems).toEqual([]);
    expect(buildHouse(h, config).rooms[0]!.climate[0]).toMatchObject({ modes: ['cool', 'dry'], controls: ['fan'] });
    const bad = readConfig(h, { entities: { 'climate.ar': { modes: 'cool' as unknown as string[], controls: ['turbo'] } } });
    expect(bad.problems.map((p) => p.key)).toEqual(['entities.climate.ar.modes', 'entities.climate.ar.controls']);
  });

  it('lets the installer pick them in the editor and saves them in one go', async () => {
    const h = lg();
    const editor = document.createElement('hubb-item-editor') as HTMLElement & {
      hass: FakeHass;
      item: unknown;
      roomAreaId: string;
      settings: unknown;
      updateComplete: Promise<unknown>;
    };
    editor.hass = h;
    editor.item = { entityId: 'climate.ar', name: 'Ar', kind: 'climate', siblings: ['climate.ar'] };
    editor.roomAreaId = 'escritorio';
    document.body.appendChild(editor);
    await editor.updateComplete;
    const toggles = () => [...editor.shadowRoot!.querySelectorAll('.panel-choice')] as HTMLButtonElement[];
    expect(toggles().map((b) => [b.textContent!.trim(), b.getAttribute('aria-pressed')])).toEqual([
      ['Auto', 'true'],
      ['Seco', 'true'],
      ['Frio', 'true'],
      ['Ventilar', 'true'],
      // No "Oscilação": only "Off" of its values has a name, and the sheet never shows it.
      ['Ventilação', 'true'],
    ]);
    toggles()[0]!.click();
    await editor.updateComplete;
    toggles()[4]!.click();
    await editor.updateComplete;
    let asked: unknown = null;
    editor.addEventListener('hubb-edit', (e) => (asked = (e as CustomEvent).detail));
    (editor.shadowRoot!.querySelector('button.save-choices') as HTMLButtonElement).click();
    expect(asked).toMatchObject({ entityId: 'climate.ar', patch: { modes: ['dry', 'cool', 'fan_only'], controls: [] } });
  });
});

describe('the room page hands the choices to the sheet and to the editor', () => {
  afterEach(() => document.body.replaceChildren());

  it('shows only the kept modes on the sheet it opens', async () => {
    await import('../../src/screens/room-screen');
    const h = lg();
    const options = { entities: { 'climate.ar': { modes: ['cool'] } } };
    const house = buildHouse(h, options);
    const el = document.createElement('hubb-room-screen') as HTMLElement & { hass: FakeHass; setConfig(c: unknown): void; updateComplete: Promise<unknown> };
    el.setConfig({ type: 'custom:hubb-room-screen', room: house.rooms[0]!, lightIds: [], options });
    el.hass = h;
    document.body.appendChild(el);
    await el.updateComplete;
    el.shadowRoot!.querySelector('hubb-climate-card')!.dispatchEvent(new CustomEvent('hubb-open-climate', { detail: { entityId: 'climate.ar' }, bubbles: true, composed: true }));
    await el.updateComplete;
    const sheetPanel = el.shadowRoot!.querySelector('hubb-climate-panel')!;
    await (sheetPanel as unknown as { updateComplete: Promise<unknown> }).updateComplete;
    expect(texts(sheetPanel, '.mode')).toEqual(['Frio']);
  });
});
