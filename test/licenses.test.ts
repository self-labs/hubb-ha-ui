import { describe, expect, it } from 'vitest';
import readme from '../README.md?raw';
import ofl from '../LICENSES/OFL-1.1-Manrope.txt?raw';

describe('third-party licences', () => {
  it('ships the SIL Open Font License of the embedded Manrope font', () => {
    expect(ofl).toContain('SIL OPEN FONT LICENSE Version 1.1');
    expect(ofl).toContain('Manrope');
  });

  it('points to it from the README', () => {
    expect(readme).toContain('LICENSES/OFL-1.1-Manrope.txt');
  });
});
