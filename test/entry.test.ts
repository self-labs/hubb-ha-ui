import { describe, expect, it } from 'vitest';
import '../src/hubb-ha-ui';

describe('hubb-ha-ui entry', () => {
  it('registers the strategy, the screens and the cards', () => {
    for (const name of [
      'll-strategy-dashboard-hubb',
      'hubb-home-screen',
      'hubb-room-screen',
      'hubb-scenes-screen',
      'hubb-light-card',
      'hubb-error-card',
    ]) {
      expect(customElements.get(name), name).toBeDefined();
    }
  });

  it('announces the strategy and the light card to the dashboard dialogs, once', async () => {
    await import('../src/hubb-ha-ui');
    expect(window.customStrategies!.filter((s) => s.type === 'hubb')).toHaveLength(1);
    expect(window.customCards!.filter((c) => c.type === 'hubb-light-card')).toHaveLength(1);
  });

  it('injects the font', () => {
    expect(document.getElementById('hubb-ha-ui-font')).not.toBeNull();
  });
});
