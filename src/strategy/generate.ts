import type { HomeAssistant } from '../ha/types';
import { allLightIds, buildHouse } from '../model/build-house';
import type { HubbConfig } from '../model/types';
import { REVIEW, S } from '../strings';

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
    const { homeLabel } = house;
    // Only an administrator gets the review; for a resident its address falls back to the home.
    const review: LovelaceViewConfig[] = hass.user?.is_admin
      ? [
          {
            title: REVIEW.title,
            path: 'revisar',
            type: 'panel',
            subview: true,
            cards: [{ type: 'custom:hubb-review-screen', options: config, homeLabel }],
          },
        ]
      : [];
    return {
      title: house.name,
      views: [
        { title: homeLabel, path: 'home', type: 'panel', cards: [{ type: 'custom:hubb-home-screen', house, options: config }] },
        {
          title: S.scenes,
          path: 'scenes',
          type: 'panel',
          subview: true,
          cards: [{ type: 'custom:hubb-scenes-screen', scenes: house.scenes, lightIds, homeLabel }],
        },
        ...house.rooms.map(
          (room): LovelaceViewConfig => ({
            title: room.name,
            path: room.path,
            type: 'panel',
            subview: true,
            cards: [{ type: 'custom:hubb-room-screen', room, lightIds, homeLabel }],
          }),
        ),
        ...review,
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
