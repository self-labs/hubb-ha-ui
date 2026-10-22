import type { HomeAssistant } from '../ha/types';
import { allLightIds, buildHouse, hasSecurity, newRoom } from '../model/build-house';
import { PROFILES } from '../model/profiles';
import { resolveTablet } from '../model/tablet';
import { viewerOf } from '../model/visibility';
import type { HubbConfig, Shared } from '../model/types';
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
  kiosk_mode: typeof KIOSK;
}

/**
 * Read by kiosk-mode (HACS, NemesisRE/kiosk-mode) from the dashboard Home Assistant generates, where
 * Home Assistant puts what a strategy returns: a resident sees the panel alone, with no header and
 * no sidebar; an administrator keeps both, for the pencil and the settings. Without kiosk-mode it is
 * a key nobody reads.
 */
export const KIOSK = { non_admin_settings: { hide_header: true, hide_sidebar: true } } as const;

/**
 * One panel view per screen; each screen card gets the slice of the house it draws. Never throws.
 *
 * The views keep their places whatever the panel shows: the fixed ones first, then one per area of
 * Home Assistant, by area id, rooms with nothing on the panel included. Home Assistant keeps the
 * index of the open view when an edit rebuilds the dashboard; a room appearing before it would
 * otherwise send the installer to another screen.
 */
export function generateDashboard(config: HubbConfig, hass: HomeAssistant): LovelaceConfig {
  try {
    const house = buildHouse(hass, config);
    const lightIds = allLightIds(house);
    const viewer = viewerOf(hass);
    const { homeLabel } = house;
    // One object for every screen: the alerts strip and the security tab are the same everywhere.
    // A resident's bar offers Cenas only when they have a scene; an administrator's always, to add one.
    const shared: Shared = {
      alerts: house.alerts,
      security: hasSecurity(house),
      scenes: viewer === null || house.scenes.length > 0,
      media: house.rooms.flatMap((r) => r.media.map((m) => m.entityId)),
      // The strategy runs for the user who sees the panel: only their own tablet comes along.
      tablet: resolveTablet(hass, config, house.rooms, hass.user?.id),
      place: PROFILES[house.profile].place,
    };
    /** Where a tab with nothing for the resident stands: the view keeps its place and sends them home. */
    const away = [{ type: 'custom:hubb-redirect-card' }];
    // Only an administrator gets the review; for a resident its address falls back to the home.
    const review: LovelaceViewConfig[] = hass.user?.is_admin
      ? [
          {
            title: REVIEW.title,
            path: 'revisar',
            type: 'panel',
            subview: true,
            cards: [{ type: 'custom:hubb-review-screen', options: config, homeLabel, shared }],
          },
        ]
      : [];
    return {
      title: house.name,
      kiosk_mode: KIOSK,
      views: [
        { title: homeLabel, path: 'home', type: 'panel', cards: [{ type: 'custom:hubb-home-screen', house, options: config, shared }] },
        {
          title: S.scenes,
          path: 'scenes',
          type: 'panel',
          subview: true,
          cards: shared.scenes
            ? [{ type: 'custom:hubb-scenes-screen', scenes: house.scenes, lightIds, homeLabel, shared, options: config, candidates: house.sceneCandidates }]
            : away,
        },
        {
          title: S.security,
          path: 'seguranca',
          type: 'panel',
          subview: true,
          cards:
            viewer === null || shared.security ? [{ type: 'custom:hubb-security-screen', security: house.security, shared, homeLabel, options: config }] : away,
        },
        ...review,
        ...Object.keys(hass.areas)
          .sort()
          .map((areaId, n): LovelaceViewConfig => {
            const reached = house.rooms.find((r) => r.areaId === areaId) ?? house.sensorRooms.find((r) => r.areaId === areaId);
            // A resident gets nothing of a room hidden for them, or emptied by hidden items (spec,
            // Section 5): no name, no data, a card that sends them home. The view itself stays, so
            // the index of every other one does not move. Administrators keep every page to edit it.
            if (!reached && viewer !== null) {
              return { title: '', path: `vazio-${n + 1}`, type: 'panel', subview: true, cards: [{ type: 'custom:hubb-redirect-card' }] };
            }
            const room = reached ?? newRoom(hass, areaId, config);
            return {
              title: room.name,
              path: room.path,
              type: 'panel',
              subview: true,
              cards: [{ type: 'custom:hubb-room-screen', room, lightIds, homeLabel, options: config, shared }],
            };
          }),
      ],
    };
  } catch (err) {
    return {
      title: 'Hubb',
      // The error is no reason to hand a resident the menus of Home Assistant.
      kiosk_mode: KIOSK,
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
