// Execute the actual popup bundle in a DOM with local Chrome API doubles.
// This checks boot/settings rendering; live Chrome QA still covers downloads/file picking.
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { JSDOM } from 'jsdom'
const root = join(import.meta.dirname, '..', 'dist')
const manifest = JSON.parse(await readFile(join(root, 'manifest.json'), 'utf8'))
const html = await readFile(join(root, manifest.action.default_popup), 'utf8')
const dom = new JSDOM(html, { url: 'https://popup.test/', runScripts: 'outside-only', pretendToBeVisual: true })
try {
  const { window } = dom
  const errors = []
  window.addEventListener('error', (event) => errors.push(event.message))
  window.chrome = {
    storage: { local: { get: async () => ({}), set: async () => {} }, onChanged: { addListener() {}, removeListener() {} } },
    tabs: { query: async () => [] },
  }
  const script = window.document.querySelector('script[type="module"]')?.getAttribute('src')
  if (!script) throw new Error('Missing popup script')
  window.eval(await readFile(join(root, dirname(manifest.action.default_popup), script), 'utf8'))
  await new Promise((resolve) => setTimeout(resolve, 100))
  const settings = [...window.document.querySelectorAll('nav button')].find((button) => button.textContent === 'Settings')
  if (!settings) throw new Error('Popup failed to boot')
  settings.click()
  await new Promise((resolve) => setTimeout(resolve, 50))
  for (const text of ['Export backup', 'Import backup']) {
    if (![...window.document.querySelectorAll('button')].some((button) => button.textContent === text)) throw new Error(`Missing ${text} action`)
  }
  if (errors.length) throw new Error(errors.join('\n'))
  console.log('Built popup boots and renders Settings backup actions (DOM smoke check).')
} finally { dom.window.close() }
