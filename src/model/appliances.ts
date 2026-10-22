import type { HomeAssistant } from '../ha/types';
import { applianceStatePt } from '../strings';
import type { EntitySettings } from './config';

export type Command = 'on' | 'off' | 'start' | 'pause' | 'resume' | 'stop' | 'other';

export interface ApplianceButton {
  entityId: string;
  command: Command;
}

/** The entities of an appliance's device that the panel uses. */
export interface ApplianceParts {
  state: string | null;
  remaining: string | null;
  progress: string | null;
  buttons: ApplianceButton[];
  /** Program, level and other choices. */
  selects: string[];
  /** Options such as turbo, extra rinse or water reuse. */
  switches: string[];
  /** Whether the appliance reaches the maker's cloud (Electrolux `connectivityState`). Missing on old dashboards. */
  connection?: string | null;
  /** Whether the appliance takes commands from afar (Electrolux `remoteControl`). Missing on old dashboards. */
  remote?: string | null;
}

/** Whether a command from the panel can reach the appliance now. */
export type Reach = 'ok' | 'offline' | 'remote-off';

export interface ApplianceItem {
  deviceId: string;
  /** The entity the installer marked with the appliance role. */
  entityId: string;
  name: string;
  parts: ApplianceParts;
}

export type Situation = 'working' | 'paused' | 'stopped';

/** What the appliance is, read from its name: it picks the icon and the word for "running". */
export type ApplianceKind = 'dishwasher' | 'washer' | 'dryer' | 'other';

export function applianceKind(name: string): ApplianceKind {
  const n = name.toLocaleLowerCase('pt-BR');
  if (/lou[cç]|dish/.test(n)) return 'dishwasher';
  if (/lav|wash/.test(n)) return 'washer';
  if (/sec|dry/.test(n)) return 'dryer';
  return 'other';
}

/** Integrations whose devices "Revisar o painel" suggests as appliances. */
export const APPLIANCE_PLATFORMS: readonly string[] = ['electrolux_status', 'lg_thinq', 'smartthinq_sensors'];

const STRICT_STATE = ['appliance_state', 'appliancestate', 'run_state', 'runstate', 'machine_state', 'machinestate'];
const LOOSE_STATE = ['current_state', 'currentstate', 'state'];
const NOT_STATE = ['connectivity', 'network', 'link', 'remote'];
const REMAINING = ['time_to_end', 'timetoend', 'remaining', 'remain'];
const CONNECTION = ['connectivity_state', 'connectivitystate'];
const REMOTE = ['remote_control', 'remotecontrol'];
/**
 * The values of `remoteControl` that refuse commands. From the capabilities Electrolux publishes for
 * a washer: commands are disabled on DISABLED and NOT_SAFETY_RELEVANT_ENABLED; TEMPORARY_LOCKED says
 * it in its name. Only ENABLED takes them.
 */
const REMOTE_OFF = new Set(['disabled', 'not_safety_relevant_enabled', 'temporary_locked']);
const UNSEEN = new Set(['unavailable', 'unknown']);

const domainOf = (entityId: string): string => entityId.slice(0, entityId.indexOf('.'));
const keyOf = (hass: HomeAssistant, entityId: string): string =>
  `${entityId} ${hass.entities[entityId]?.translation_key ?? ''}`.toLowerCase();

/** A switch that only turns its device on and off (LG ThinQ `operation_power`): the sheet has that button. */
export function isPowerTwin(hass: HomeAssistant, entityId: string): boolean {
  if (!entityId.startsWith('switch.')) return false;
  const key = hass.entities[entityId]?.translation_key ?? '';
  return key === 'operation_power' || key === 'power' || /_power$/.test(entityId);
}

/** Entities of a device, by id, leaving out the ones hidden in Home Assistant. */
export function deviceEntities(hass: HomeAssistant, deviceId: string): string[] {
  return Object.keys(hass.entities)
    .filter((id) => hass.entities[id]!.device_id === deviceId && !hass.entities[id]!.hidden)
    .sort();
}

/**
 * The appliance state sensor of a device; `strict` keeps only names that clearly say so. A clear name
 * ("appliancestate") always counts; the words of NOT_STATE only rule out the loose matches
 * ("connectivitystate"), so a device called "Link" keeps its state sensor. `hide` is left out.
 */
