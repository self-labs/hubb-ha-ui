import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '../../src/elements/nav-bar';
import type { HubbNavBar } from '../../src/elements/nav-bar';

async function mount(current: 'home' | 'scenes' | 'seguranca', security = true): Promise<HubbNavBar> {
  const el = document.createElement('hubb-nav-bar') as HubbNavBar;
  el.current = current;
  el.security = security;
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}
const buttons = (el: HubbNavBar) => [...el.shadowRoot!.querySelectorAll('button')];

describe('hubb-nav-bar', () => {
  beforeEach(() => history.replaceState(null, '', '/hubb-ui/home'));
  afterEach(() => { document.body.replaceChildren(); });

  it('has Casa, Cenas and Segurança, and marks the current page', async () => {
    const el = await mount('home');
    expect(buttons(el).map((b) => b.textContent!.trim())).toEqual(['Casa', 'Cenas', 'Segurança']);
    expect(buttons(el)[0]!.getAttribute('aria-current')).toBe('page');
    expect((await mount('home', false)).shadowRoot!.querySelectorAll('button')).toHaveLength(2);
  });

  it('in a room opened from the home, the home tab goes back, so the home is where it was', async () => {
    history.replaceState({ hubbBack: true }, '', '/hubb-ui/sala');
    const el = await mount('home');
    const back = vi.spyOn(history, 'back').mockImplementation(() => undefined);
    buttons(el)[0]!.click();
    expect(back).toHaveBeenCalledOnce();
    back.mockRestore();
  });

  it('in a room opened by a link, the home tab swaps the entry for the home, with nothing to go back to', async () => {
    history.replaceState(null, '', '/hubb-ui/sala');
    const el = await mount('home');
    const back = vi.spyOn(history, 'back').mockImplementation(() => undefined);
    buttons(el)[0]!.click();
    expect(back).not.toHaveBeenCalled();
    expect(location.pathname).toBe('/hubb-ui/home');
    back.mockRestore();
  });

  it('on another tab, the home tab never goes back through history', async () => {
    history.replaceState({ hubbBack: true }, '', '/hubb-ui/scenes');
    const el = await mount('scenes');
    const back = vi.spyOn(history, 'back').mockImplementation(() => undefined);
    buttons(el)[0]!.click();
    expect(back).not.toHaveBeenCalled();
    expect(location.pathname).toBe('/hubb-ui/home');
    back.mockRestore();
  });

  it('goes to the scenes screen of the same dashboard, replacing the entry so tabs do not stack', async () => {
    const el = await mount('home');
    const push = vi.spyOn(history, 'pushState');
    buttons(el)[1]!.click();
    expect(location.pathname).toBe('/hubb-ui/scenes');
    expect(push).not.toHaveBeenCalled();
    push.mockRestore();
  });

  it('goes to the security tab of the same dashboard', async () => {
    const el = await mount('home');
    buttons(el)[2]!.click();
    expect(location.pathname).toBe('/hubb-ui/seguranca');
  });

  it('names the first tab with the label it is given', async () => {
    const el = document.createElement('hubb-nav-bar') as HubbNavBar;
    el.homeLabel = 'Início';
    document.body.appendChild(el);
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('nav button span')!.textContent).toBe('Início');
    el.remove();
  });
});
