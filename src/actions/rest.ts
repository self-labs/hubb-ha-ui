import { isEditing } from '../editing';
import type { HomeAssistant } from '../ha/types';
import { restDue, screenCalls, wakesOn, type Tablet } from '../model/tablet';
import { selectRoom } from '../selection';
import { REBUILD_MS } from '../sheets';
import { basePath, navigate } from './navigate';

/**
 * The rest of a wall tablet (spec tablet, Section 4). Module state, like the edit mode: Home Assistant
 * rebuilds the screens after a save or a registry change, and the count of the minutes with no touch
 * must not start over. Every screen hands it the tablet of its user and the newest hass; it decides by
 * the clock, so a timer the browser holds back only fires late, never early.
 */
let tablet: Tablet | null = null;
let hass: HomeAssistant | null = null;
let lastTouch = Date.now();
let resting = false;
let timer: ReturnType<typeof setTimeout> | null = null;
let listening = false;
let presenceBefore: Record<string, string | undefined> = {};
/** Screens of the panel on the page now, and when the last one left: it only rests over the panel. */
let screens = 0;
let goneAt = 0;
/** Bumped by the reset between tests, so a screen left over from the test before counts for nothing. */
let generation = 0;
const listeners = new Set<() => void>();

export const isResting = (): boolean => resting;

export function onRestChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function tell(): void {
  listeners.forEach((fn) => fn());
}

/**
 * The commands of the app that dim or light the screen of a tablet (the current one unless told),
 * one after the other: Android turns the automatic brightness off before it takes a level. A refusal
 * (a permission not given) is let go.
 */
function sendScreen(phase: 'rest' | 'wake', t: Tablet | null = tablet): void {
  const h = hass;
  if (!h || !t?.notify || !t.platform) return;
  const notify = t.notify;
  const send = (call: { message: string; data: Record<string, unknown> }): Promise<unknown> =>
    h.callService('notify', notify, { message: call.message, data: call.data }, undefined, false).catch(() => undefined);
  const [first, ...more] = screenCalls(t.platform, phase);
  if (!first) return;
  let chain = send(first);
  for (const call of more) chain = chain.then(() => send(call));
}

/**
 * A screen of the panel on the page (the home, a room, Cenas, Segurança, not one drawn inside another).
 * It only rests over the panel: a resident who swiped to the map of Home Assistant has nothing there
 * to wake it. Back on the panel, the minutes count from then, unless it was only Home Assistant
 * rebuilding the page. Returns the way to say the screen left.
 */
export function screenShown(): () => void {
  screens += 1;
  if (screens === 1 && Date.now() - goneAt > REBUILD_MS) {
    lastTouch = Date.now();
    schedule();
  }
  let left = false;
  const mine = generation;
  return () => {
    if (left || mine !== generation) return;
    left = true;
    screens -= 1;
    if (screens === 0) goneAt = Date.now();
  };
}

function clearTimer(): void {
  if (timer) clearTimeout(timer);
  timer = null;
}

function schedule(): void {
  clearTimer();
  if (!tablet || resting || tablet.restAfter <= 0) return;
  const wait = lastTouch + tablet.restAfter * 60_000 - Date.now();
  timer = setTimeout(check, Math.max(0, wait));
}

function check(): void {
  timer = null;
  if (!tablet || resting) return;
  // The installer setting the panel up is touching it: the edit mode never rests. Nor does a page that
  // is not the panel.
  if (isEditing() || screens === 0) lastTouch = Date.now();
  if (restDue(lastTouch, Date.now(), tablet.restAfter)) rest();
  else schedule();
}

function rest(): void {
  resting = true;
  clearTimer();
  // Whatever page was open, it wakes up on the home of the panel.
  const home = `${basePath()}/home`;
  if (window.location.pathname !== home) navigate(home, { replace: true });
  sendScreen('rest');
  tell();
}

/** A touch on the rest screen or a presence switching on: back to the room of the tablet. */
export function wake(): void {
  if (!resting) return;
  resting = false;
  lastTouch = Date.now();
  if (tablet?.room) selectRoom(tablet.room);
  sendScreen('wake');
  tell();
  schedule();
}

const touched = (): void => {
  lastTouch = Date.now();
  // Resting away from the panel (no rest screen to tap), any touch wakes it.
  if (resting && screens === 0) wake();
  else if (!resting) schedule();
};

const visible = (): void => {
  if (document.visibilityState !== 'visible') return;
  clearTimer();
  check();
};

/** The tablet of the user who sees the panel (null for everyone else) and the newest hass. */
export function configureRest(next: Tablet | null, h: HomeAssistant): void {
  hass = h;
  const before = tablet;
  const changed = JSON.stringify(next) !== JSON.stringify(before);
  const sameDevice = before?.notify === next?.notify && before?.platform === next?.platform;
  tablet = next;
  // Taken off, or moved to another device, while it rests: the old screen is lit before it is forgotten.
  if (resting && before && !sameDevice) {
    sendScreen('wake', before);
    resting = false;
    tell();
  }
  // A page that opens as a tablet (or a new device) lights the screen once: a reload while it rested
  // would otherwise leave it dim, with no rest to wake from.
  if (next && !resting && !sameDevice) sendScreen('wake', next);
  if (!tablet) {
    clearTimer();
    if (resting) {
      resting = false;
      tell();
    }
    return;
  }
  if (!listening) {
    listening = true;
    window.addEventListener('pointerdown', touched, { capture: true });
    window.addEventListener('keydown', touched, { capture: true });
    document.addEventListener('visibilitychange', visible);
  }
  // A presence switching on wakes it; one held on (a stuck sensor) does not keep it from resting.
  if (resting && wakesOn(presenceBefore, h, tablet.presence)) wake();
  presenceBefore = Object.fromEntries(tablet.presence.map((id) => [id, h.states[id]?.state]));
  if (changed) {
    lastTouch = Date.now();
    schedule();
  }
}

/** Awake, with no tablet and no listeners, between tests. */
export function resetRestForTests(): void {
  clearTimer();
  if (listening) {
    window.removeEventListener('pointerdown', touched, { capture: true });
    window.removeEventListener('keydown', touched, { capture: true });
    document.removeEventListener('visibilitychange', visible);
  }
  listening = false;
  tablet = null;
  hass = null;
  resting = false;
  screens = 0;
  goneAt = 0;
  generation += 1;
  presenceBefore = {};
  lastTouch = Date.now();
}
