import type { HomeAssistant } from '../ha/types';

/**
 * Puts one entity in an area of Home Assistant, or back on its device's (null). It writes the area of
 * the entity, never of its device: a relay board is one device for its 16 channels, and an area on
 * the device would move all of them (Gustavo, 16/10). Administrators only, like the editor.
 */
export async function setEntityArea(hass: HomeAssistant, entityId: string, areaId: string | null): Promise<void> {
  if (!hass.callWS) throw new Error('no websocket');
  await hass.callWS({ type: 'config/entity_registry/update', entity_id: entityId, area_id: areaId });
}
