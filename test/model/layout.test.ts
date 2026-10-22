import { describe, expect, it } from 'vitest';
import { layoutFor, type Layout } from '../../src/model/layout';

describe('the layout follows the area the panel has', () => {
  // Measured on his iPad Mini 5 and Android phone on 20/10: a phone on its side is wide but short.
  it.each([
    [390, 844, 'phone', 'phone'],
    [509, 1060, 'phone', 'phone'],
    [768, 1024, 'phone', 'roomy'],
    [1084, 461, 'phone', 'roomy'],
    [1024, 768, 'phone', 'wide'],
    [1280, 800, 'roomy', 'wide'],
    [890, 800, 'wide', 'wide'],
    [880, 800, 'wide', 'roomy'],
    [590, 800, 'roomy', 'roomy'],
    [580, 800, 'roomy', 'phone'],
  ])('%i x %i after %s is %s', (w, h, prev, want) => {
    expect(layoutFor(w, h, prev as Layout)).toBe(want);
  });
});
