import type { HomeAssistant } from '../ha/types';
import { ORIGIN } from '../strings';

/**
 * The integration an entity comes from, the way an installer knows it ("LG ThinQ", "SmartThinQ");
 * the integration id when the panel does not know it, null when the registry does not say. Only the
 * edit mode and the review show it: two integrations of one device give two items with one name.
 */
export function originOf(hass: HomeAssistant, entityId: string): string | null {
  const platform = hass.entities[entityId]?.platform;
  return platform ? (ORIGIN[platform] ?? platform) : null;
}
