import { degrees } from '../actions/climate';
import type { HomeAssistant } from '../ha/types';
import { ALARM, PILLS } from '../strings';
import { climateOn, lightsOnByRoom, openingWord, openNow } from '../summary';
import type { House, OpeningItem } from './types';

/** One pill of the summary of the house, on the column of the wide home and the rest screen. */
export interface Pill {
  kind: 'lights' | 'climate' | 'security' | 'energy';
  title: string;
  detail: string;
}

/** "1,2 kW" or "850 W", from a power sensor in W or kW; null when it reads nothing. */
function power(hass: HomeAssistant, entityId: string): string | null {
  const st = hass.states[entityId];
  const v = Number(st?.state);
  if (!st || st.state === '' || !Number.isFinite(v)) return null;
  const watts = st.attributes.unit_of_measurement === 'kW' ? v * 1000 : v;
  return watts >= 1000 ? `${(watts / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} kW` : `${Math.round(watts)} W`;
}

/**
 * The summary of the house in four pills, each only when it has something to say: the lights on and
 * where, the air conditioners on, what is open (or that all is closed, with the alarm) when the house
 * has a Segurança tab, and the power now when the installer picked the meter of the house.
 */
export function summaryPills(house: House, hass: HomeAssistant, opts: { security: boolean; housePower: string | null }): Pill[] {
  const pills: Pill[] = [];
  const lit = lightsOnByRoom(house, hass);
  const on = lit.reduce((n, g) => n + g.on.length, 0);
  if (on) pills.push({ kind: 'lights', title: PILLS.lightsOn(on), detail: PILLS.where(lit.map((g) => g.room.name)) });
  const airs = climateOn(house.rooms, hass);
  if (airs.length) {
    const first = airs[0]!;
    pills.push({ kind: 'climate', title: PILLS.climateOn(airs.length), detail: PILLS.climateAt(first.roomName, first.target === null ? null : degrees(first.target)) });
  }
  if (opts.security) {
    // What Segurança lists: every opening, with or without a room. One that does not answer is no
    // all-clear there, so it is none here either.
    const openings = house.security.openings;
    const open = openNow(hass, openings);
    const unread = openings.filter((o) => !['on', 'off'].includes(hass.states[o.entityId]?.state ?? ''));
    const where = (o: OpeningItem): string => `${o === open[0] ? openingWord(o) : o.name}${o.roomName ? ` · ${o.roomName}` : ''}`;
    const alarm = house.security.alarms[0];
    const alarmWord = alarm ? (ALARM.state[hass.states[alarm.entityId]?.state ?? ''] ?? '') : '';
    pills.push(
      open.length
        ? { kind: 'security', title: PILLS.open(open.length), detail: where(open[0]!) }
        : unread.length
          ? { kind: 'security', title: PILLS.noAnswer(unread.length), detail: where(unread[0]!) }
          : { kind: 'security', title: PILLS.allClosed, detail: alarmWord },
    );
  }
  const now = opts.housePower ? power(hass, opts.housePower) : null;
  if (now) pills.push({ kind: 'energy', title: now, detail: PILLS.energyNow });
  return pills;
}
