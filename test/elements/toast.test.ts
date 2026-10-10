import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '../../src/elements/toast';
import type { HubbToast } from '../../src/elements/toast';

async function mount(): Promise<HubbToast> {
  const el = document.createElement('hubb-toast') as HubbToast;
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}

describe('hubb-toast', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    document.body.replaceChildren();
  });

  it('shows the message with Desfazer', async () => {
    const el = await mount();
    el.show('Sala: 2 luzes apagadas', () => undefined);
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.toast span')!.textContent).toBe('Sala: 2 luzes apagadas');
    expect(el.shadowRoot!.querySelector('.toast button')!.textContent).toBe('Desfazer');
  });

  it('undoes only once', async () => {
    const el = await mount();
    const undo = vi.fn();
    el.show('x', undo);
    await el.updateComplete;
    const btn = el.shadowRoot!.querySelector('.toast button') as HTMLButtonElement;
    btn.click();
    btn.click();
    await el.updateComplete;
    expect(undo).toHaveBeenCalledOnce();
    expect(el.shadowRoot!.querySelector('.toast')).toBeNull();
  });

  it('hides after 5 s without undoing', async () => {
    const el = await mount();
    const undo = vi.fn();
    el.show('x', undo);
    vi.advanceTimersByTime(5000);
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.toast')).toBeNull();
    expect(undo).not.toHaveBeenCalled();
  });

  it('a new message replaces the old one and its undo', async () => {
    const el = await mount();
    const first = vi.fn();
    const second = vi.fn();
    el.show('primeira', first);
    el.show('segunda', second);
    await el.updateComplete;
    (el.shadowRoot!.querySelector('.toast button') as HTMLButtonElement).click();
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledOnce();
  });
});
