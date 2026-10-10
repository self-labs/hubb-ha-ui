/** "/hubb-casa/sala" -> "/hubb-casa". Dashboards need a hyphen in their URL, so we never hardcode it. */
export function basePath(pathname: string = window.location.pathname): string {
  const first = pathname.split('/').filter(Boolean)[0];
  return first ? `/${first}` : '';
}

export interface NavigateOptions {
  /** Swap the current entry instead of stacking one (tab switches, the in-app back). */
  replace?: boolean;
  /** Mark the new entry so the screen it opens can return with history.back(). */
  back?: boolean;
}

/** Moves inside the Home Assistant frontend without a reload, the same way its own links do. */
export function navigate(path: string, opts: NavigateOptions = {}): void {
  const state = opts.back ? { hubbBack: true } : null;
  if (opts.replace) history.replaceState(state, '', path);
  else history.pushState(state, '', path);
  window.dispatchEvent(new CustomEvent('location-changed', { detail: { replace: !!opts.replace } }));
}

/**
 * The in-app back arrow. When our home screen opened this one, going back through history keeps
 * the Android back gesture in step; otherwise (a deep link, a notification) home replaces it.
 */
export function goBack(base: string = basePath()): void {
  const state = history.state as { hubbBack?: boolean } | null;
  if (state?.hubbBack) history.back();
  else navigate(`${base}/home`, { replace: true });
}
