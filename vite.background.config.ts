import { resolve } from 'node:path'
import { defineConfig } from 'vite'

const root = import.meta.dirname

export default defineConfig({
  resolve: {
    alias: { '@': resolve(root, 'src') },
  },
  publicDir: false,
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    sourcemap: true,
    target: 'chrome111',
    rollupOptions: {
      input: {
        background: resolve(root, 'src/background/index.ts'),
      },
      output: {
        format: 'es',
        entryFileNames: '[name].js',
        inlineDynamicImports: true,
      },
    },
  },
})
