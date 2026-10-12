import { describe, expect, it } from 'vitest';
import { ART_IDS, DRAWINGS, isArtId } from '../../src/art/drawings';

/** One self-closing shape with quoted attributes; a drawing is a run of these and nothing else. */
const SHAPE = /<(path|rect|circle|ellipse)(\s+[a-z-]+="[^"]*")+\s*\/>/g;

describe('room drawings', () => {
  it('has the 59 approved drawings, one per id', () => {
    expect(ART_IDS).toHaveLength(59);
    expect(new Set(ART_IDS).size).toBe(59);
    expect(Object.keys(DRAWINGS).sort()).toEqual([...ART_IDS].sort());
  });

  it('is made only of plain shapes, which is what makes it safe to inject as markup', () => {
    for (const id of ART_IDS) {
      expect(DRAWINGS[id].replace(SHAPE, ''), id).toBe('');
      expect(DRAWINGS[id], id).not.toMatch(/\son[a-z]+=|href|url\(/i);
    }
  });

  it('takes its colours from the theme: currentColor for the line, --glow for the lamp', () => {
    for (const id of ART_IDS) {
      expect(DRAWINGS[id], id).toContain('fill:var(--glow,none)');
      expect(DRAWINGS[id], id).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|\b(stroke|fill)="(?!none)/i);
    }
  });

  it('knows its own ids', () => {
    expect(isArtId('cozinha')).toBe(true);
    expect(isArtId('camara-fria')).toBe(true);
    expect(isArtId('cozinah')).toBe(false);
    expect(isArtId(undefined)).toBe(false);
  });
});
