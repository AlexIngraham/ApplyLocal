import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const root = import.meta.dirname

export default defineConfig({
  base: './',
  plugins: [react()],
  resolve: {
    alias: { '@': resolve(root, 'src') },
  },
  publicDir: 'public',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
    target: 'chrome111',
    rollupOptions: {
      input: {
        popup: resolve(root, 'src/ui/popup/index.html'),
      },
    },
  },
})
