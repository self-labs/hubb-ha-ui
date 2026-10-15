import type { HomeAssistant } from '../ha/types';

/** A user of Home Assistant as the visibility editor needs it. */
export interface HaUser {
  id: string;
  name: string;
  isAdmin: boolean;
  /** Active, and not one Home Assistant made for itself (Supervisor, Home Assistant Content). */
  isPerson: boolean;
}

interface AuthUser {
  id: string;
  name: string;
  is_active: boolean;
  system_generated: boolean;
  group_ids: string[];
}

let cache: { from: HomeAssistant['callWS']; users: Promise<HaUser[] | null> } | null = null;

/**
 * Every user of Home Assistant, once per connection. `config/auth/list` answers administrators only:
 * the edit mode, the item editor and the review call it, and they are an administrator's. Null when
 * it could not be read; a failure is not kept, so the next caller asks again.
 */
export function loadUsers(hass: HomeAssistant): Promise<HaUser[] | null> {
  if (!hass.callWS) return Promise.resolve(null);
  if (cache?.from === hass.callWS) return cache.users;
  const users: Promise<HaUser[] | null> = hass
    .callWS<AuthUser[]>({ type: 'config/auth/list' })
    .then((list) =>
      list.map((u) => ({ id: u.id, name: u.name, isAdmin: u.group_ids.includes('system-admin'), isPerson: u.is_active && !u.system_generated })),
    )
    .catch(() => {
      if (cache?.users === users) cache = null;
      return null;
    });
  cache = { from: hass.callWS, users };
  return users;
}

/** Who the picker offers: people who are not administrators (they always see everything), by name. */
export function residents(users: readonly HaUser[]): HaUser[] {
  return users.filter((u) => u.isPerson && !u.isAdmin).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}
