import { afterEach, describe, expect, it, vi } from 'vitest';
import '../../src/elements/climate-panel';
import type { HubbClimateArc } from '../../src/elements/climate-arc';
import type { HubbClimatePanel } from '../../src/elements/climate-panel';
import { modeColor, modeIcon } from '../../src/model/climate-mode';
import { makeHass, type FakeHass } from '../helpers/fake-hass';

// The sheet of an air conditioner after the card of Home Assistant (spec card do ar, 22/10): the arc,
// − and + with the power in the middle, the modes centred, the colour of the mode.

const COOL_FEATURES = 1 | 8 | 32 | 128 | 256;

function ar(state: string, attrs: Record<string, unknown> = {}): FakeHass {
  return makeHass({
    entities: [
      {
        entity_id: 'climate.ar',
        name: 'Ar',
        state,
        attributes: {
          hvac_modes: ['off', 'cool', 'heat', 'auto', 'dry', 'fan_only'],
          hvac_action: state === 'cool' ? 'cooling' : undefined,
          temperature: 23,
          current_temperature: 27,
          min_temp: 16,
          max_temp: 30,
          target_temp_step: 1,
          supported_features: COOL_FEATURES,
          ...attrs,
        },
      },
    ],
  });
}

async function sheet(h: FakeHass, allowed?: { modes?: string[] | null }): Promise<HubbClimatePanel> {
  const el = document.createElement('hubb-climate-panel') as HubbClimatePanel;
  el.hass = h;
  el.entityId = 'climate.ar';
  if (allowed) el.allowed = allowed;
  document.body.appendChild(el);
  await el.updateComplete;
  const arc = el.shadowRoot!.querySelector('hubb-climate-arc') as HubbClimateArc | null;
  await arc?.updateComplete;
  return el;
}

const arcOf = (el: HubbClimatePanel) => el.shadowRoot!.querySelector('hubb-climate-arc') as HubbClimateArc;
const temps = (h: FakeHass) => h.calls.filter((c) => c.service === 'set_temperature').map((c) => c.data);

