import { copyFileSync } from 'node:fs';
import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: ['src/index.ts', 'src/react.tsx', 'src/polyfill.ts'],
    format: ['esm'],
    dts: true,
    sourcemap: true,
    clean: true,
    onSuccess: async () => {
      copyFileSync('src/styles.css', 'dist/styles.css');
    },
  },
  {
    entry: ['src/polyfill.ts'],
    format: ['iife'],
    globalName: 'BetterMiddleTruncate',
    minify: true,
    sourcemap: false,
    outDir: 'dist',
    outExtension: () => ({ js: '.global.js' }),
  },
]);
