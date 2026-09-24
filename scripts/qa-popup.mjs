// Run against an isolated Chrome started with --remote-debugging-port=9333.
// Exercises the actual production popup with deterministic, local Chrome API fixtures.
import { createServer } from 'node:http'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { resolve, extname } from 'node:path'
import assert from 'node:assert/strict'

const dist = resolve(import.meta.dirname, '../dist')
const artifacts = '/tmp/applylocal-ui-qa'
await mkdir(artifacts, { recursive: true })
const server = createServer(async (req, res) => {
  try {
    const path = resolve(dist, `.${decodeURIComponent(new URL(req.url, 'http://localhost').pathname)}`)
    if (!path.startsWith(`${dist}/`)) throw new Error('Invalid path')
    res.setHeader('Content-Type', { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' }[extname(path)] || 'application/octet-stream')
    res.end(await readFile(path))
  } catch { res.writeHead(404); res.end() }
})
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
const { port } = server.address()
const target = await (await fetch('http://127.0.0.1:9333/json/new?about:blank', { method: 'PUT' })).json()
const ws = new WebSocket(target.webSocketDebuggerUrl)
await new Promise(resolve => ws.addEventListener('open', resolve, { once: true }))
let id = 0
const pending = new Map()
const errors = []
ws.addEventListener('message', event => {
  const message = JSON.parse(event.data)
  if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text)
  if (message.id) { const promise = pending.get(message.id); pending.delete(message.id); message.error ? promise.reject(message.error) : promise.resolve(message.result) }
})
function send(method, params = {}) { return new Promise((resolve, reject) => { pending.set(++id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params })) }) }
async function evaluate(expression) {
  const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails))
  return result.result.value
}
const wait = ms => new Promise(resolve => setTimeout(resolve, ms))
async function screenshot(name) { const { data } = await send('Page.captureScreenshot'); await writeFile(`${artifacts}/${name}.png`, Buffer.from(data, 'base64')) }
async function click(text) { await evaluate(`[...document.querySelectorAll('button')].find(b => b.textContent.trim() === ${JSON.stringify(text)}).click()`); await wait(260) }
async function accordion(title) { await evaluate(`[...document.querySelectorAll('.accordion-trigger')].find(b => b.querySelector('strong').textContent === ${JSON.stringify(title)}).click()`); await wait(260) }
async function noOverflow() {
  const result = await evaluate(`(() => { const p = document.querySelector('.panel[data-active="true"]'); return { page: document.documentElement.scrollWidth <= innerWidth, vertical: document.documentElement.scrollHeight <= innerHeight, panel: p.scrollWidth <= p.clientWidth, clipped: [...p.querySelectorAll('input, select, textarea, button')].filter(e => !e.closest('[inert]') && e.getBoundingClientRect().right > p.getBoundingClientRect().right + 1).length } })()`)
  assert.deepEqual(result, { page: true, vertical: true, panel: true, clipped: 0 })
}
try {
  await send('Page.enable'); await send('Runtime.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 220, height: 160, deviceScaleFactor: 1, mobile: false })
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `
    window.__writes = []; window.__commands = []; window.__fail = false;
    const data = { profile: { personal: { firstName: 'Alex', lastName: 'Morgan', email: 'alex@example.com', phone: '555-0123' }, education: [{ id: 'edu-1', school: 'Northeastern University', degree: 'Bachelor of Science', major: 'Computer Science', minor: '', startDate: '2022-09', graduationDate: '2026-05', gpa: '3.8' }], employment: Array.from({length: 6}, (_, i) => ({ id: 'job-'+i, company: i ? 'Example Company '+i : 'Ipsos MMA', jobTitle: i ? 'Software Engineer' : 'Software Engineer Intern', startDate: '2026-05', endDate: '2026-08', current: false, location: 'New York, NY', description: 'Built internal tools.' })), skills: ['TypeScript', 'React', 'Python'] }, applications: [] };
    const snapshot = { ok: true, href: 'https://careers.example.com/apply', ats: 'workday', atsLabel: 'Workday', enabled: true, counts: { detected: 24, autofilled: 18, review: 4, skipped: 2, unrecognized: 0 }, fields: Array.from({length: 24}, (_, i) => ({ id: 'f'+i, canonical: 'firstName', label: i < 4 ? 'Preferred name' : 'First name', confidence: .95, status: i < 4 ? 'suggested' : 'autofilled', proposedPreview: 'Alex', fillBand: 'auto', sensitive: false, reason: 'Label matched' })) };
    window.chrome = { storage: { local: { get: async () => data, set: async v => { if (window.__fail) throw Error('Storage unavailable'); window.__writes.push(v); Object.assign(data, v) } }, session: { get: async () => ({ 'al-frame:1:0': { tabId: 1, frameId: 0 } }), remove: async () => {} }, onChanged: { addListener() {}, removeListener() {} } }, tabs: { query: async () => [{ id: 1, url: 'https://careers.example.com/apply' }], sendMessage: (id, message, options, callback) => { window.__commands.push(message.type); setTimeout(() => (callback || options)(snapshot), message.type === 'al:autofill' ? 700 : 20) } }, runtime: {}, scripting: { executeScript: async () => {} } };
  ` })
  await send('Page.navigate', { url: `http://127.0.0.1:${port}/src/ui/popup/index.html` }); await wait(450)
  // Chrome starts an action popup small, then sizes it from its document.
  // A viewport-dependent root can lock that initial size and collapse the panel.
  const openingSize = await evaluate(`({ width: document.documentElement.getBoundingClientRect().width, height: document.querySelector('.app').getBoundingClientRect().height, panel: document.querySelector('.panel[data-active="true"]').getBoundingClientRect().height })`)
  assert.equal(openingSize.width, 410, 'Popup must request its full width even in a small initial viewport')
  assert.ok(openingSize.height >= 450 && openingSize.height <= 600, 'Popup must grow to show its content')
  assert.ok(openingSize.panel >= 320, 'Active panel must not collapse during opening')
  await send('Emulation.setDeviceMetricsOverride', { width: 410, height: Math.ceil(openingSize.height), deviceScaleFactor: 1, mobile: false })
  assert.equal(await evaluate(`document.querySelector('[role="tab"][aria-selected="true"]').textContent`), 'Overview')
  await noOverflow(); await screenshot('overview-410')
  await evaluate(`[...document.querySelectorAll('button')].find(b => b.textContent === 'Autofill page').click()`)
  await wait(100)
  assert.equal(await evaluate(`[...document.querySelectorAll('button')].find(b => b.textContent === 'Filling…').disabled`), true)
  await screenshot('autofill-loading'); await wait(700)
  assert.equal(await evaluate(`document.body.textContent.includes('18 fields filled on this page.')`), true)
  await click('Profile'); await noOverflow(); await screenshot('profile-410')
  await accordion('Personal information')
  await accordion('Education'); await accordion('Northeastern University'); await noOverflow(); await screenshot('education-410')
  await accordion('Education'); await accordion('Work experience')
  await evaluate(`document.querySelector('#panel-profile').scrollTop = 190`)
  await screenshot('experience-410')
  const scroll = await evaluate(`document.querySelector('#panel-profile').scrollTop`)
  await click('Settings'); await screenshot('settings-410'); await noOverflow()
  await click('Profile')
  assert.equal(await evaluate(`document.querySelector('#panel-profile').scrollTop`), scroll)
  assert.equal(await evaluate(`[...document.querySelectorAll('.accordion-trigger')].find(b => b.querySelector('strong').textContent === 'Work experience').getAttribute('aria-expanded')`), 'true')
  // Explicit alternate shell sizes test responsive contents without reintroducing
  // viewport-dependent sizing into the native action popup.
  for (const width of [380, 430]) {
    await evaluate(`document.documentElement.style.width = '${width}px'`)
    await send('Emulation.setDeviceMetricsOverride', { width, height: 600, deviceScaleFactor: 1, mobile: false })
    for (const tab of ['Overview', 'Profile', 'Settings']) { await click(tab); await noOverflow() }
  }
  await evaluate(`document.documentElement.style.width = '380px'`)
  await send('Emulation.setDeviceMetricsOverride', { width: 380, height: 600, deviceScaleFactor: 1, mobile: false })
  await screenshot('settings-380')
  await evaluate(`document.querySelector('#panel-settings').scrollTop = 9999`); await screenshot('backup-380')
  assert.equal(await evaluate(`[...document.querySelectorAll('button')].some(b => b.textContent === 'Export backup' && !b.closest('[inert]'))`), true)
  // Real keyboard events verify roving tab focus and native button Space activation.
  await evaluate(`document.querySelector('#tab-settings').focus()`)
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowLeft', code: 'ArrowLeft', windowsVirtualKeyCode: 37 }); await wait(240)
  assert.equal(await evaluate(`document.activeElement.id`), 'tab-profile')
  await click('Settings')
  await evaluate(`document.querySelector('#panel-settings [role="switch"]').focus()`)
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: ' ', code: 'Space', windowsVirtualKeyCode: 32 })
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: ' ', code: 'Space', windowsVirtualKeyCode: 32 }); await wait(260)
  assert.equal(await evaluate(`document.querySelector('#panel-settings [role="switch"]').getAttribute('aria-checked')`), 'false')
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
  await click('Profile')
  assert.equal(await evaluate(`getComputedStyle(document.querySelector('.tab-indicator')).transitionDuration`), '0s')
  assert.equal(await evaluate(`getComputedStyle(document.querySelector('.collapse')).transitionDuration`), '0s')
  assert.equal(await evaluate(`getComputedStyle(document.querySelector('#panel-profile')).animationName`), 'none')
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] })
  await evaluate(`document.querySelector('#panel-profile').scrollTop = 0`)
  await accordion('Personal information')
  await evaluate(`window.__fail = true; const input = document.querySelector('#panel-profile input'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, 'Alexandra'); input.dispatchEvent(new Event('input', { bubbles: true }))`)
  await wait(400)
  assert.equal(await evaluate(`document.body.textContent.includes('Not saved')`), true)
  await noOverflow(); await screenshot('save-error-380')
  await evaluate(`window.__fail = false`); await click('Retry save'); await wait(350)
  assert.equal(await evaluate(`document.querySelector('.save-status').textContent`), 'Saved locally')
  await accordion('Personal information')
  await click('Add experience')
  const entries = await evaluate(`document.querySelectorAll('#panel-profile .entry-card').length`)
  await evaluate(`[...document.querySelectorAll('.entry-card')].at(-1).querySelector('.entry-remove').click()`)
  await wait(60)
  assert.equal(await evaluate(`document.querySelector('[data-removing="true"]').inert`), true)
  await wait(200)
  assert.equal(await evaluate(`document.querySelectorAll('#panel-profile .entry-card').length`), entries - 1)
  assert.equal(await evaluate(`document.activeElement.textContent`), 'Add experience')
  assert.deepEqual(errors, [])
  console.log(`Built Chrome QA passed: small-viewport opening, 380/410/430px, overflow, tab/accordion persistence, actions/loading, keyboard switch/navigation, reduced motion. Screenshots: ${artifacts}`)
} finally {
  await send('Page.close').catch(() => {})
  ws.close(); server.close()
}
