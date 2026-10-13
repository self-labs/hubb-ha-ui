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
    // A switch with the light role only goes on or off: it has no brightness to put back.
    const domain = s.entityId.startsWith('switch.') ? 'switch' : 'light';
    if (!s.on) return { domain, service: 'turn_off', target };
    if (s.brightness !== null && domain === 'light') return { domain, service: 'turn_on', data: { brightness: s.brightness }, target };
    return { domain, service: 'turn_on', target };
  });
}

export async function runCalls(hass: HomeAssistant, calls: readonly ServiceCall[]): Promise<void> {
  await Promise.all(calls.map((c) => hass.callService(c.domain, c.service, c.data, c.target)));
}

/** The lights of the snapshot that already show a change. */
function moved(snapshot: readonly LightSnapshot[], hass: HomeAssistant): LightSnapshot[] {
  return snapshot.filter((s) => {
    const st = hass.states[s.entityId];
    if (!st || st.state === 'unavailable' || st.state === 'unknown') return false;
    const on = st.state === 'on';
    if (on !== s.on) return true;
    const b = st.attributes.brightness;
    return on && s.brightness !== null && typeof b === 'number' && b !== s.brightness;
  });
}

/**
 * The lights that moved away from the snapshot. When none has moved yet (Desfazer tapped before the
 * first answer arrived), all of them, so a quick undo still works.
 */
export function changedSince(snapshot: readonly LightSnapshot[], hass: HomeAssistant): LightSnapshot[] {
  const changed = moved(snapshot, hass);
  return changed.length ? changed : [...snapshot];
}

/** How long Desfazer waits for an action that has not answered before putting the lights back. */
export const UNDO_WAIT_MS = 2500;

/**
 * The lights a scene sets, from its `entity_id` attribute: its `light.*` members, plus the members
 * the panel shows as lights (`lightIds`, where the switches with the light role are). None for a
 * script, which does not say.
 */
export function sceneLights(hass: HomeAssistant, sceneId: string, lightIds: readonly string[] = []): string[] {
  const members = hass.states[sceneId]?.attributes.entity_id;
  const panel = new Set(lightIds);
  return Array.isArray(members)
    ? members.filter((m): m is string => typeof m === 'string' && (m.startsWith('light.') || panel.has(m)))
    : [];
}

export interface UndoOptions {
  /** The hass of the moment Desfazer is tapped; the one the action started with is stale by then. */
  current?: () => HomeAssistant | undefined;
  /** Calls that stop what the action started (a running script) before the lights go back. */
  stop?: readonly ServiceCall[];
  /**
   * The lights the action is known to set ("Apagar tudo", a scene's members). They always go back,
   * whether or not their change has arrived; putting back a light that did not move changes nothing.
   */
  targets?: readonly string[];
  /** Called when the action fails and no light has changed: there is nothing to undo. */
  failed?: () => void;
}

/** Takes a snapshot, offers the undo at once, then runs the action. */
export async function withUndo(
  hass: HomeAssistant,
  ids: readonly string[],
  action: () => Promise<unknown>,
  show: (onUndo: () => void) => void,
  options: UndoOptions = {},
): Promise<void> {
  const snapshot = snapshotLights(hass, ids);
  const known = new Set(options.targets ?? []);
  let running: Promise<unknown> = Promise.resolve();
  show(() => {
    void (async () => {
      // Let the action land first, so what it changed is known, but never wait more than UNDO_WAIT_MS.
      let timer: ReturnType<typeof setTimeout> | undefined;
      await Promise.race([running.catch(() => undefined), new Promise((resolve) => (timer = setTimeout(resolve, UNDO_WAIT_MS)))]);
      clearTimeout(timer);
      const now = options.current?.() ?? hass;
      if (options.stop?.length) await runCalls(now, options.stop);
      const targets = snapshot.filter((s) => known.has(s.entityId));
      const others = snapshot.filter((s) => !known.has(s.entityId));
      const rest = targets.length ? moved(others, now) : changedSince(others, now);
      await runCalls(now, restoreCalls([...targets, ...rest]));
    })().catch(() => haptic('failure'));
  });
  try {
    running = action();
    await running;
  } catch {
    haptic('failure');
    // A failed call may still have changed some lights (one bad member of a scene): keep the undo then.
    if (moved(snapshot, options.current?.() ?? hass).length === 0) options.failed?.();
  }
}
