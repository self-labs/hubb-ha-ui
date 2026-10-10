import { describe, expect, it } from 'vitest';
import { ensureFont } from '../src/theme/font';
import { tokens } from '../src/theme/tokens';

describe('theme', () => {
  it('declares both palettes and turns motion off for reduced motion', () => {
    const css = tokens.cssText;
    for (const hex of ['#10161a', '#1b242a', '#e3e0d9', '#8e9aa2', '#f2c98a', '#ebe8e2', '#f8f6f2', '#293a44', '#6e7a82', '#e0a54b']) {
      expect(css).toContain(hex);
    }
    expect(css).toContain(":host([theme='light'])");
    expect(css).toContain('prefers-reduced-motion');
  });

  it('adds the Manrope font face to the document once', () => {
    ensureFont(document);
    ensureFont(document);
    const styles = document.querySelectorAll('style#hubb-ha-ui-font');
    expect(styles).toHaveLength(1);
    expect(styles[0]!.textContent).toContain("font-family:'Manrope Variable'");
    expect(styles[0]!.textContent).toContain('src:url(');
  });
});
