import { describe, expect, it } from 'vitest';
import { HubbDimmerPanel } from '../src/elements/dimmer-panel';
import { HubbLightTile } from '../src/elements/light-tile';
import { HubbRoomCard } from '../src/elements/room-card';
import { HubbToast } from '../src/elements/toast';
import { HubbHomeScreen } from '../src/screens/home-screen';
import { tokens } from '../src/theme/tokens';

/** WCAG 2 contrast ratio between two #rrggbb colours. */
function contrast(a: string, b: string): number {
  const lum = (hex: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * bl!;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

/** The value of a custom property in the dark (:host) or light (:host([theme='light'])) block. */
function token(name: string, theme: 'dark' | 'light'): string {
  const css = tokens.cssText;
  const lightAt = css.indexOf(":host([theme='light'])");
  const block = theme === 'dark' ? css.slice(0, lightAt) : css.slice(lightAt);
  const m = block.match(new RegExp(`${name}:\\s*(#[0-9a-f]{6})`));
  if (!m) throw new Error(`${name} missing in ${theme}`);
  return m[1]!;
}

const cssOf = (styles: unknown): string =>
  ([] as unknown[]).concat(styles).map((s) => (s as { cssText: string }).cssText).join('\n');

describe('labels centred in their 44 px buttons', () => {
  // happy-dom has no layout, so this checks the rule that does the centring.
  const centred = /display: inline-flex;[^}]*align-items: center;[^}]*justify-content: center/;

  it('the dimmer presets', () => {
    expect(cssOf(HubbDimmerPanel.styles)).toMatch(new RegExp(`\\.presets button\\s*\\{[^}]*${centred.source}`));
  });

  it('the Desfazer button', () => {
    expect(cssOf(HubbToast.styles)).toMatch(new RegExp(`button\\s*\\{[^}]*${centred.source}`));
  });
});

describe('contrast of text on its background, both themes (AA, 4.5:1)', () => {
  for (const theme of ['dark', 'light'] as const) {
    it(`lit text on a lit tile, ${theme}`, () => {
      expect(contrast(token('--hubb-amber-text', theme), token('--hubb-on-bg', theme))).toBeGreaterThanOrEqual(4.5);
    });

    it(`Desfazer on the toast, ${theme}`, () => {
      expect(contrast(token('--hubb-toast-action', theme), token('--hubb-primary-bg', theme))).toBeGreaterThanOrEqual(4.5);
    });

    for (const bg of ['--hubb-bg', '--hubb-surface', '--hubb-surface-2', '--hubb-sheet', '--hubb-on-bg']) {
      it(`secondary text on ${bg}, ${theme}`, () => {
        expect(contrast(token('--hubb-text-2', theme), token(bg, theme))).toBeGreaterThanOrEqual(4.5);
      });

      // A focus ring is not text: WCAG asks 3:1 against what is around it.
      it(`the focus ring on ${bg}, ${theme}`, () => {
        expect(contrast(token('--hubb-focus', theme), token(bg, theme))).toBeGreaterThanOrEqual(3);
      });
    }

    it(`the focus ring of Desfazer on the toast, ${theme}`, () => {
      expect(contrast(token('--hubb-primary-ink', theme), token('--hubb-primary-bg', theme))).toBeGreaterThanOrEqual(3);
    });

    it(`the icon of a lit tile on the amber, ${theme}`, () => {
      expect(contrast(token('--hubb-amber-ink', theme), token('--hubb-amber', theme))).toBeGreaterThanOrEqual(4.5);
    });
  }

  it('lit labels and the toast action use the text tokens, not the fill amber', () => {
    expect(cssOf(HubbLightTile.styles)).toMatch(/\.tile\.on \.state\s*\{\s*color: var\(--hubb-amber-text\)/);
    expect(cssOf(HubbRoomCard.styles)).toMatch(/\.room\.on \.status\s*\{\s*color: var\(--hubb-amber-text\)/);
    expect(cssOf(HubbHomeScreen.styles)).toMatch(/\.chip\.on\s*\{[^}]*color: var\(--hubb-amber-text\)/);
    expect(cssOf(HubbToast.styles)).toMatch(/button\s*\{[^}]*color: var\(--hubb-toast-action\)/);
  });
});
