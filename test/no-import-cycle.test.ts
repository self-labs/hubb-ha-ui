import { describe, expect, it } from 'vitest';

// A cycle of real imports runs by luck: one constant read while the modules load comes back undefined,
// and only on some entry orders. A type-only import is erased by the compiler, so it does not count.

const sources = import.meta.glob('../src/**/*.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

/** "../src/model/classify.ts" -> "src/model/classify.ts" */
const fromRoot = (key: string): string => key.replace(/^\.\.\//, '');

/** The files of src/ a source really imports, side effects included. */
function imports(file: string, text: string): string[] {
  const found: string[] = [];
  for (const m of text.matchAll(/^(?:import|export)\s+(type\s+)?([^'"]*?)(?:from\s+)?['"](\.[^'"]+)['"]/gm)) {
    if (m[1]) continue;
    const named = m[2]!.match(/^\{([^}]*)\}/);
    if (named && named[1]!.split(',').map((s) => s.trim()).filter(Boolean).every((s) => s.startsWith('type '))) continue;
    const target = new URL(m[3]!, `http://x/${file}`).pathname.slice(1);
    found.push(target.endsWith('.ts') ? target : `${target}.ts`);
  }
  return found;
}

function cycles(graph: ReadonlyMap<string, string[]>): string[] {
  const out: string[] = [];
  const state = new Map<string, 'open' | 'done'>();
  const walk = (file: string, path: string[]): void => {
    state.set(file, 'open');
    for (const next of graph.get(file) ?? []) {
      if (!graph.has(next)) continue;
      if (state.get(next) === 'open') out.push([...path.slice(path.indexOf(next)), next].join(' -> '));
      else if (!state.has(next)) walk(next, [...path, next]);
    }
    state.set(file, 'done');
  };
  for (const file of graph.keys()) if (!state.has(file)) walk(file, [file]);
  return out;
}

describe('the imports of the panel', () => {
  const graph = new Map(Object.entries(sources).map(([key, text]) => [fromRoot(key), imports(fromRoot(key), text)]));

  it('reads the whole source and follows its imports', () => {
    expect(graph.size).toBeGreaterThan(50);
    expect(graph.get('src/model/build-house.ts')).toContain('src/model/classify.ts');
  });

  it('never skips a real import that also brings a type', () => {
    expect(imports('src/a.ts', "import { x, type Y } from './b';")).toEqual(['src/b.ts']);
    expect(imports('src/a.ts', "import type { Y } from './b';\nimport { type Z } from './c';")).toEqual([]);
  });

  it('has no cycle', () => {
    expect(cycles(graph)).toEqual([]);
  });
});
