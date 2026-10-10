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
    expect(basePath('/hubb-casa/sala')).toBe('/hubb-casa');
    expect(basePath('/hubb-casa')).toBe('/hubb-casa');
    expect(basePath('/')).toBe('');
  });

  it('can replace the current entry instead of stacking one', () => {
    const push = vi.spyOn(history, 'pushState');
    navigate('/hubb-casa/scenes', { replace: true });
    expect(location.pathname).toBe('/hubb-casa/scenes');
    expect(push).not.toHaveBeenCalled();
    push.mockRestore();
  });

  it('goes back through history when the previous screen was ours, else replaces with home', () => {
    navigate('/hubb-casa/sala', { back: true });
    expect(history.state).toEqual({ hubbBack: true });
    const back = vi.spyOn(history, 'back').mockImplementation(() => undefined);
    goBack('/hubb-casa');
    expect(back).toHaveBeenCalledOnce();
    history.replaceState(null, '', '/hubb-casa/sala');
    goBack('/hubb-casa');
    expect(back).toHaveBeenCalledOnce();
    expect(location.pathname).toBe('/hubb-casa/home');
    back.mockRestore();
  });

  it('navigates inside the frontend without reloading', () => {
    let changed = 0;
    const listener = () => { changed += 1; };
    window.addEventListener('location-changed', listener);
    navigate('/hubb-casa/sala');
    window.removeEventListener('location-changed', listener);
    expect(location.pathname).toBe('/hubb-casa/sala');
    expect(changed).toBe(1);
  });
});
