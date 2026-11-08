import { defineConfig } from 'vite'
import { resolve } from 'node:path'

export default defineConfig({
  root: resolve(__dirname, 'src/viewer'),
  base: './',
  esbuild: { jsx: 'automatic', jsxImportSource: 'preact' },
  resolve: {
    alias: { '@': resolve(__dirname, 'src') },
  },
  build: {
    outDir: resolve(__dirname, 'dist'),
    emptyOutDir: false,
    target: 'chrome120',
    modulePreload: { polyfill: false },
    rollupOptions: {
      input: { viewer: resolve(__dirname, 'src/viewer/viewer.html') },
      output: {
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name][extname]',
      },
    },
  },
})
