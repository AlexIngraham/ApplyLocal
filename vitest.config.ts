import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

const root = import.meta.dirname

export default defineConfig({
  root,
  resolve: {
    alias: { '@': resolve(root, 'src') },
  },
  // Vite's dev server refuses every file when the absolute path contains a colon.
  // This repo lives under "Class:General Archive", so strict FS checks would block tests.
  server: {
    fs: {
      strict: false,
    },
  },
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.ts'],
  },
})
