import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ashbyAdapter, selectAdapter } from '@/adapters/registry'
import { detectAtsFromUrl } from '@/platform/detect'
import { scanDocument } from '@/content/scanner'
import { applyDetectedFields, fillOne } from '@/content/apply'
import { startController } from '@/content/controller'
import type { ContentRequest, ScanSnapshot } from '@/shared/messages'
import { AshbyControlledFixture } from './fixtures/ashby-controlled'
import { testProfile, testSettings } from './helpers'

const url = 'https://jobs.ashbyhq.com/example/job/application'
const context = () => ({ url, profile: testProfile(), settings: testSettings() })
const scan = () => scanDocument(document, context()).fields
let root: Root | undefined
let stop: (() => void) | undefined
beforeEach(() => {
  document.body.innerHTML = ''
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
})
afterEach(async () => {
  stop?.(); stop = undefined
  if (root) await act(async () => root!.unmount())
  root = undefined
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})
async function mount() {
  const host = document.createElement('div'); document.body.append(host)
  root = createRoot(host)
  await act(async () => root!.render(createElement(AshbyControlledFixture)))
}
function nativeField() {
  document.body.innerHTML = '<form><label for="name">First Name</label><input id="name" name="firstName" required></form>'
  return document.querySelector('input')!
}

describe('Ashby detection and controlled filling', () => {
  it('recognizes Ashby hosts and public DOM markers without matching lookalike domains', async () => {
    for (const address of [url, 'https://ashbyhq.com/', 'https://jobs.eu.ashbyhq.com/example']) {
      expect(detectAtsFromUrl(address)).toBe('ashby')
      expect(selectAdapter(address, document, testSettings()).id).toBe('ashby')
    }
    for (const address of ['https://ashbyhq.com.example.org/', 'https://notashbyhq.com/', 'not a URL']) {
      expect(detectAtsFromUrl(address)).toBe('generic')
    }
    await mount()
    expect(selectAdapter('https://careers.example.org/', document, testSettings()).id).toBe('ashby')
    expect(selectAdapter(url, document, testSettings({ enableSiteAdapters: false })).id).toBe('generic')
  })

  it('fills scanned inputs and textarea, commits application state, and survives a React rerender', async () => {
    await mount()
    const fields = scan()
    expect(fields.map(field => field.canonical)).toEqual(['firstName', 'lastName', 'email', 'phone', 'skills'])
    expect(fields.every(field => field.adapterId === 'ashby')).toBe(true)
    await act(async () => { await applyDetectedFields(fields, 'page') })
    // Plain skills text is an existing review-band match; explicitly accept it
    // just as the field indicator's Fill action does, without lowering thresholds.
    const skills = fields.find(field => field.canonical === 'skills')!
    expect(skills.fillBand).toBe('review')
    await act(async () => { await fillOne(skills) })
    const answers = JSON.parse(document.querySelector('[data-saved]')!.textContent!)
    for (const field of fields) {
      const expected = Array.isArray(field.proposedValue) ? field.proposedValue.join(', ') : field.proposedValue
      expect((field.control.elements[0] as HTMLInputElement).value).toBe(expected)
      expect(answers[field.canonical]).toBe(expected)
      expect(field.status).toBe('autofilled')
    }
    await act(async () => document.querySelector('button')!.click())
    for (const field of fields) expect((field.control.elements[0] as HTMLInputElement).value).toBe(answers[field.canonical])
  })

  it('does not report success when a framework restores its empty state in a microtask', async () => {
    const input = nativeField()
    const changes = vi.fn(() => queueMicrotask(() => { input.value = '' }))
    input.addEventListener('input', changes)
    const fields = scan()
    await applyDetectedFields(fields, 'page')
    expect(input.value).toBe('')
    expect(fields[0]).toMatchObject({ status: 'suggested', locked: true, fillError: expect.stringContaining('did not retain') })
    await applyDetectedFields(fields, 'page')
    expect(changes).toHaveBeenCalledOnce()
  })

  it.each([true, false])('verifies the live replacement after rendering (keeps value: %s)', async keepsValue => {
    const input = nativeField()
    input.addEventListener('input', () => {
      const value = input.value
      requestAnimationFrame(() => {
        const next = input.cloneNode() as HTMLInputElement
        next.value = keepsValue ? value : ''
        input.replaceWith(next)
      })
    })
    const field = scan()[0]!
    await applyDetectedFields([field], 'page')
    const next = document.querySelector('input')!
    expect(next).not.toBe(input)
    expect(field.status).toBe(keepsValue ? 'autofilled' : 'suggested')
    if (keepsValue) expect(field.control.elements[0]).toBe(next)
  })

  it('leaves a still-invalid value for review even if it is visible', async () => {
    const input = nativeField()
    input.setAttribute('aria-invalid', 'true')
    const field = scan()[0]!
    await applyDetectedFields([field], 'page')
    expect(input.value).toBe('Jordan')
    expect(field).toMatchObject({ status: 'suggested', locked: true, fillError: expect.stringContaining('invalid') })
  })

  it('recognizes validation clearing after the change/commit events', async () => {
    const input = nativeField()
    input.setAttribute('aria-invalid', 'true')
    input.addEventListener('focusout', () => queueMicrotask(() => input.setAttribute('aria-invalid', 'false')))
    const field = scan()[0]!
    await applyDetectedFields([field], 'page')
    expect(field.status).toBe('autofilled')
  })

  it('does not mistake an associated visible error for an accepted value', async () => {
    const input = nativeField()
    input.setAttribute('aria-errormessage', 'error')
    input.insertAdjacentHTML('afterend', '<p id="error">Required</p>')
    const result = await ashbyAdapter.fill(scan()[0]!, 'Alex')
    expect(result).toMatchObject({ ok: true, needsReview: true })
  })

  it('fails safely when the replacement is ambiguous', async () => {
    const input = nativeField()
    input.addEventListener('input', () => queueMicrotask(() => {
      const a = input.cloneNode() as HTMLInputElement
      const b = input.cloneNode() as HTMLInputElement
      a.value = b.value = input.value
      input.replaceWith(a, b)
    }))
    expect(await ashbyAdapter.fill(scan()[0]!, 'Alex')).toMatchObject({ ok: false, status: 'failed' })
  })

  it('fails safely if a rerender removes the field', async () => {
    const input = nativeField()
    input.addEventListener('input', () => queueMicrotask(() => input.remove()))
    expect(await ashbyAdapter.fill(scan()[0]!, 'Alex')).toMatchObject({ ok: false, status: 'failed' })
  })

  it('verifies the formatted date instead of comparing to the unformatted profile value', async () => {
    document.body.innerHTML = '<form><label for="start">Employment start date</label><input id="start" placeholder="MM/YYYY"></form>'
    const field = scan()[0]!
    expect(await ashbyAdapter.fill(field, '2022-06')).toMatchObject({ ok: true, status: 'filled' })
    expect(document.querySelector('input')!.value).toBe('06/2022')
  })

  it('keeps manual edits through controller rescans and subsequent autofill', async () => {
    await mount()
    const listeners: Array<(message: ContentRequest, sender: unknown, reply: (response: unknown) => void) => void> = []
    vi.stubGlobal('chrome', {
      storage: { local: { get: vi.fn(async () => ({ profile: testProfile(), settings: testSettings({ autoFillHighConfidence: false }) })) }, onChanged: { addListener() {}, removeListener() {} } },
      runtime: { onMessage: { addListener: (fn: typeof listeners[number]) => listeners.push(fn), removeListener() {} }, sendMessage: vi.fn(), lastError: undefined },
    })
    await act(async () => { stop = startController(document, window) })
    const command = (type: ContentRequest['type']) => new Promise<ScanSnapshot>(resolve => listeners[0]!({ type } as ContentRequest, {}, response => resolve(response as ScanSnapshot)))
    await act(async () => { await command('al:autofill') })
    const input = document.getElementById('firstName') as HTMLInputElement
    await act(async () => {
      input.focus()
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'My correction')
      input.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true, data: 'My correction', inputType: 'insertText' }))
      input.blur()
    })
    await act(async () => { await command('al:scan'); await command('al:autofill') })
    expect(input.value).toBe('My correction')
    const snapshot = await command('al:get-state')
    expect(snapshot.ats).toBe('ashby')
    expect(snapshot.fields.find(field => field.canonical === 'firstName')?.status).toBe('manual')
    expect(JSON.parse(document.querySelector('[data-saved]')!.textContent!).firstName).toBe('My correction')
  })
})
