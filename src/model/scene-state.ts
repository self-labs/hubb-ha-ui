import type { HomeAssistant } from '../ha/types';
import type { SceneItem } from './types';

/**
 * Whether a scene's button shows it on: the light or switch it follows (`entities.<id>.follows`) is
 * on. A scene does not say whether it is still in effect, so the installer picks the light that tells.
 */
export function sceneIsOn(hass: HomeAssistant, scene: Pick<SceneItem, 'follows'>): boolean {
  return !!scene.follows && hass.states[scene.follows]?.state === 'on';
}
