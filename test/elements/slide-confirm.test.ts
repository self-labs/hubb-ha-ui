import { afterEach, describe, expect, it } from 'vitest';
import '../../src/elements/slide-confirm';
import type { HubbSlideConfirm } from '../../src/elements/slide-confirm';

async function mount(disabled = false): Promise<{ el: HubbSlideConfirm; fired: () => number }> {
  const el = document.createElement('hubb-slide-confirm') as HubbSlideConfirm;
  el.label = 'Deslize para abrir';
  el.disabled = disabled;
  let count = 0;
  el.addEventListener('hubb-confirm', () => count++);
  document.body.appendChild(el);
  await el.updateComplete;
  return { el, fired: () => count };
}

const track = (el: HubbSlideConfirm) => el.shadowRoot!.querySelector('.track') as HTMLElement;
const thumb = (el: HubbSlideConfirm) => el.shadowRoot!.querySelector('.thumb') as HTMLElement;
const key = (el: HubbSlideConfirm, k: string) => track(el).dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));
const pointer = (target: HTMLElement, type: string, clientX: number) =>
  target.dispatchEvent(new PointerEvent(type, { clientX, pointerId: 1, bubbles: true }));

function sizes(el: HubbSlideConfirm): void {
  track(el).getBoundingClientRect = () => ({ width: 300 }) as DOMRect;
  thumb(el).getBoundingClientRect = () => ({ width: 44 }) as DOMRect;
}

describe('hubb-slide-confirm', () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it('fires only when the thumb reaches the end, by keyboard too', async () => {
    const { el, fired } = await mount();
    for (let i = 0; i < 3; i++) key(el, 'ArrowRight');
    await el.updateComplete;
    expect(fired()).toBe(0);
    expect(track(el).getAttribute('aria-valuenow')).toBe('75');
    key(el, 'ArrowRight');
    await el.updateComplete;
    expect(fired()).toBe(1);
    expect(track(el).getAttribute('aria-valuenow')).toBe('0');
  });

  it('never fires on a tap, and slides back when let go too early', async () => {
    const { el, fired } = await mount();
    sizes(el);
    pointer(thumb(el), 'pointerdown', 10);
    pointer(thumb(el), 'pointerup', 10);
    pointer(thumb(el), 'pointerdown', 10);
    pointer(thumb(el), 'pointermove', 110);
    pointer(thumb(el), 'pointerup', 110);
    await el.updateComplete;
    expect(fired()).toBe(0);
    expect(el.progress).toBe(0);
  });

  it('fires when dragged nearly to the end', async () => {
    const { el, fired } = await mount();
    sizes(el);
    pointer(thumb(el), 'pointerdown', 10);
    pointer(thumb(el), 'pointermove', 250);
    pointer(thumb(el), 'pointerup', 250);
    expect(fired()).toBe(1);
  });

  it('does not fire when the system takes the touch away near the end', async () => {
    const { el, fired } = await mount();
    sizes(el);
    for (const lost of ['pointercancel', 'lostpointercapture']) {
      pointer(thumb(el), 'pointerdown', 10);
      pointer(thumb(el), 'pointermove', 250);
      pointer(thumb(el), lost, 250);
      pointer(thumb(el), 'pointerup', 250);
      await el.updateComplete;
      expect(el.progress).toBe(0);
    }
    expect(fired()).toBe(0);
  });

  it('follows only the finger that started, and a held arrow key does not repeat the fire', async () => {
    const { el, fired } = await mount();
    sizes(el);
    pointer(thumb(el), 'pointerdown', 10);
    pointer(thumb(el), 'pointermove', 250);
    thumb(el).dispatchEvent(new PointerEvent('pointerup', { clientX: 250, pointerId: 2, bubbles: true }));
    expect(fired()).toBe(0);
    pointer(thumb(el), 'pointercancel', 250);
    for (let i = 0; i < 12; i++) track(el).dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', repeat: i > 0, bubbles: true }));
    expect(fired()).toBe(0);
  });

  it('does nothing while disabled', async () => {
    const { el, fired } = await mount(true);
    for (let i = 0; i < 4; i++) key(el, 'ArrowRight');
    expect(fired()).toBe(0);
  });
});
