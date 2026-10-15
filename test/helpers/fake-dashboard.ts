import { vi } from 'vitest';
import type { FakeHass } from './fake-hass';

/**
 * Gives `h` a saved dashboard; every save replaces it, the way Home Assistant does. Returns the
 * strategies saved, newest last. `failSave` makes Home Assistant refuse (not an administrator).
 */
export function withDashboard(h: FakeHass, saved: Record<string, unknown>, failSave = false): Record<string, unknown>[] {
  const saves: Record<string, unknown>[] = [];
  let current = saved;
  h.callWS = vi.fn(async (msg: Record<string, unknown>) => {
    if (msg.type === 'lovelace/config') return structuredClone(current);
    if (msg.type === 'lovelace/config/save') {
      if (failSave) throw new Error('Unauthorized');
      current = msg.config as Record<string, unknown>;
      saves.push((current.strategy ?? {}) as Record<string, unknown>);
      return null;
    }
    throw new Error(`unexpected ${String(msg.type)}`);
  }) as FakeHass['callWS'];
  return saves;
}

export function admin(h: FakeHass): FakeHass {
  h.user = { id: 'u1', name: 'Gustavo Exemplo', is_admin: true };
  return h;
}

export const flush = (): Promise<unknown> => new Promise((resolve) => setTimeout(resolve, 0));

/** Gives `h` the users of `config/auth/list` on top of whatever callWS answers already; `fail` refuses. */
export function withUsers(h: FakeHass, users: Record<string, unknown>[], fail = false): void {
  const before = h.callWS;
  h.callWS = vi.fn(async (msg: Record<string, unknown>) => {
    if (msg.type === 'config/auth/list') {
      if (fail) throw new Error('Unauthorized');
      return structuredClone(users);
    }
    if (before) return before(msg);
    throw new Error(`unexpected ${String(msg.type)}`);
  }) as FakeHass['callWS'];
}

/** The users of a house: the installer, two residents, one disabled and one of the system. */
export const USERS = [
  { id: 'u_gustavo', name: 'Gustavo', is_active: true, system_generated: false, group_ids: ['system-admin'] },
  { id: 'u_lia', name: 'Lia', is_active: true, system_generated: false, group_ids: ['system-users'] },
  { id: 'u_ana', name: 'Ana', is_active: true, system_generated: false, group_ids: ['system-users'] },
  { id: 'u_antiga', name: 'Antiga', is_active: false, system_generated: false, group_ids: ['system-users'] },
  { id: 'u_super', name: 'Supervisor', is_active: true, system_generated: true, group_ids: ['system-admin'] },
];
