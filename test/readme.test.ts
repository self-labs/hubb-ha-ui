import { describe, expect, it } from 'vitest';
import readme from '../README.md?raw';

describe('README', () => {
  // HACS renders the README itself and rewrites only markdown links, never <img src>: a relative
  // image works on GitHub and shows broken inside HACS.
  it('points every HTML image at an absolute URL', () => {
    const srcs = [...readme.matchAll(/<img[^>]*\ssrc="([^"]+)"/g)].map((m) => m[1]);
    expect(srcs.length).toBeGreaterThan(0);
    expect(srcs.filter((s) => !s!.startsWith('https://'))).toEqual([]);
  });

  it('links the list of room drawings', () => {
    expect(readme).toContain('docs/drawings.md');
  });
});
