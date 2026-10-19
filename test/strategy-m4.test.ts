import { describe, expect, it } from 'vitest';
import '../src/elements/nav-bar';
import type { HubbNavBar } from '../src/elements/nav-bar';
import { generateDashboard } from '../src/strategy/generate';
import { area, makeHass } from './helpers/fake-hass';

function h(admin = false) {
  const hass = makeHass({
    areas: [area('sala', 'Sala')],
    entities: [
      { entity_id: 'light.sala', area_id: 'sala', state: 'off' },
      { entity_id: 'alarm_control_panel.alarme', name: 'Alarme', state: 'disarmed' },
    ],
  });
  if (admin) hass.user = { id: 'u', name: 'G', is_admin: true };
  return hass;
}

describe('the security view', () => {
  it('sits right after the scenes, before the review and the rooms', () => {
    expect(generateDashboard({}, h()).views.map((v) => v.path)).toEqual(['home', 'scenes', 'seguranca', 'sala']);
    expect(generateDashboard({}, h(true)).views.map((v) => v.path)).toEqual(['home', 'scenes', 'seguranca', 'revisar', 'sala']);
  });

  it('hands every screen the same shared slice', () => {
    const views = generateDashboard({}, h()).views;
    // A view with nothing for the resident (Cenas, with no scene) only sends them home: no slice.
    const shared = views.map((v) => (v.cards[0] as { shared?: unknown }).shared).filter((s) => s !== undefined);
    expect(shared.every((s) => s === shared[0])).toBe(true);
    expect(shared[0]).toEqual({
      alerts: [{ entityId: 'alarm_control_panel.alarme', kind: 'alarm', roomName: null, path: null }],
      security: true,
      scenes: false,
      media: [],
    });
    expect(views[2]!.cards[0]).toMatchObject({ type: 'custom:hubb-security-screen' });
  });

  it('shows the security tab only when the house has something for it', async () => {
    const nav = document.createElement('hubb-nav-bar') as HubbNavBar;
    document.body.appendChild(nav);
    await nav.updateComplete;
    expect(nav.shadowRoot!.querySelectorAll('nav button')).toHaveLength(2);
    nav.security = true;
    await nav.updateComplete;
    const labels = [...nav.shadowRoot!.querySelectorAll('nav button')].map((b) => b.textContent!.trim());
    expect(labels).toEqual(['Casa', 'Cenas', 'Segurança']);
    document.body.replaceChildren();
  });
});