describe('the sheet of an air conditioner, with the arc', () => {
  afterEach(() => {
    vi.useRealTimers();
    document.body.replaceChildren();
  });

  it('on in Frio: the arc in blue at 23, what it does and the temperature now inside', async () => {
    const el = await sheet(ar('cool'));
    const arc = arcOf(el);
    expect(arc.value).toBe(23);
    expect(arc.min).toBe(16);
    expect(arc.max).toBe(30);
    expect(arc.current).toBe(27);
    expect(arc.color).toBe('var(--hubb-mode-cool)');
    expect(arc.label).toBe('Resfriando');
    expect(arc.disabled).toBe(false);
  });

  it('the arc let go sends one target at once; a key waits for the next keys', async () => {
    vi.useFakeTimers();
    const h = ar('cool');
    const el = await sheet(h);
    arcOf(el).dispatchEvent(new CustomEvent('hubb-arc-change', { detail: { value: 26, source: 'pointer' }, bubbles: true, composed: true }));
    expect(temps(h)).toEqual([{ temperature: 26 }]);
    arcOf(el).dispatchEvent(new CustomEvent('hubb-arc-change', { detail: { value: 27, source: 'key' }, bubbles: true, composed: true }));
    expect(temps(h)).toHaveLength(1);
    vi.advanceTimersByTime(800);
    expect(temps(h)).toEqual([{ temperature: 26 }, { temperature: 27 }]);
  });

  it('− and the power and + in one row, the power in the middle', async () => {
    const el = await sheet(ar('cool'));
    const row = el.shadowRoot!.querySelector('.controls')!;
    expect([...row.children].map((b) => b.classList[0])).toEqual(['step', 'power', 'step']);
    expect(row.children[0]!.classList.contains('colder')).toBe(true);
    expect(row.children[2]!.classList.contains('warmer')).toBe(true);
  });

  it('off: a grey arc with nothing to drag, as in Home Assistant, "Desligado", no − and +, the power in the middle', async () => {
    // A device that keeps its target while off (infrared, Electrolux) still shows no knob (Gustavo, 23/10).
    const h = ar('off', { hvac_action: 'off' });
    const el = await sheet(h);
    expect(arcOf(el).value).toBeNull();
    expect(arcOf(el).label).toBe('Desligado');
    expect(el.shadowRoot!.querySelector('.colder, .warmer')).toBeNull();
    expect(el.shadowRoot!.querySelector('.controls .power')).not.toBeNull();
    arcOf(el).dispatchEvent(new CustomEvent('hubb-arc-change', { detail: { value: 20, source: 'pointer' }, bubbles: true, composed: true }));
    expect(temps(h)).toEqual([]);
  });

  it('on in Ventilar (no target): a grey arc, "Ventilando", no − and +', async () => {
    const el = await sheet(ar('fan_only', { temperature: null }));
    expect(arcOf(el).value).toBeNull();
    expect(arcOf(el).label).toBe('Ventilando');
    expect(el.shadowRoot!.querySelector('.colder, .warmer')).toBeNull();
  });

  it('Auto with a range of two targets is, for now, a mode with no target', async () => {
    const el = await sheet(ar('heat_cool', { temperature: null, target_temp_low: 20, target_temp_high: 24, supported_features: COOL_FEATURES | 2 }));
    expect(arcOf(el).value).toBeNull();
    expect(el.shadowRoot!.querySelector('.colder, .warmer')).toBeNull();
  });

  it('a device with no way to go off: no power button, − and + still in the row', async () => {
    const el = await sheet(ar('cool', { hvac_modes: ['cool', 'dry'], supported_features: 1 }));
    expect(el.shadowRoot!.querySelector('.power')).toBeNull();
    expect(el.shadowRoot!.querySelectorAll('.controls .step')).toHaveLength(2);
  });

  it('no temperature now: the arc has none to show', async () => {
    const el = await sheet(ar('cool', { current_temperature: null }));
    expect(arcOf(el).current).toBeNull();
  });

  it('down: "Sem resposta", as today', async () => {
    const el = await sheet(ar('unavailable'));
    expect(el.shadowRoot!.textContent).toContain('Sem resposta');
    expect(el.shadowRoot!.querySelector('hubb-climate-arc')).toBeNull();
  });

  it('only the modes the installer kept, each with its icon, never "off"; the current one in the colour of the mode', async () => {
    const el = await sheet(ar('cool'), { modes: ['fan_only', 'auto', 'cool'] });
    const modes = [...el.shadowRoot!.querySelectorAll('button.mode')];
    expect(modes.map((b) => b.textContent!.trim())).toEqual(['Frio', 'Auto', 'Ventilar']);
    expect(modes.every((b) => b.querySelector('svg'))).toBe(true);
    const current = modes.find((b) => b.getAttribute('aria-pressed') === 'true')!;
    expect(current.textContent!.trim()).toBe('Frio');
    expect((current as HTMLElement).style.getPropertyValue('--mode')).toBe('var(--hubb-mode-cool)');
  });

  it('every mode has its colour and icon', () => {
    expect(modeColor('cool')).toBe('var(--hubb-mode-cool)');
    expect(modeColor('heat')).toBe('var(--hubb-mode-heat)');
    expect(modeColor('auto')).toBe('var(--hubb-mode-auto)');
    expect(modeColor('heat_cool')).toBe('var(--hubb-mode-auto)');
    expect(modeColor('dry')).toBe('var(--hubb-mode-dry)');
    expect(modeColor('fan_only')).toBe('var(--hubb-mode-fan)');
    expect(modeColor('off')).toBe('var(--hubb-mode-off)');
    for (const m of ['cool', 'heat', 'auto', 'heat_cool', 'dry', 'fan_only', 'off']) expect(modeIcon(m)).toMatch(/^M/);
  });

  it('keeps the live line of the target for screen readers', async () => {
    const el = await sheet(ar('cool'));
    const target = el.shadowRoot!.querySelector('.target')!;
    expect(target.textContent).toBe('23°');
    expect(target.getAttribute('aria-live')).toBe('polite');
  });
});

