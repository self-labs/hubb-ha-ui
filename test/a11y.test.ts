import { describe, expect, it } from 'vitest';
import { HubbColorPanel } from '../src/elements/color-panel';
import { HubbDimmerPanel } from '../src/elements/dimmer-panel';
import { HubbLightTile } from '../src/elements/light-tile';
import { HubbNavBar } from '../src/elements/nav-bar';
import { HubbRoomCard } from '../src/elements/room-card';
import { HubbSceneButton } from '../src/elements/scene-button';
import { HubbToast } from '../src/elements/toast';
import { HubbScreen } from '../src/screens/base';
import { HubbHomeScreen } from '../src/screens/home-screen';
import { HubbRoomScreen } from '../src/screens/room-screen';

const cssOf = (styles: unknown): string =>
  ([] as unknown[]).concat(styles).map((s) => (s as { cssText: string }).cssText).join('\n');

const ring = (selector: string, color = '--hubb-focus') =>
  new RegExp(`${selector}:focus-visible\\s*\\{[^}]*outline: 2px solid var\\(${color}\\)`);

// `all: unset` also removes the browser's focus ring, so every reset button draws its own, in the
// focus colour (3:1 or more on every surface; see contrast.test.ts).
describe('a visible focus ring on every button that resets its look', () => {
  it.each([
    ['the light and outlet tiles', HubbLightTile.styles, '\\.tile'],
    ['the room card', HubbRoomCard.styles, '\\.room'],
    ['the home chip', HubbHomeScreen.styles, '\\.chip'],
    ['the primary buttons', HubbScreen.baseStyles, '\\.primary'],
    ['the back arrow', HubbRoomScreen.styles, '\\.back'],
    ['the dimmer presets', HubbDimmerPanel.styles, '\\.presets button'],
    ['the brightness column', HubbDimmerPanel.styles, '\\.column'],
    ['the colour buttons', HubbColorPanel.styles, '\\.presets button'],
    ['the scene buttons', HubbSceneButton.styles, 'button'],
    ['the nav bar', HubbNavBar.styles, 'button'],
  ])('%s', (_name, styles, selector) => {
    expect(cssOf(styles)).toMatch(ring(selector));
  });

  it('Desfazer, drawn in the ink of the toast it sits on', () => {
    expect(cssOf(HubbToast.styles)).toMatch(ring('button', '--hubb-primary-ink'));
  });
});
