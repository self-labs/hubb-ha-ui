import { afterEach, describe, expect, it, vi } from 'vitest';
import { haptic } from '../../src/actions/haptic';
import { basePath, goBack, navigate } from '../../src/actions/navigate';

describe('haptic and navigation', () => {
  afterEach(() => history.replaceState(null, '', '/'));

  it('sends the haptic event the Companion App listens to', () => {
    const seen: string[] = [];
    const listener = (e: Event) => seen.push((e as CustomEvent<string>).detail);
    window.addEventListener('haptic', listener);
    haptic('light');
    window.removeEventListener('haptic', listener);
    expect(seen).toEqual(['light']);
  });

  it('takes the dashboard base path from the URL', () => {
    expect(basePath('/hubb-ui/sala')).toBe('/hubb-ui');
    expect(basePath('/hubb-ui')).toBe('/hubb-ui');
    expect(basePath('/')).toBe('');
  });

  it('can replace the current entry instead of stacking one', () => {
    const push = vi.spyOn(history, 'pushState');
    navigate('/hubb-ui/scenes', { replace: true });
    expect(location.pathname).toBe('/hubb-ui/scenes');
    expect(push).not.toHaveBeenCalled();
    push.mockRestore();
  });

  it('goes back through history when the previous screen was ours, else replaces with home', () => {
    navigate('/hubb-ui/sala', { back: true });
    expect(history.state).toEqual({ hubbBack: true });
    const back = vi.spyOn(history, 'back').mockImplementation(() => undefined);
    goBack('/hubb-ui');
    expect(back).toHaveBeenCalledOnce();
    history.replaceState(null, '', '/hubb-ui/sala');
    goBack('/hubb-ui');
    expect(back).toHaveBeenCalledOnce();
    expect(location.pathname).toBe('/hubb-ui/home');
    back.mockRestore();
  });

  it('navigates inside the frontend without reloading', () => {
    let changed = 0;
    const listener = () => { changed += 1; };
    window.addEventListener('location-changed', listener);
    navigate('/hubb-ui/sala');
    window.removeEventListener('location-changed', listener);
    expect(location.pathname).toBe('/hubb-ui/sala');
    expect(changed).toBe(1);
  });
});
