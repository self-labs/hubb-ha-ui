import { define } from '../elements/define';
import type { HomeAssistant } from '../ha/types';
import type { HubbConfig } from '../model/types';
import { generateDashboard, type LovelaceConfig } from './generate';

export class HubbDashboardStrategy extends HTMLElement {
  static async generate(config: HubbConfig, hass: HomeAssistant): Promise<LovelaceConfig> {
    return generateDashboard(config, hass);
  }

  static getCreateSuggestions(): { title: string; icon: string } {
    return { title: 'Casa', icon: 'mdi:home-outline' };
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
