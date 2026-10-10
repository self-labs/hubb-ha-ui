import type { HomeAssistant } from '../ha/types';
import { allLightIds, buildHouse } from '../model/build-house';
import type { HubbConfig } from '../model/types';
import { S } from '../strings';

export interface LovelaceCardConfig {
  type: string;
  [key: string]: unknown;
}

export interface LovelaceViewConfig {
  title: string;
  path: string;
  type: 'panel';
  subview?: boolean;
  cards: LovelaceCardConfig[];
}

export interface LovelaceConfig {
  title: string;
  views: LovelaceViewConfig[];
}

/** One panel view per screen; each screen card gets the slice of the house it draws. Never throws. */
export function generateDashboard(config: HubbConfig, hass: HomeAssistant): LovelaceConfig {
  try {
    const house = buildHouse(hass, config);
    const lightIds = allLightIds(house);
    return {
      title: house.name,
      views: [
        { title: S.home, path: 'home', type: 'panel', cards: [{ type: 'custom:hubb-home-screen', house }] },
        {
          title: S.scenes,
          path: 'scenes',
          type: 'panel',
          subview: true,
          cards: [{ type: 'custom:hubb-scenes-screen', scenes: house.scenes, lightIds }],
        },
        ...house.rooms.map(
          (room): LovelaceViewConfig => ({
            title: room.name,
            path: room.path,
            type: 'panel',
            subview: true,
            cards: [{ type: 'custom:hubb-room-screen', room, lightIds }],
          }),
        ),
      ],
    };
  } catch (err) {
    return {
      title: 'Hubb',
      views: [
        {
          title: S.home,
          path: 'home',
          type: 'panel',
          cards: [{ type: 'custom:hubb-error-card', message: S.panelError, detail: err instanceof Error ? err.message : String(err) }],
        },
      ],
    };
  }
}