export function stateSensorOf(hass: HomeAssistant, deviceId: string, strict = false, hide: ReadonlySet<string> = new Set()): string | null {
  const sensors = deviceEntities(hass, deviceId).filter((id) => domainOf(id) === 'sensor' && !hide.has(id));
  for (const pattern of STRICT_STATE) {
    const found = sensors.find((id) => keyOf(hass, id).includes(pattern));
    if (found) return found;
  }
  if (strict) return null;
  const loose = sensors.filter((id) => !NOT_STATE.some((w) => keyOf(hass, id).includes(w)));
  for (const pattern of LOOSE_STATE) {
    const found = loose.find((id) => keyOf(hass, id).includes(pattern));
    if (found) return found;
  }
  return null;
}

/** What a button does, read from its name and translation key, in English or in Portuguese. */
export function commandOf(hass: HomeAssistant, entityId: string): Command {
  const name = hass.states[entityId]?.attributes.friendly_name;
  // command_on, command_stopreset: an underscore would hide the word from the word boundaries below.
  const key = (hass.entities[entityId]?.translation_key ?? '').replace(/_/g, ' ');
  const text = `${typeof name === 'string' ? name : ''} ${key}`.toLowerCase();
  const rules: Array<[Command, RegExp]> = [
    ['off', /\b(off|desligar)\b/],
    ['on', /\b(on|ligar)\b/],
    ['start', /\b(start|iniciar)\b/],
    ['pause', /\b(pause|pausar)\b/],
    ['resume', /\b(resume|retomar|continuar)\b/],
    ['stop', /\b(stop|stopreset|parar)\b/],
  ];
  return rules.find(([, re]) => re.test(text))?.[0] ?? 'other';
}

export function findParts(hass: HomeAssistant, deviceId: string, marked: string, s?: EntitySettings): ApplianceParts {
  const hide = new Set(s?.hide ?? []);
  const ids = deviceEntities(hass, deviceId).filter((id) => !hide.has(id));
  const of = (domain: string): string[] => ids.filter((id) => domainOf(id) === domain);
  const sensors = of('sensor');
  const durations = sensors.filter((id) => hass.states[id]?.attributes.device_class === 'duration');
  return {
    state: domainOf(marked) === 'sensor' && !hide.has(marked) ? marked : stateSensorOf(hass, deviceId, false, hide),
    remaining:
      s?.remaining ??
      durations.find((id) => REMAINING.some((w) => keyOf(hass, id).includes(w))) ??
      (durations.length === 1 ? durations[0]! : null),
    progress:
      s?.progress ??
      sensors.find((id) => hass.states[id]?.attributes.unit_of_measurement === '%' && keyOf(hass, id).includes('progress')) ??
      null,
    buttons: of('button').map((id) => ({ entityId: id, command: commandOf(hass, id) })),
    selects: of('select'),
    switches: of('switch'),
    connection: sensors.find((id) => CONNECTION.some((w) => keyOf(hass, id).includes(w))) ?? null,
    remote: sensors.find((id) => REMOTE.some((w) => keyOf(hass, id).includes(w))) ?? null,
  };
}

/** "Not Safety Relevant Enabled", "NOT_SAFETY_RELEVANT_ENABLED": one spelling to compare. */
const valueOf = (hass: HomeAssistant, entityId: string | null | undefined): string =>
  (entityId ? (hass.states[entityId]?.state ?? '') : '').toLowerCase().replace(/[\s-]+/g, '_');

/**
 * Whether a command can reach the appliance: out of reach when it says it is disconnected, refused
 * when its remote control is off. A sensor that is missing, unknown or unavailable says nothing.
 */
export function applianceReach(hass: HomeAssistant, parts: ApplianceParts): Reach {
  if (valueOf(hass, parts.connection) === 'disconnected') return 'offline';
  if (REMOTE_OFF.has(valueOf(hass, parts.remote))) return 'remote-off';
  return 'ok';
}

/** Minutes to the end, from a duration sensor in seconds, minutes or hours; null when unknown. */
export function remainingMinutes(hass: HomeAssistant, parts: ApplianceParts): number | null {
  if (!parts.remaining) return null;
  const st = hass.states[parts.remaining];
  const v = Number(st?.state);
  if (!st || st.state === '' || !Number.isFinite(v)) return null;
  const unit = st.attributes.unit_of_measurement;
  const minutes = unit === 's' ? v / 60 : unit === 'h' ? v * 60 : v;
  return Math.max(0, Math.ceil(minutes));
}

