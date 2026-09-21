import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const viteBin = join(dirname(fileURLToPath(import.meta.url)), '..', 'node_modules', 'vite', 'bin', 'vite.js')
const commands = [
  ['vite.popup.config.ts', ['--watch', '--emptyOutDir', 'false']],
  ['vite.content.config.ts', ['--watch']],
  ['vite.background.config.ts', ['--watch']],
]

const children = commands.map(([config, extra]) => {
  const child = spawn(process.execPath, [viteBin, 'build', '--config', config, ...extra], { stdio: 'inherit' })
  child.on('exit', (code) => {
    if (code) process.exit(code)
  })
  return child
})

process.on('SIGINT', () => {
  for (const child of children) child.kill('SIGINT')
  process.exit(0)
})
