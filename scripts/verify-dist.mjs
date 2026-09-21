import { access, readFile } from 'node:fs/promises'
import { join } from 'node:path'

const root = join(import.meta.dirname, '..', 'dist')
const required = [
  'manifest.json',
  'content.js',
  'background.js',
  'src/ui/popup/index.html',
  'icons/icon16.png',
  'icons/icon128.png',
]

for (const file of required) {
  await access(join(root, file))
}

const manifest = JSON.parse(await readFile(join(root, 'manifest.json'), 'utf8'))
if (manifest.manifest_version !== 3) {
  throw new Error('manifest_version must be 3')
}

const content = await readFile(join(root, 'content.js'), 'utf8')
if (!content.startsWith('var ') && !content.startsWith('(function') && !content.startsWith('(()=>') && !content.includes('__APPLYLOCAL_BOOTED__')) {
  throw new Error('content.js does not look like a bundled content script')
}
if (/^\s*import\s/m.test(content)) {
  throw new Error('content.js still has bare imports, so injection would fail')
}

console.log('dist/ is ready to load unpacked.')
