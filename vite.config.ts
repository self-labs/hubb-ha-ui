/// <reference types="vitest/config" />
import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

export default defineConfig({
  define: { __HUBB_VERSION__: JSON.stringify(pkg.version) },
  build: {
    lib: {
      entry: 'src/hubb-ha-ui.ts',
      formats: ['es'],
      fileName: () => 'hubb-ha-ui.js',
    },
    // Everything below 1 MB is inlined: the font must travel inside the single file HACS serves.
    assetsInlineLimit: 1024 * 1024,
    target: 'es2022',
    sourcemap: false,
    emptyOutDir: true,
  },
  test: {
    environment: 'happy-dom',
    include: ['test/**/*.test.ts'],
  },
});
