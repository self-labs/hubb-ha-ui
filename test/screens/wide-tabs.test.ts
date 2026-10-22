import { afterEach, describe, expect, it } from 'vitest';
import { reportArea, resetLayoutForTests } from '../../src/layout';
import { sizeOf } from '../../src/model/sizes';
import '../../src/screens/scenes-screen';
import type { HubbScreen } from '../../src/screens/base';
import { HubbReviewScreen } from '../../src/screens/review-screen';
import { HubbScenesScreen } from '../../src/screens/scenes-screen';
import { HubbSecurityScreen } from '../../src/screens/security-screen';
import { layoutStyles } from '../../src/theme/layout';
import { makeHass } from '../helpers/fake-hass';

const cssOf = (styles: unknown): string =>
  ([] as unknown[]).concat(styles).map((s) => (s as { cssText: string }).cssText).join('\n');

type Screen = HubbScreen & { setConfig(c: unknown): void };

const SCENE = { entityId: 'scene.jantar', name: 'Jantar', areaId: null, description: null };

async function scenes(options: Record<string, unknown> = {}): Promise<Screen> {
  const el = document.createElement('hubb-scenes-screen') as Screen;
  el.setConfig({ type: 'custom:hubb-scenes-screen', scenes: [SCENE], lightIds: [], options });
  el.hass = makeHass({ areas: [], entities: [] });
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}

describe('Cenas, Segurança and Revisar on a tablet', () => {
  afterEach(() => {
    resetLayoutForTests();
    document.body.replaceChildren();
  });

  it('leave the rail its 84 px and take the wide column', () => {
    expect(cssOf(layoutStyles)).toMatch(/:host\(\[screen-layout='wide'\]:not\(\[embedded\]\)\)\s*\{[^}]*padding-left: 84px/);
    for (const screen of [HubbScenesScreen, HubbSecurityScreen, HubbReviewScreen]) expect(cssOf(screen.styles)).toContain(cssOf(layoutStyles));
  });

  it('Segurança shows three open doors and three cameras a row when wide', () => {
    expect(cssOf(HubbSecurityScreen.styles)).toMatch(
      /:host\(\[screen-layout='wide'\]\) \.openings,\s*:host\(\[screen-layout='wide'\]\) \.cameras\s*\{[^}]*grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/,
    );
  });

  it('a scene with no size chosen is small on a tablet (four a row) and half a row on a phone (Gustavo, 21/10)', () => {
    expect(sizeOf(undefined, 'scene.jantar', 'scene')).toBe('medium');
    expect(sizeOf(undefined, 'scene.jantar', 'scene', 'roomy')).toBe('small');
    expect(sizeOf(undefined, 'scene.jantar', 'scene', 'wide')).toBe('small');
    expect(sizeOf({ entities: { 'scene.jantar': { size: 'medium' } } }, 'scene.jantar', 'scene', 'wide')).toBe('medium');
  });

  it('Cenas on a tablet draws a scene with no size as a tile; one the installer sized keeps its size', async () => {
    reportArea({ left: 0, top: 0, width: 768, height: 1024 }, 1024);
    let button = (await scenes()).shadowRoot!.querySelector('hubb-scene-button')!;
    expect(button.classList.contains('size-small')).toBe(true);
    expect(button.getAttribute('variant')).toBe('tile');
    document.body.replaceChildren();
    button = (await scenes({ entities: { 'scene.jantar': { size: 'medium' } } })).shadowRoot!.querySelector('hubb-scene-button')!;
    expect(button.classList.contains('size-medium')).toBe(true);
  });
});
