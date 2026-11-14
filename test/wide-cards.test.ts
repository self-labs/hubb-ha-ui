import { describe, expect, it } from 'vitest';
import { HubbMediaScreen } from '../src/screens/media-screen';
import { HubbSecurityScreen } from '../src/screens/security-screen';

const cssOf = (styles: unknown): string => ([] as unknown[]).concat(styles).map((s) => (s as { cssText: string }).cssText).join('\n');

// On a tablet or a computer the speaker cards and the Acesso cards stretched over the whole column, the name
// at one end and the buttons far at the other (Gustavo, 14/11). Roomy and wide put them side by side, about
// half a row each; the phone keeps one column.
const SIDE_BY_SIDE = (selector: string) =>
  new RegExp(
    `:host\\(\\[screen-layout='roomy'\\]\\) ${selector},\\s*:host\\(\\[screen-layout='wide'\\]\\) ${selector}\\s*\\{[^}]*grid-template-columns:\\s*repeat\\(auto-fill, minmax\\(340px, 1fr\\)\\)`,
  );
const PHONE_COLUMNS = (selector: string) => new RegExp(`(^|\\})\\s*${selector}\\s*\\{[^}]*grid-template-columns:\\s*repeat\\(auto-fill`);

describe('the Mídia tab on a tablet or a computer', () => {
  const css = cssOf(HubbMediaScreen.styles);

  it('puts the rooms side by side, each with its own cards', () => {
    expect(css).toMatch(SIDE_BY_SIDE('\\.rooms'));
  });

  it('keeps one column on a phone', () => {
    expect(css).not.toMatch(PHONE_COLUMNS('\\.rooms'));
    expect(css).toMatch(/\.list\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\)/);
  });
});

describe('the Segurança tab on a tablet or a computer', () => {
  const css = cssOf(HubbSecurityScreen.styles);

  it('puts the alarm and the Acesso cards side by side, about half a row each', () => {
    expect(css).toMatch(SIDE_BY_SIDE('\\.stack'));
  });

  it('keeps one column on a phone', () => {
    expect(css).not.toMatch(PHONE_COLUMNS('\\.stack'));
  });
});
