import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '../../src/elements/action-button';
import { HubbActionButton } from '../../src/elements/action-button';
import type { ActionItem } from '../../src/model/types';
import { makeHass, type FakeHass } from '../helpers/fake-hass';

async function mount(hass: FakeHass, item: ActionItem): Promise<HubbActionButton> {
  const el = document.createElement('hubb-action-button') as HubbActionButton;
  el.hass = hass;
  el.item = item;
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}

async function press(el: HubbActionButton): Promise<void> {
  (el.shadowRoot!.querySelector('button') as HTMLButtonElement).click();
  await vi.advanceTimersByTimeAsync(0);
  await el.updateComplete;
}

const result = (el: HubbActionButton) => el.shadowRoot!.querySelector('.result')?.textContent || null;
const cssOf = (styles: unknown): string =>
  ([] as unknown[]).concat(styles).map((s) => (s as { cssText: string }).cssText).join('\n');

describe('hubb-action-button', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    document.body.replaceChildren();
  });

  it('presses a button and says Feito for 2 s', async () => {
    const h = makeHass({ entities: [{ entity_id: 'button.reiniciar', state: 'unknown' }] });
    const el = await mount(h, { entityId: 'button.reiniciar', name: 'Reiniciar roteador', icon: null });
    expect(el.shadowRoot!.querySelector('.name')!.textContent).toBe('Reiniciar roteador');
    await press(el);
    expect(h.calls).toEqual([{ domain: 'button', service: 'press', data: undefined, target: { entity_id: 'button.reiniciar' } }]);
    expect(result(el)).toBe('Feito');
    await vi.advanceTimersByTimeAsync(2000);
    await el.updateComplete;
    expect(result(el)).toBeNull();
  });

  it('runs a script with turn_on and an input_button with press', async () => {
    const h = makeHass({
      entities: [
        { entity_id: 'script.toldo', state: 'off' },
        { entity_id: 'input_button.campainha', state: 'unknown' },
      ],
    });
    await press(await mount(h, { entityId: 'script.toldo', name: 'Abrir toldo', icon: null }));
    await press(await mount(h, { entityId: 'input_button.campainha', name: 'Campainha', icon: null }));
    expect(h.calls.map((c) => `${c.domain}.${c.service}`)).toEqual(['script.turn_on', 'input_button.press']);
  });

  it('says Sem resposta when the call fails', async () => {
    const h = makeHass({ failService: true, entities: [{ entity_id: 'button.reiniciar', state: 'unknown' }] });
    const el = await mount(h, { entityId: 'button.reiniciar', name: 'Reiniciar roteador', icon: null });
    await press(el);
    expect(result(el)).toBe('Sem resposta');
  });

  it('does not call an action that is unavailable, and says so', async () => {
    const h = makeHass({ entities: [{ entity_id: 'button.reiniciar', state: 'unavailable' }] });
    const el = await mount(h, { entityId: 'button.reiniciar', name: 'Reiniciar roteador', icon: null });
    expect(result(el)).toBe('Sem resposta');
    await press(el);
    expect(h.calls).toEqual([]);
  });

  it('draws the icon of the configuration with ha-icon', async () => {
    const h = makeHass({ entities: [{ entity_id: 'button.reiniciar', state: 'unknown' }] });
    const el = await mount(h, { entityId: 'button.reiniciar', name: 'Reiniciar roteador', icon: 'mdi:router' });
    expect((el.shadowRoot!.querySelector('ha-icon') as HTMLElement & { icon?: string }).icon).toBe('mdi:router');
  });

  it('keeps the line of the result and the full height of its row, so a press moves nothing around it', async () => {
    const h = makeHass({ entities: [{ entity_id: 'button.reiniciar', state: 'unknown' }] });
    const el = await mount(h, { entityId: 'button.reiniciar', name: 'Reiniciar roteador', icon: null });
    expect(el.shadowRoot!.querySelector('.result')).not.toBeNull();
    expect(result(el)).toBeNull();
    const css = cssOf(HubbActionButton.styles);
    expect(css).toMatch(/:host\s*\{[^}]*height: 100%/);
    expect(css).toMatch(/\.action\s*\{[^}]*height: 100%/);
  });
});
