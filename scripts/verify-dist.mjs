import { access, readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

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


const references = [
  manifest.action.default_popup,
  manifest.background.service_worker,
  ...Object.values(manifest.icons),
  ...Object.values(manifest.action.default_icon),
  ...manifest.content_scripts.flatMap((script) => script.js),
]
for (const file of references) await access(join(root, file))
if (!manifest.content_scripts.some((script) => script.matches.includes('https://*.myworkdayjobs.com/*'))) {
  throw new Error('Workday content-script match is missing')
}
if (!manifest.permissions.includes('storage') || !manifest.permissions.includes('scripting')) {
  throw new Error('Required extension permissions are missing')
}
const popup = await readFile(join(root, manifest.action.default_popup), 'utf8')
const assets = [...popup.matchAll(/(?:src|href)="([^"#]+\.(?:js|css))"/g)].map((match) => match[1].startsWith('/') ? match[1].slice(1) : join(dirname(manifest.action.default_popup), match[1]))
if (!assets.some((asset) => asset.endsWith('.js'))) throw new Error('Popup has no bundled script')
for (const asset of assets) await access(join(root, asset))
const popupCode = (await Promise.all(assets.filter((asset) => asset.endsWith('.js')).map((asset) => readFile(join(root, asset), 'utf8')))).join('\n')
for (const label of ['Export backup', 'Import backup', 'Replace profile and settings']) {
  if (!popupCode.includes(label)) throw new Error(`Backup UI missing from popup bundle: ${label}`)
}
console.log('Manifest references, Workday matches, popup assets, and backup UI verified.')

console.log('dist/ is ready to load unpacked.')
