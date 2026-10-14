import type { HomeAssistant } from '../ha/types';
import { deviceEntities } from './appliances';
import type { EntitySettings } from './config';

/** The channel number at the end of an id: `switch.bl_1` is 1, `switch.kitnet_banheiro` has none. */
const channel = (entityId: string): string | null => /_(\d+)$/.exec(entityId)?.[1] ?? null;

/**
 * The power and energy sensors of an outlet or equipment, from its own device. A lone switch takes the
 * lone sensor of each class; with several, the sensor ending in the same number as the switch. The YAML
 * (`entities.<id>.power`, `.energy`) wins: a renamed multi-channel switch has no number to match.
 */
export function consumptionOf(hass: HomeAssistant, switchId: string, s?: EntitySettings): { power: string | null; energy: string | null } {
  const deviceId = hass.entities[switchId]?.device_id;
  const ids = deviceId ? deviceEntities(hass, deviceId) : [];
  // A child lock or another configuration switch of a plug is not a channel of its own.
  const switches = ids.filter((id) => id.startsWith('switch.') && !hass.entities[id]?.entity_category);
  const pick = (cls: string): string | null => {
    const sensors = ids.filter((id) => id.startsWith('sensor.') && hass.states[id]?.attributes.device_class === cls);
    if (sensors.length === 1 && switches.length === 1) return sensors[0]!;
    const n = channel(switchId);
    return n ? (sensors.find((id) => channel(id) === n) ?? null) : null;
  };
  return { power: s?.power ?? pick('power'), energy: s?.energy ?? pick('energy') };
}
