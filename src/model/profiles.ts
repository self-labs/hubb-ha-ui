import { mdiHomeOutline, mdiOfficeBuildingOutline } from '@mdi/js';
import type { ArtId } from '../art/drawings';
import { S } from '../strings';

/** The kinds of place the panel knows; `home` when the configuration says nothing. */
export const PROFILE_IDS = ['home', 'clinic', 'restaurant', 'office', 'store', 'gym', 'salon', 'hotel'] as const;
export type ProfileId = (typeof PROFILE_IDS)[number];

/** A home, or any business: what the panel calls it ("a casa", "o local") and the icon of the first tab. */
export type Place = 'home' | 'business';

export const PLACE_ICON: Readonly<Record<Place, string>> = { home: mdiHomeOutline, business: mdiOfficeBuildingOutline };

/** Words that only say "a room"; each kind of place decides what they draw. */
export type GenericWord = 'sala' | 'quarto' | 'salao';

export interface Profile {
  place: Place;
  /** Name of the first tab and of the home view. */
  homeLabel: string;
  /** Icon of the first tab. */
  homeIcon: string;
  /** Drawing for an area whose name and icon say nothing. */
  defaultArt: ArtId;
  /** What a generic word alone draws here; a missing word keeps the household meaning. */
  generic: Readonly<Partial<Record<GenericWord, ArtId>>>;
}

export const PROFILES: Readonly<Record<ProfileId, Profile>> = {
  home: { place: 'home', homeLabel: S.home, homeIcon: PLACE_ICON.home, defaultArt: 'casa', generic: {} },
  clinic: { place: 'business', homeLabel: S.start, homeIcon: PLACE_ICON.business, defaultArt: 'predio', generic: { sala: 'consultorio' } },
  restaurant: { place: 'business', homeLabel: S.start, homeIcon: PLACE_ICON.business, defaultArt: 'predio', generic: {} },
  office: { place: 'business', homeLabel: S.start, homeIcon: PLACE_ICON.business, defaultArt: 'predio', generic: { sala: 'escritorio' } },
  store: { place: 'business', homeLabel: S.start, homeIcon: PLACE_ICON.business, defaultArt: 'predio', generic: {} },
  gym: { place: 'business', homeLabel: S.start, homeIcon: PLACE_ICON.business, defaultArt: 'predio', generic: {} },
  salon: { place: 'business', homeLabel: S.start, homeIcon: PLACE_ICON.business, defaultArt: 'predio', generic: { salao: 'salao-beleza' } },
  hotel: { place: 'business', homeLabel: S.start, homeIcon: PLACE_ICON.business, defaultArt: 'predio', generic: { quarto: 'quarto-hotel' } },
};

export function isProfileId(value: unknown): value is ProfileId {
  return typeof value === 'string' && (PROFILE_IDS as readonly string[]).includes(value);
}
