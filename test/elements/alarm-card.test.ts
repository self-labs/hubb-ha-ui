import { afterEach, describe, expect, it, vi } from 'vitest';
import '../../src/elements/alarm-card';
import { makeHass, type FakeHass } from '../helpers/fake-hass';

function alarm(state = 'disarmed', attributes: Record<string, unknown> = {}): FakeHass {
  return makeHass({ entities: [{ entity_id: 'alarm_control_panel.alarme', state, attributes: { supported_features: 1 | 2 | 8, code_format: null, ...attributes } }] });
}

async function mount(h: FakeHass) {
  const el = document.createElement('hubb-alarm-card') as HTMLElement & { hass: FakeHass; item: unknown; updateComplete: Promise<unknown> };
  el.hass = h;
  el.item = { entityId: 'alarm_control_panel.alarme', name: 'Alarme' };
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}

const text = (el: Element, sel: string) => el.shadowRoot!.querySelector(sel)?.textContent?.replace(/\s+/g, ' ').trim() ?? null;
const labels = (el: Element) => [...el.shadowRoot!.querySelectorAll('button.arm')].map((b) => b.textContent!.trim());
const flush = () => new Promise((r) => setTimeout(r, 0));
const calls = (h: FakeHass) => h.calls.map((c) => [`${c.domain}.${c.service}`, c.data]);

describe('hubb-alarm-card', () => {
  afterEach(() => {
    vi.useRealTimers();
    document.body.replaceChildren();
  });

  it('arms with a tap in the modes the alarm takes', async () => {
    const h = alarm();
    const el = await mount(h);
    expect(text(el, '.state')).toBe('Desarmado');
    expect(labels(el)).toEqual(['Em casa', 'Ausente']);
    (el.shadowRoot!.querySelectorAll('button.arm')[1] as HTMLButtonElement).click();
    expect(calls(h)).toEqual([['alarm_control_panel.alarm_arm_away', undefined]]);
  });

  it('disarms an alarm with no code only by sliding', async () => {
    const h = alarm('armed_away');
    const el = await mount(h);
    expect(text(el, '.state')).toBe('Armado ausente');
    expect(el.shadowRoot!.querySelector('button.disarm')).toBeNull();
    const slide = el.shadowRoot!.querySelector('hubb-slide-confirm')!;
    expect((slide as unknown as { label: string }).label).toBe('Deslize para desarmar');
    slide.dispatchEvent(new CustomEvent('hubb-confirm', { bubbles: true, composed: true }));
    expect(calls(h)).toEqual([['alarm_control_panel.alarm_disarm', undefined]]);
  });

  it('asks for the code on a keypad, and says when it is wrong', async () => {
    const h = alarm('armed_home', { code_format: 'number' });
    h.callService = vi.fn(() => Promise.reject(new Error('Invalid alarm code provided'))) as FakeHass['callService'];
    const el = await mount(h);
    for (const d of ['1', '2', '3', '4']) (el.shadowRoot!.querySelector(`button.key[data-key="${d}"]`) as HTMLButtonElement).click();
    await el.updateComplete;
    expect(text(el, '.code')).toBe('••••');
    (el.shadowRoot!.querySelector('button.disarm') as HTMLButtonElement).click();
    await flush();
    await el.updateComplete;
    expect((h.callService as ReturnType<typeof vi.fn>).mock.calls[0]!.slice(0, 3)).toEqual(['alarm_control_panel', 'alarm_disarm', { code: '1234' }]);
    expect(text(el, '.error')).toBe('Código incorreto');
    expect(text(el, '.code')).toBe('');
  });

  it('shows a triggered alarm in red and an unreachable one as Sem resposta', async () => {
    expect((await mount(alarm('triggered'))).shadowRoot!.querySelector('.card.triggered')).not.toBeNull();
    document.body.replaceChildren();
    const down = await mount(alarm('unavailable'));
    expect(text(down, '.state')).toBe('Sem resposta');
    expect(labels(down)).toEqual([]);
  });
});
