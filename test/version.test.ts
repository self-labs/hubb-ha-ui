import { describe, expect, it } from 'vitest';
import pkg from '../package.json?raw';
import { VERSION } from '../src/version';

describe('VERSION', () => {
  it('is the CalVer version from package.json', () => {
    expect(VERSION).toBe((JSON.parse(pkg) as { version: string }).version);
    expect(VERSION).toMatch(/^\d{4}\.[1-9]\d?\.\d+$/);
  });
});
