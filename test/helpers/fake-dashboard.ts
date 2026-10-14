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
