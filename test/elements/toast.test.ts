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
    // The offer is shared by every toast of the panel; withdraw it so the next test starts clean.
    (document.createElement('hubb-toast') as HubbToast).hide();
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

  it('keeps the undo on offer when the screen changes within the 5 s', async () => {
    const first = await mount();
    const undo = vi.fn();
    first.show('Sala: 1 luz apagada', undo);
    first.remove();
    vi.advanceTimersByTime(2000);
    const second = await mount();
    expect(second.shadowRoot!.querySelector('.toast span')!.textContent).toBe('Sala: 1 luz apagada');
    (second.shadowRoot!.querySelector('.toast button') as HTMLButtonElement).click();
    expect(undo).toHaveBeenCalledOnce();
    vi.advanceTimersByTime(3100);
    await second.updateComplete;
    expect(second.shadowRoot!.querySelector('.toast')).toBeNull();
  });

  it('withdraws only its own offer when one is named, so a late failure cannot take another undo away', async () => {
    const el = await mount();
    const first = vi.fn();
    const second = vi.fn();
    el.show('primeira', first);
    el.show('segunda', second);
    el.hide(first);
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.toast span')!.textContent).toBe('segunda');
    el.hide(second);
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.toast')).toBeNull();
  });

  it('keeps an empty live region on the page, so the message is announced when it arrives', async () => {
    const el = await mount();
    const region = el.shadowRoot!.querySelector('[role="status"]');
    expect(region).not.toBeNull();
    el.show('x', () => undefined);
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[role="status"]')).toBe(region);
    expect(region!.textContent).toContain('x');
  });
});
