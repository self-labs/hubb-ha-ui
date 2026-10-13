import type { HomeAssistant } from '../ha/types';

/** Removes `affix` (and the space next to it) from the start or the end of `name`, ignoring case. */
function stripAffix(name: string, affix: string): string {
  const a = affix.trim();
  if (!a) return name;
  const lower = name.toLocaleLowerCase('pt-BR');
  const la = a.toLocaleLowerCase('pt-BR');
  if (lower.startsWith(`${la} `)) return name.slice(a.length + 1).trim();
  if (lower.endsWith(` ${la}`)) return name.slice(0, name.length - a.length - 1).trim();
  return name;
}

/**
 * The short name a resident reads: the registry name, else the friendly name without the device name;
 * then without the room name. A name that is only the room name stays as it is.
 */
export function displayName(hass: HomeAssistant, entityId: string, roomName: string | null): string {
  const reg = hass.entities[entityId];
  const friendly = hass.states[entityId]?.attributes.friendly_name;
  // An empty registry name means the entity is named after its device (has_entity_name with an
  // empty original name): the friendly name says it, so it counts as no name here.
  const own = reg?.name?.trim() || null;
  let name = (own ?? (typeof friendly === 'string' ? friendly : entityId.slice(entityId.indexOf('.') + 1))).trim();
  if (!own && reg?.device_id) {
    const dev = hass.devices[reg.device_id];
    name = stripAffix(name, dev?.name_by_user ?? dev?.name ?? '') || name;
  }
  if (roomName) name = stripAffix(name, roomName) || name;
  return name;
}
