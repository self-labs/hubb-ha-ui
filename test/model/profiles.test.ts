import { describe, expect, it } from 'vitest';
import { isProfileId, PROFILE_IDS, PROFILES } from '../../src/model/profiles';

describe('place profiles', () => {
  it('has the eight kinds of place, with Casa only for a home', () => {
    expect(PROFILE_IDS).toEqual(['home', 'clinic', 'restaurant', 'office', 'store', 'gym', 'salon', 'hotel']);
    expect(PROFILES.home.homeLabel).toBe('Casa');
    expect(PROFILES.home.defaultArt).toBe('casa');
    for (const id of PROFILE_IDS.filter((p) => p !== 'home')) {
      expect(PROFILES[id].homeLabel, id).toBe('Início');
      expect(PROFILES[id].defaultArt, id).toBe('predio');
    }
  });

  it('gives the generic words the meaning of each place', () => {
    expect(PROFILES.clinic.generic).toEqual({ sala: 'consultorio' });
    expect(PROFILES.office.generic).toEqual({ sala: 'escritorio' });
    expect(PROFILES.salon.generic).toEqual({ salao: 'salao-beleza' });
    expect(PROFILES.hotel.generic).toEqual({ quarto: 'quarto-hotel' });
    expect(PROFILES.home.generic).toEqual({});
  });

  it('knows its own ids', () => {
    expect(isProfileId('hotel')).toBe(true);
    expect(isProfileId('hotal')).toBe(false);
    expect(isProfileId(undefined)).toBe(false);
  });
});
