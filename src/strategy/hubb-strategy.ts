import { define } from '../elements/define';
import type { HomeAssistant } from '../ha/types';
import type { HubbConfig } from '../model/types';
import { generateDashboard, type LovelaceConfig } from './generate';
import './place-editor';

export class HubbDashboardStrategy extends HTMLElement {
  static async generate(config: HubbConfig, hass: HomeAssistant): Promise<LovelaceConfig> {
    return generateDashboard(config, hass);
  }

  /** Home Assistant asks the kind of place (src/strategy/place-editor.ts) before it creates the dashboard. */
  static configRequired = true;

  static getConfigElement(): HTMLElement {
    return document.createElement('hubb-place-editor');
  }

  /** The name and icon Home Assistant offers for a new dashboard: the place, never "Casa" for a clinic. */
  static getCreateSuggestions(hass: HomeAssistant): { title: string; icon: string } {
    return { title: hass.config.location_name || 'Hubb', icon: 'mdi:view-dashboard-outline' };
  }
}

define('ll-strategy-dashboard-hubb', HubbDashboardStrategy);

window.customStrategies = window.customStrategies ?? [];
if (!window.customStrategies.some((s) => s.type === 'hubb')) {
  window.customStrategies.push({
    type: 'hubb',
    strategyType: 'dashboard',
    name: 'Hubb',
    description: 'Painel da Hubb, montado a partir das áreas da casa.',
    documentationURL: 'https://github.com/self-labs/hubb-ha-ui',
  });
}