describe('the arc inside the sheet of a room', () => {
  afterEach(() => document.body.replaceChildren());

  it('dragging it never closes the sheet', async () => {
    await import('../../src/screens/room-screen');
    const { area } = await import('../helpers/fake-hass');
    const { allLightIds, buildHouse } = await import('../../src/model/build-house');
    const h = makeHass({
      areas: [area('sala', 'Sala')],
      entities: [{ entity_id: 'climate.ar', area_id: 'sala', name: 'Ar', state: 'cool', attributes: { hvac_modes: ['off', 'cool'], temperature: 23, min_temp: 16, max_temp: 30, supported_features: COOL_FEATURES } }],
    });
    const house = buildHouse(h);
    const room = document.createElement('hubb-room-screen') as HTMLElement & { setConfig(c: unknown): void; hass: unknown; updateComplete: Promise<unknown> };
    room.setConfig({ type: 'custom:hubb-room-screen', room: house.rooms[0]!, lightIds: allLightIds(house) });
    room.hass = h;
    document.body.appendChild(room);
    await room.updateComplete;
    room.shadowRoot!.querySelector('hubb-climate-card')!.dispatchEvent(new CustomEvent('hubb-open-climate', { detail: { entityId: 'climate.ar' }, bubbles: true, composed: true }));
    await room.updateComplete;
    const sheetEl = room.shadowRoot!.querySelector('hubb-sheet.device')!;
    const panel = sheetEl.querySelector('hubb-climate-panel') as HubbClimatePanel;
    await panel.updateComplete;
    const arc = arcOf(panel);
    await arc.updateComplete;
    const svgEl = arc.shadowRoot!.querySelector('svg')!;
    svgEl.getBoundingClientRect = () => ({ left: 0, top: 0, width: 260, height: 230, right: 260, bottom: 230, x: 0, y: 0, toJSON: () => ({}) });
    // From the top (23, the target it has) to 300 degrees (25): a tap on the target alone asks for nothing.
    for (const [type, clientX, clientY] of [['pointerdown', 130, 25], ['pointermove', 182.5, 39.1], ['pointerup', 182.5, 39.1]] as const) {
      svgEl.dispatchEvent(new PointerEvent(type, { clientX, clientY, pointerId: 1, bubbles: true, composed: true }));
    }
    await room.updateComplete;
    expect(sheetEl.hasAttribute('open')).toBe(true);
    expect(h.calls.filter((c) => c.service === 'set_temperature')).toHaveLength(1);
  });

  it('no tap on the new sheet closes it: −, +, the power, the modes, Mais ajustes and its switches', async () => {
    // The sheet the test above left open would come back on this new page (src/sheets.ts): leaving the
    // edit mode forgets it.
    const { setEditing } = await import('../../src/editing');
    setEditing(true);
    setEditing(false);
    await import('../../src/screens/room-screen');
    const { area } = await import('../helpers/fake-hass');
    const { allLightIds, buildHouse } = await import('../../src/model/build-house');
    const h = makeHass({
      areas: [area('sala', 'Sala')],
      entities: [
        {
          entity_id: 'climate.ar',
          area_id: 'sala',
          device_id: 'd_ar',
          platform: 'lg_thinq',
          name: 'Ar',
          state: 'cool',
          attributes: {
            hvac_modes: ['off', 'cool', 'dry'],
            temperature: 23,
            min_temp: 16,
            max_temp: 30,
            fan_modes: ['auto', 'low', 'high'],
            fan_mode: 'auto',
            supported_features: COOL_FEATURES,
          },
        },
        { entity_id: 'switch.ar_iluminacao', device_id: 'd_ar', platform: 'lg_thinq', state: 'on', attributes: { friendly_name: 'Ar Iluminação' } },
      ],
    });
    const house = buildHouse(h);
    const room = document.createElement('hubb-room-screen') as HTMLElement & { setConfig(c: unknown): void; hass: unknown; updateComplete: Promise<unknown> };
    room.setConfig({ type: 'custom:hubb-room-screen', room: house.rooms[0]!, lightIds: allLightIds(house) });
    room.hass = h;
    document.body.appendChild(room);
    await room.updateComplete;
    const card = room.shadowRoot!.querySelector('hubb-climate-card') as HTMLElement & { updateComplete: Promise<unknown> };
    await card.updateComplete;
    // − and + of the card change the target and open nothing.
    (card.shadowRoot!.querySelector('.warmer') as HTMLButtonElement).click();
    await room.updateComplete;
    expect(room.shadowRoot!.querySelector('hubb-sheet.device')?.hasAttribute('open') ?? false).toBe(false);
    card.dispatchEvent(new CustomEvent('hubb-open-climate', { detail: { entityId: 'climate.ar' }, bubbles: true, composed: true }));
    await room.updateComplete;
    const sheetEl = room.shadowRoot!.querySelector('hubb-sheet.device')!;
    const panel = sheetEl.querySelector('hubb-climate-panel') as HubbClimatePanel;
    await panel.updateComplete;
    (panel.shadowRoot!.querySelector('details.more') as HTMLDetailsElement).open = true;
    const taps = [...panel.shadowRoot!.querySelectorAll<HTMLButtonElement>('button')];
    expect(taps.some((b) => b.getAttribute('role') === 'switch')).toBe(true);
    for (const b of taps) b.click();
    const fan = panel.shadowRoot!.querySelector('select.fan') as HTMLSelectElement;
    fan.value = 'high';
    fan.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
    await room.updateComplete;
    expect(sheetEl.hasAttribute('open')).toBe(true);
  });
});
