import type { HomeAssistant } from '../ha/types';
import { deviceEntities } from './appliances';
import type { EntitySettings } from './config';

/** The channel number at the end of an id: `switch.bl_1` is 1, `switch.quarto_tomada` has none. */
const channel = (entityId: string): string | null => /_(\d+)$/.exec(entityId)?.[1] ?? null;

/** Sensors that keep long-term statistics first (Hoje reads them), the one that only grows before all. */
const STATE_CLASS_RANK: Readonly<Record<string, number>> = { total_increasing: 0, total: 1, measurement: 2 };
const rankOf = (hass: HomeAssistant, id: string): number => STATE_CLASS_RANK[String(hass.states[id]?.attributes.state_class)] ?? 3;

/**
 * The one sensor among several of one class that counts: the best state class, when no other shares it.
 * Tasmota gives a plug three of energy (today, yesterday, total): today, `total_increasing`, wins.
 */
function best(hass: HomeAssistant, sensors: string[]): string | null {
  if (sensors.length <= 1) return sensors[0] ?? null;
  const top = Math.min(...sensors.map((id) => rankOf(hass, id)));
  const tied = sensors.filter((id) => rankOf(hass, id) === top);
  return tied.length === 1 ? tied[0]! : null;
}

/**
 * The power and energy sensors of an outlet or equipment, from its own device. A lone switch takes the
 * sensor of each class; with several switches, the sensor ending in the same number as the switch.
 * Several sensors of one class leave the choice to their state class (`best`). The YAML
 * (`entities.<id>.power`, `.energy`) wins: a renamed multi-channel switch has no number to match.
 */
export function consumptionOf(hass: HomeAssistant, switchId: string, s?: EntitySettings): { power: string | null; energy: string | null } {
  const deviceId = hass.entities[switchId]?.device_id;
  const ids = deviceId ? deviceEntities(hass, deviceId) : [];
  // A child lock or another configuration switch of a plug is not a channel of its own.
  const switches = ids.filter((id) => id.startsWith('switch.') && !hass.entities[id]?.entity_category);
  const pick = (cls: string): string | null => {
    const sensors = ids.filter((id) => id.startsWith('sensor.') && hass.states[id]?.attributes.device_class === cls);
    const lone = switches.length === 1 ? best(hass, sensors) : null;
    if (lone) return lone;
    const n = channel(switchId);
    const same = n ? sensors.filter((id) => channel(id) === n) : [];
    return best(hass, same) ?? same[0] ?? null;
  };
  return { power: s?.power ?? pick('power'), energy: s?.energy ?? pick('energy') };
}
