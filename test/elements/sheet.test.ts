import { afterEach, describe, expect, it } from 'vitest';
import '../../src/elements/sheet';
import type { HubbSheet } from '../../src/elements/sheet';

async function mount(open: boolean): Promise<HubbSheet> {
  const el = document.createElement('hubb-sheet') as HubbSheet;
  el.heading = 'Mesa';
  el.subheading = 'Sala';
  el.open = open;
  const content = document.createElement('p');
  content.textContent = 'conteúdo';
  el.appendChild(content);
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}

describe('hubb-sheet', () => {
  afterEach(() => { document.body.replaceChildren(); });

  it('renders nothing while closed', async () => {
    const el = await mount(false);
    expect(el.shadowRoot!.querySelector('.sheet')).toBeNull();
  });

  it('shows the heading, the subheading and the slotted content when open', async () => {
    const el = await mount(true);
    expect(el.shadowRoot!.querySelector('h2')!.textContent).toBe('Mesa');
    expect(el.shadowRoot!.querySelector('.sub')!.textContent).toBe('Sala');
    expect(el.shadowRoot!.querySelector('slot')).not.toBeNull();
  });

  it('closes on a tap outside and tells the parent', async () => {
    const el = await mount(true);
    let closed = 0;
    el.addEventListener('hubb-close', () => { closed += 1; });
    (el.shadowRoot!.querySelector('.backdrop') as HTMLElement).click();
    await el.updateComplete;
    expect(el.open).toBe(false);
    expect(closed).toBe(1);
  });

  it('closes when the handle is dragged down', async () => {
    const el = await mount(true);
    const grab = el.shadowRoot!.querySelector('.grab')!;
    grab.dispatchEvent(new MouseEvent('pointerdown', { clientY: 10 }));
    grab.dispatchEvent(new MouseEvent('pointermove', { clientY: 50 }));
    expect(el.open).toBe(true);
    grab.dispatchEvent(new MouseEvent('pointermove', { clientY: 100 }));
    expect(el.open).toBe(false);
  });

  it('takes the focus when it opens, so the keyboard and screen readers land inside it', async () => {
    const el = await mount(true);
    const dialog = el.shadowRoot!.querySelector('.sheet') as HTMLElement;
    expect(dialog.getAttribute('tabindex')).toBe('-1');
    expect(el.shadowRoot!.activeElement).toBe(dialog);
  });

  it('closes on Escape and tells the parent', async () => {
    const el = await mount(true);
    let closed = 0;
    el.addEventListener('hubb-close', () => { closed += 1; });
    el.shadowRoot!.querySelector('.sheet')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await el.updateComplete;
    expect(el.open).toBe(false);
    expect(closed).toBe(1);
  });
});
