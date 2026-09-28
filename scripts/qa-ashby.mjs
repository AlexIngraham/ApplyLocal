// Local React fixture + the production content script in a real isolated world.
// Start disposable Chrome with --remote-debugging-port=9333, then run after build.
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { build } from 'esbuild'

const root = resolve(import.meta.dirname, '..')
const bundle = await build({
  stdin: {
    contents: `import React from 'react'; import { createRoot } from 'react-dom/client'; import { AshbyControlledFixture } from './tests/fixtures/ashby-controlled'; createRoot(document.getElementById('fixture')).render(React.createElement(AshbyControlledFixture));`,
    resolveDir: root,
    loader: 'tsx',
  },
  bundle: true, write: false, format: 'iife', jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"production"' },
})
const content = await readFile(resolve(root, 'dist/content.js'), 'utf8')
let ws
let target
let id = 0
const pending = new Map()
const errors = []
function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const next = ++id
    const timer = setTimeout(() => { pending.delete(next); reject(new Error(`Timed out: ${method}`)) }, 15000)
    pending.set(next, { resolve, reject, timer })
    ws.send(JSON.stringify({ id: next, method, params }))
  })
}
async function evaluate(expression, contextId) {
  const result = await send('Runtime.evaluate', { expression, contextId, returnByValue: true, awaitPromise: true })
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails))
  return result.result.value
}
async function waitFor(expression, contextId) {
  const deadline = Date.now() + 5000
  do {
    if (await evaluate(expression, contextId)) return
    await new Promise(resolve => setTimeout(resolve, 25))
  } while (Date.now() < deadline)
  assert.fail(`Condition did not settle: ${expression}`)
}
try {
  target = await (await fetch('http://127.0.0.1:9333/json/new?about:blank', { method: 'PUT' })).json()
  ws = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => { ws.addEventListener('open', resolve, { once: true }); ws.addEventListener('error', reject, { once: true }) })
  ws.addEventListener('message', event => {
    const message = JSON.parse(event.data)
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text)
    const promise = pending.get(message.id)
    if (!promise) return
    clearTimeout(promise.timer); pending.delete(message.id)
    if (message.error) promise.reject(new Error(JSON.stringify(message.error)))
    else promise.resolve(message.result)
  })
  await send('Page.enable'); await send('Runtime.enable'); await send('Page.bringToFront')
  const { frameTree } = await send('Page.getFrameTree')
  const frameId = frameTree.frame.id
  await send('Page.setDocumentContent', { frameId, html: '<!doctype html><html><body><div id="fixture"></div></body></html>' })
  await evaluate(bundle.outputFiles[0].text)
  await waitFor(`!!document.getElementById('firstName')`)
  // Control case: raw assignment is visible but does not update React's state.
  await evaluate(`document.getElementById('firstName').value = 'Uncommitted'`)
  assert.equal(await evaluate(`document.getElementById('firstName').value`), 'Uncommitted')
  assert.equal(await evaluate(`document.querySelector('[data-draft="firstName"]').textContent`), '')
  await evaluate(`document.querySelector('form button').click()`)
  await waitFor(`document.getElementById('firstName').value === ''`)

  const { executionContextId } = await send('Page.createIsolatedWorld', { frameId, worldName: 'applylocal-ashby-qa' })
  await evaluate(`
    const data = { profile: { personal: { firstName: 'Alex', lastName: 'Morgan', email: 'alex@example.test', phone: '555-0123' }, skills: ['TypeScript', 'React'] }, settings: { autoFillHighConfidence: false } };
    window.chrome = {
      storage: { local: { get: async () => data, set: async values => Object.assign(data, values) }, onChanged: { addListener() {}, removeListener() {} } },
      runtime: { onMessage: { addListener(fn) { window.__qaMessage = fn }, removeListener() {} }, sendMessage(message, reply) { reply?.() }, lastError: undefined }
    };
    window.__qaCommand = type => new Promise(resolve => window.__qaMessage({ type }, {}, resolve));
  `, executionContextId)
  await evaluate(content, executionContextId)
  await waitFor(`!!window.__qaMessage`, executionContextId)
  const snapshot = await evaluate(`window.__qaCommand('al:autofill')`, executionContextId)
  assert.equal(snapshot.ats, 'ashby')
  assert.equal(snapshot.counts.autofilled, 4)
  // Skills is a review-band text match. Accept it via the real indicator action.
  await evaluate(`document.getElementById('applylocal-root').shadowRoot.querySelector('[aria-label^="Skills,"]').click()`, executionContextId)
  await evaluate(`[...document.getElementById('applylocal-root').shadowRoot.querySelectorAll('.card button')].find(button => button.textContent === 'Fill').click()`, executionContextId)
  const expected = { firstName: 'Alex', lastName: 'Morgan', email: 'alex@example.test', phone: '555-0123', skills: 'TypeScript, React' }
  await waitFor(`JSON.parse(document.querySelector('[data-saved]').textContent).skills === 'TypeScript, React'`)
  assert.deepEqual(await evaluate(`JSON.parse(document.querySelector('[data-saved]').textContent)`), expected)
  await evaluate(`document.querySelector('form button').click()`)
  for (const [name, value] of Object.entries(expected)) assert.equal(await evaluate(`document.getElementById(${JSON.stringify(name)}).value`), value)

  // Browser-generated input verifies real user edits are not classified as fill events.
  await evaluate(`document.getElementById('firstName').focus(); document.getElementById('firstName').select()`)
  await send('Input.insertText', { text: 'Manual correction' })
  await evaluate(`document.getElementById('firstName').blur()`)
  await evaluate(`window.__qaCommand('al:scan')`, executionContextId)
  const rescanned = await evaluate(`window.__qaCommand('al:autofill')`, executionContextId)
  assert.equal(await evaluate(`document.getElementById('firstName').value`), 'Manual correction')
  assert.equal(await evaluate(`JSON.parse(document.querySelector('[data-saved]').textContent).firstName`), 'Manual correction')
  assert.equal(rescanned.fields.find(field => field.canonical === 'firstName').status, 'manual')
  assert.deepEqual(errors, [])
  console.log('Ashby Chrome QA passed: production isolated-world fill, React draft/committed state, input/textarea, rerender persistence, real user edit + rescan protection. Local fixtures only; no live application submitted.')
} finally {
  if (target) await fetch(`http://127.0.0.1:9333/json/close/${target.id}`).catch(() => {})
  ws?.close()
  for (const { timer } of pending.values()) clearTimeout(timer)
}
