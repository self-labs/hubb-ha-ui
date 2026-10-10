import { describe, expect, it } from 'vitest';
import { VERSION } from '../src/version';

describe('VERSION', () => {
  it('is the CalVer version from package.json', () => {
    expect(VERSION).toBe('2026.10.1');
  });
});
