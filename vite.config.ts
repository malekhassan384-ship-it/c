import { defineConfig } from 'vite';

// Renderer build — loaded by Electron via file:// (production) so base must be relative.
export default defineConfig({
  root: 'src/renderer',
  base: './',
  build: {
    outDir: '../../build/renderer',
    emptyOutDir: true,
    target: 'chrome130',
    sourcemap: false,
    assetsInlineLimit: 0
  }
});
