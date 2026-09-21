import { resolve } from 'node:path'
import { defineConfig } from 'vite'

const root = import.meta.dirname

/** Single IIFE so programmatic injection does not depend on extra chunks. */
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
    cssCodeSplit: false,
    rollupOptions: {
      input: {
        content: resolve(root, 'src/content/index.ts'),
      },
      output: {
        format: 'iife',
        entryFileNames: '[name].js',
        inlineDynamicImports: true,
      },
    },
  },
})
