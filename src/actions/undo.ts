import type { HassServiceTarget, HomeAssistant } from '../ha/types';
import { haptic } from './haptic';

export interface ServiceCall {
  domain: string;
  service: string;
  data?: Record<string, unknown>;
  target: HassServiceTarget;
}

export interface LightSnapshot {
  entityId: string;
  on: boolean;
  brightness: number | null;
}

export function snapshotLights(hass: HomeAssistant, ids: readonly string[]): LightSnapshot[] {
  const out: LightSnapshot[] = [];
  for (const entityId of ids) {
    const st = hass.states[entityId];
    if (!st || st.state === 'unavailable' || st.state === 'unknown') continue;
    const b = st.attributes.brightness;
    out.push({ entityId, on: st.state === 'on', brightness: st.state === 'on' && typeof b === 'number' ? b : null });
  }
  return out;
}

export function restoreCalls(snapshot: readonly LightSnapshot[]): ServiceCall[] {
  return snapshot.map((s): ServiceCall => {
    const target = { entity_id: s.entityId };
    if (!s.on) return { domain: 'light', service: 'turn_off', target };
    if (s.brightness !== null) return { domain: 'light', service: 'turn_on', data: { brightness: s.brightness }, target };
    return { domain: 'light', service: 'turn_on', target };
  });
}

export async function runCalls(hass: HomeAssistant, calls: readonly ServiceCall[]): Promise<void> {
  await Promise.all(calls.map((c) => hass.callService(c.domain, c.service, c.data, c.target)));
}

/** Takes a snapshot, offers the undo at once, then runs the action. */
export async function withUndo(
  hass: HomeAssistant,
  ids: readonly string[],
  action: () => Promise<unknown>,
  show: (onUndo: () => void) => void,
): Promise<void> {
  const snapshot = snapshotLights(hass, ids);
  show(() => {
    void runCalls(hass, restoreCalls(snapshot));
  });
  try {
    await action();
  } catch {
    haptic('failure');
  }
}
