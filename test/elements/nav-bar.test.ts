import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '../../src/elements/nav-bar';
import type { HubbNavBar } from '../../src/elements/nav-bar';

async function mount(current: 'home' | 'scenes'): Promise<HubbNavBar> {
  const el = document.createElement('hubb-nav-bar') as HubbNavBar;
  el.current = current;
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}
const buttons = (el: HubbNavBar) => [...el.shadowRoot!.querySelectorAll('button')];

describe('hubb-nav-bar', () => {
  beforeEach(() => history.replaceState(null, '', '/hubb-casa/home'));
  afterEach(() => { document.body.replaceChildren(); });

  it('has Casa, Cenas and a dimmed Segurança, and marks the current page', async () => {
    const el = await mount('home');
    expect(buttons(el).map((b) => b.textContent!.trim())).toEqual(['Casa', 'Cenas', 'Segurança']);
    expect(buttons(el)[0]!.getAttribute('aria-current')).toBe('page');
    expect(buttons(el)[2]!.getAttribute('aria-disabled')).toBe('true');
  });

  it('goes to the scenes screen of the same dashboard, replacing the entry so tabs do not stack', async () => {
    const el = await mount('home');
    const push = vi.spyOn(history, 'pushState');
    buttons(el)[1]!.click();
    expect(location.pathname).toBe('/hubb-casa/scenes');
    expect(push).not.toHaveBeenCalled();
    push.mockRestore();
  });

  it('does not go anywhere from Segurança yet', async () => {
    const el = await mount('home');
    buttons(el)[2]!.click();
    expect(location.pathname).toBe('/hubb-casa/home');
  });
});