/** 0 to 100 from the progress sensor; null when there is none or it says nothing. */
export function progressPct(hass: HomeAssistant, parts: ApplianceParts): number | null {
  if (!parts.progress) return null;
  const v = Number(hass.states[parts.progress]?.state);
  return Number.isFinite(v) ? Math.min(100, Math.max(0, Math.round(v))) : null;
}

const PAUSED = /pause/;
const WORKING = /run|wash|rins|spin|dry|cook|clean|heat|lavand|enx[aá]g|centrif|secand/;
// Beyond the words of the spec: "ready" (Electrolux "Ready To Start") and "standby" (LG) wait with
// the program length already in the time to end.
const IDLE = /stop|idle|off|end|finish|complete|ready|standby|parad|deslig|conclu|pront/;

export function situation(hass: HomeAssistant, parts: ApplianceParts): Situation {
  const raw = (parts.state ? (hass.states[parts.state]?.state ?? '') : '').toLowerCase();
  if (UNSEEN.has(raw)) return 'stopped';
  if (PAUSED.test(raw)) return 'paused';
  if (WORKING.test(raw)) return 'working';
  const minutes = remainingMinutes(hass, parts);
  return minutes !== null && minutes > 0 && !IDLE.test(raw) ? 'working' : 'stopped';
}

/**
 * The state as a person reads it: translated by the integration when it can, else in Portuguese
 * when the panel knows the word (Electrolux only title-cases its raw values), else the raw value.
 * Null without a state sensor.
 */
export function stateText(hass: HomeAssistant, parts: ApplianceParts, name = ''): string | null {
  const st = parts.state ? hass.states[parts.state] : undefined;
  if (!st) return null;
  const shown = hass.formatEntityState ? hass.formatEntityState(st) : st.state;
  return shown === st.state ? (applianceStatePt(st.state, applianceKind(name)) ?? shown) : shown;
}

export function applianceName(hass: HomeAssistant, deviceId: string, s?: EntitySettings): string {
  const dev = hass.devices[deviceId];
  return s?.name ?? dev?.name_by_user ?? dev?.name ?? deviceId;
}

// Idle: an Electrolux washer says it after Desligar and ignores Iniciar until Ligar (Gustavo's house, 22/10).
const POWERED_OFF = /^off$|^idle$|power_?off|deslig/;

/** Whether the appliance is switched off or out of reach: then "Desligar" has nothing to do. */
export function isPoweredOff(hass: HomeAssistant, parts: ApplianceParts): boolean {
  const raw = (parts.state ? (hass.states[parts.state]?.state ?? '') : '').toLowerCase();
  return UNSEEN.has(raw) || POWERED_OFF.test(raw);
}

/**
 * The buttons that make sense now, in their order; the stop and the unknown ones come after them.
 * A stopped appliance that is still on ("Ready To Start", "End Of Cycle") offers Iniciar and Desligar;
 * one that is switched off, Ligar and Iniciar.
 */
export function buttonsFor(
  parts: ApplianceParts,
  now: Situation,
  poweredOff = false,
): { main: ApplianceButton[]; more: ApplianceButton[] } {
  const wanted: Record<Situation, Command[]> = {
    stopped: poweredOff ? ['on', 'start'] : ['start', 'off'],
    working: ['pause', 'off'],
    paused: ['resume', 'off'],
  };
  const main = wanted[now]
    .map((c) => parts.buttons.find((b) => b.command === c))
    .filter((b): b is ApplianceButton => !!b);
  // A second button for a command already shown ("Luz ligar" beside "Ligar") stays, under its own name.
  const chosen = new Set(main.map((b) => b.entityId));
  const more = parts.buttons.flatMap((b): ApplianceButton[] => {
    if (b.command === 'stop' || b.command === 'other') return [b];
    return !chosen.has(b.entityId) && main.some((m) => m.command === b.command) ? [{ ...b, command: 'other' }] : [];
  });
  return { main, more };
}

/** The choice that looks like the program, for the top of the sheet. */
export function programOf(parts: ApplianceParts): string | null {
  return parts.selects.find((id) => id.includes('program')) ?? null;
}

/** A choice or option the panel shows: not unavailable (the program does not take it) nor unknown. */
export function isShownOption(hass: HomeAssistant, entityId: string): boolean {
  const st = hass.states[entityId];
  return !!st && !UNSEEN.has(st.state);
}
