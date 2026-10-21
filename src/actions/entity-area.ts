import type { HomeAssistant } from '../ha/types';

/**
 * Puts one entity in an area of Home Assistant, or back on its device's (null). It writes the area of
 * the entity, never of its device: a relay board is one device for its 16 channels, and an area on
 * the device would move all of them (Gustavo, 16/10). Administrators only, like the editor.
 *
 * The exception is an entity with no name of its own, the one named after its device: since 2026.10
 * Home Assistant refuses an area on it ("set the area on its device instead"), so the area goes on the
 * device. Such an entity is the device itself, a one-channel switch or a speaker, so nothing else moves.
 */
export async function setEntityArea(hass: HomeAssistant, entityId: string, areaId: string | null): Promise<void> {
  if (!hass.callWS) throw new Error('no websocket');
  const reg = hass.entities[entityId];
  if (reg?.device_id && !reg.name?.trim()) {
    await hass.callWS({ type: 'config/device_registry/update', device_id: reg.device_id, area_id: areaId });
    return;
  }
  await hass.callWS({ type: 'config/entity_registry/update', entity_id: entityId, area_id: areaId });
}
