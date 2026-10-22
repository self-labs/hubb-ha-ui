import type { HomeAssistant } from '../ha/types';
import { CFG } from '../strings';
import type { ConfigProblem } from './config';
import type { HubbConfig, Room, TabletOverride } from './types';
import { hiddenForList } from './visibility';

/** The minutes with no touch a tablet can rest after; 0 never rests. */
export const REST_CHOICES = [2, 5, 10, 15, 0] as const;
export const DEFAULT_REST = 5;

/** The app on the tablet, which decides the commands that dim and light its screen. */
export type Platform = 'ios' | 'android';

/** A wall tablet as the screens use it: everything checked, nothing pointing nowhere. */
export interface Tablet {
  /** The area it opens on and wakes up to; null when that room is not on the panel of its user. */
  room: string | null;
  /** Minutes with no touch before it rests; 0 never. */
  restAfter: number;
  /** The sensors whose switch on wakes it. */
  presence: string[];
  /** The `notify` service of its app; null when there is none to send to. */
  notify: string | null;
  platform: Platform | null;
}

/** A command of the Home Assistant app, sent as the message of a notification. */
export interface ScreenCall {
  message: string;
  data: Record<string, unknown>;
}

/**
 * The commands that dim the screen of a resting tablet and light it when it wakes (checked on his iPad
 * Mini 5 and Android phone, 20/10). The iPad app takes them in its Modo quiosque, in percent; Android
 * takes 0 to 255 and needs "Modificar configurações do sistema", and its screen command always keeps
 * "Manter tela ligada", which the app would switch off otherwise. Android cannot say the brightness it
 * had, so waking hands it back to the automatic brightness.
 */
export function screenCalls(platform: Platform, phase: 'rest' | 'wake'): ScreenCall[] {
  if (platform === 'ios') return [{ message: 'kiosk_set_brightness', data: { level: phase === 'rest' ? 5 : 80 } }];
  return phase === 'rest'
    ? [
        { message: 'command_auto_screen_brightness', data: { command: 'turn_off' } },
        { message: 'command_screen_brightness_level', data: { command: 10 } },
      ]
    : [
        { message: 'command_screen_on', data: { command: 'keep_screen_on' } },
        { message: 'command_auto_screen_brightness', data: { command: 'turn_on' } },
      ];
}

/** A name as Home Assistant spells it in a service ("iPad da Lia" -> "ipad_da_lia"). */
export function slugify(name: string): string {
  return name
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/**
 * iPad or Android, from the maker of the device whose name the `notify.mobile_app_*` service carries;
 * null when no device answers to it.
 */
export function platformOf(hass: HomeAssistant, notify: string): Platform | null {
  const slug = notify.replace(/^mobile_app_/, '');
  const named = Object.values(hass.devices).filter((d) => d.name && slugify(d.name) === slug);
  // Browser Mod names its device after the browser, often the same name: the app's has its entities.
  const app = new Set(Object.values(hass.entities).filter((e) => e.platform === 'mobile_app').map((e) => e.device_id));
  const dev = named.find((d) => app.has(d.id)) ?? named[0];
  if (!dev) return null;
  return dev.manufacturer === 'Apple' ? 'ios' : 'android';
}

/** Whether a tablet left this long untouched rests now; decided by the clock, never by counting ticks. */
export function restDue(lastTouch: number, now: number, minutes: number): boolean {
  return minutes > 0 && now - lastTouch >= minutes * 60_000;
}

/** Whether one of the sensors went from off to on: a sensor coming back from unavailable wakes nobody. */
export function wakesOn(prev: Readonly<Record<string, string | undefined>>, hass: HomeAssistant, ids: readonly string[]): boolean {
  return ids.some((id) => prev[id] === 'off' && hass.states[id]?.state === 'on');
}

/** `tablets` as far as it holds, and the problems of the rest, for "Revisar o painel". */
export function readTablets(hass: HomeAssistant, config: HubbConfig): { tablets: Record<string, TabletOverride>; problems: ConfigProblem[] } {
  const problems: ConfigProblem[] = [];
  const tablets: Record<string, TabletOverride> = {};
  const raw: unknown = config.tablets;
  if (raw === undefined) return { tablets, problems };
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    problems.push({ key: 'tablets', entityId: null, message: CFG.badTablets });
    return { tablets, problems };
  }
  for (const [userId, value] of Object.entries(raw as Record<string, unknown>)) {
    const at = `tablets.${userId}`;
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      problems.push({ key: at, entityId: null, message: CFG.badTablet(userId) });
      continue;
    }
    const v = value as Record<string, unknown>;
    const t: TabletOverride = {};
    if (v.room !== undefined) {
      if (typeof v.room === 'string' && hass.areas[v.room]) {
        t.room = v.room;
        const room = config.rooms?.[v.room];
        if (room?.hidden || hiddenForList(room?.hidden_for).includes(userId)) {
          problems.push({ key: `${at}.room`, entityId: null, message: CFG.tabletRoomHidden(hass.areas[v.room]!.name) });
        }
      } else problems.push({ key: `${at}.room`, entityId: null, message: CFG.unknownArea(String(v.room)) });
    }
    if (v.rest_after !== undefined) {
      if ((REST_CHOICES as readonly unknown[]).includes(v.rest_after)) t.rest_after = v.rest_after as number;
      else problems.push({ key: `${at}.rest_after`, entityId: null, message: CFG.badRest(String(v.rest_after)) });
    }
    if (v.presence !== undefined) {
      if (v.presence === 'none' || (typeof v.presence === 'string' && hass.states[v.presence])) t.presence = v.presence;
      else problems.push({ key: `${at}.presence`, entityId: null, message: CFG.missingEntity(String(v.presence)) });
    }
    if (v.notify !== undefined) {
      if (typeof v.notify === 'string' && hass.services?.notify?.[v.notify]) t.notify = v.notify;
      else problems.push({ key: `${at}.notify`, entityId: null, message: CFG.badNotify(String(v.notify)) });
    }
    tablets[userId] = t;
  }
  return { tablets, problems };
}

/** The tablet of the user who sees the panel, or null: other users, and administrators with no entry, get none. */
export function resolveTablet(hass: HomeAssistant, config: HubbConfig, rooms: readonly Room[], userId: string | undefined): Tablet | null {
  if (!userId) return null;
  const t = readTablets(hass, config).tablets[userId];
  if (!t) return null;
  const room = t.room ? (rooms.find((r) => r.areaId === t.room) ?? null) : null;
  const presence = t.presence === 'none' ? [] : t.presence ? [t.presence] : (room?.presence ?? []);
  const notify = t.notify ?? null;
  return { room: room?.areaId ?? null, restAfter: t.rest_after ?? DEFAULT_REST, presence, notify, platform: notify ? platformOf(hass, notify) : null };
}
