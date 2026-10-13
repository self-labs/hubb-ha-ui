import type { ArtId } from '../art/drawings';
import { S } from '../strings';

/** The kinds of place the panel knows; `home` when the configuration says nothing. */
export const PROFILE_IDS = ['home', 'clinic', 'restaurant', 'office', 'store', 'gym', 'salon', 'hotel'] as const;
export type ProfileId = (typeof PROFILE_IDS)[number];

/** Words that only say "a room"; each kind of place decides what they draw. */
export type GenericWord = 'sala' | 'quarto' | 'salao';

export interface Profile {
  /** Name of the first tab and of the home view. */
  homeLabel: string;
  /** Drawing for an area whose name and icon say nothing. */
  defaultArt: ArtId;
  /** What a generic word alone draws here; a missing word keeps the household meaning. */
  generic: Readonly<Partial<Record<GenericWord, ArtId>>>;
}

export const PROFILES: Readonly<Record<ProfileId, Profile>> = {
  home: { homeLabel: S.home, defaultArt: 'casa', generic: {} },
  clinic: { homeLabel: S.start, defaultArt: 'predio', generic: { sala: 'consultorio' } },
  restaurant: { homeLabel: S.start, defaultArt: 'predio', generic: {} },
  office: { homeLabel: S.start, defaultArt: 'predio', generic: { sala: 'escritorio' } },
  store: { homeLabel: S.start, defaultArt: 'predio', generic: {} },
  gym: { homeLabel: S.start, defaultArt: 'predio', generic: {} },
  salon: { homeLabel: S.start, defaultArt: 'predio', generic: { salao: 'salao-beleza' } },
  hotel: { homeLabel: S.start, defaultArt: 'predio', generic: { quarto: 'quarto-hotel' } },
};

export function isProfileId(value: unknown): value is ProfileId {
  return typeof value === 'string' && (PROFILE_IDS as readonly string[]).includes(value);
}
