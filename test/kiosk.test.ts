import { describe, expect, it } from 'vitest';
import readme from '../README.md?raw';
import { generateDashboard } from '../src/strategy/generate';
import { admin } from './helpers/fake-dashboard';
import { area, makeHass } from './helpers/fake-hass';

const house = () =>
  makeHass({
    areas: [area('sala', 'Sala')],
    entities: [{ entity_id: 'light.teto', area_id: 'sala', name: 'Teto', state: 'off' }],
  });

describe('the header and sidebar of Home Assistant', () => {
  it('asks kiosk-mode to hide them for whoever is not an administrator, and nothing for an administrator', () => {
    for (const h of [house(), admin(house())]) {
      expect(generateDashboard({}, h).kiosk_mode).toEqual({ non_admin_settings: { hide_header: true, hide_sidebar: true } });
    }
  });

  it('keeps them hidden for a resident when the panel fails', () => {
    const broken = makeHass();
    Object.defineProperty(broken, 'entities', {
      get: () => {
        throw new Error('registry not loaded');
      },
    });
    expect(generateDashboard({}, broken).kiosk_mode).toEqual({ non_admin_settings: { hide_header: true, hide_sidebar: true } });
  });

  it('tells the installer to get kiosk-mode', () => {
    expect(readme).toContain('https://github.com/NemesisRE/kiosk-mode');
  });
});
