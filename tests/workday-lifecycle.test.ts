import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getWorkdaySections, resetWorkdaySections, watchWorkdaySections } from '@/adapters/workdaySections'
import { scanDocument } from '@/content/scanner'
import { applyDetectedFields } from '@/content/apply'
import { startController } from '@/content/controller'
import type { ScanSnapshot } from '@/shared/messages'
import { observeAdditions } from '@/content/mutationObserver'
import { renderFixture, testProfile, testSettings } from './helpers'

const ctx = () => {
  const profile = testProfile()
  profile.employment.push({ ...profile.employment[0]!, id: 'second', company: 'Earlier company', jobTitle: 'Earlier title', location: 'Earlier location', startDate: '2020-01', endDate: '2022-05', current: false })
  return { url: 'https://acme.myworkdayjobs.com/job/1', profile, settings: testSettings() }
}
let cleanup: Array<() => void> = []
beforeEach(() => { document.body.innerHTML = ''; resetWorkdaySections(document); vi.useRealTimers() })
afterEach(() => { cleanup.forEach((stop) => stop()); cleanup = []; vi.unstubAllGlobals(); vi.useRealTimers() })
const scan = () => scanDocument(document, ctx()).fields
const wait = () => new Promise((resolve) => setTimeout(resolve, 260))

describe('Workday real layout grouping', () => {
  it('groups weak heading boundaries and odd field orders without generated selectors', () => {
    renderFixture('workday-weak-sections.html')
    const fields = scan()
    expect(fields).toHaveLength(10)
    expect(fields.map((field) => field.repeatedSection?.sectionIndex)).toEqual([0,0,0,0,0,1,1,1,1,1])
    expect(fields.map((field) => field.proposedValue)).toEqual([
      'Software Engineer', 'Northwind Labs', '2022-06', null, 'Austin, TX',
      'Earlier company', 'Earlier location', '2022-05', 'Earlier title', '2020-01',
    ])
  })

  it.each([false, true])('advances a user-created single editor (replace node: %s)', async (replace) => {
    renderFixture('workday-single-editor.html')
    cleanup.push(watchWorkdaySections(document))
    const first = scan()
    expect(first.every((field) => field.repeatIndex === 0)).toBe(true)
    await applyDetectedFields(first, 'auto')
    const editor = document.querySelector<HTMLElement>('[data-automation-id="workExperienceEditor"]')!
    document.querySelector<HTMLButtonElement>('button')!.click()
    document.getElementById('summaries')!.innerHTML = '<article data-automation-id="workExperienceSummary"><h3>Work Experience 1</h3><p>Saved experience</p></article>'
    if (replace) editor.outerHTML = editor.outerHTML
    else editor.querySelectorAll('input').forEach((el) => { el.value = '' })
    const next = scan()
    expect(next.every((field) => field.repeatIndex === 1)).toBe(true)
    expect(next.find((field) => field.canonical === 'company')?.proposedValue).toBe('Earlier company')
    expect(scan().map((field) => field.repeatedSection?.sectionKey)).toEqual(next.map((field) => field.repeatedSection?.sectionKey))
  })

  it('advances reused editors without summary cards only after Add and reset', async () => {
    renderFixture('workday-single-editor.html')
    cleanup.push(watchWorkdaySections(document))
    await applyDetectedFields(scan(), 'auto')
    document.querySelector<HTMLButtonElement>('button')!.click()
    expect(scan()[0]?.repeatIndex).toBe(0) // cancelled/unfinished Add
    document.querySelectorAll('input').forEach((input) => { input.value = '' })
    expect(scan().every((field) => field.repeatIndex === 1)).toBe(true)
  })

  it('uses numbering for a collapsed card editor and stable keys across generated IDs', () => {
    renderFixture('workday-single-editor.html')
    const editor = document.querySelector<HTMLElement>('[data-automation-id="workExperienceEditor"]')!
    editor.setAttribute('aria-label', 'Work Experience 2')
    editor.id = 'generated-abc'
    const before = getWorkdaySections(document).find((section) => section.container === editor)!
    editor.id = 'generated-xyz'
    expect(getWorkdaySections(document).find((section) => section.container === editor)).toMatchObject({ sectionIndex: 1, sectionKey: before.sectionKey })
  })

  it('inherits the index of a reopened card around an unnumbered nested editor', () => {
    renderFixture('workday-single-editor.html')
    const editor = document.querySelector('[data-automation-id="workExperienceEditor"]')!
    const card = document.createElement('article')
    card.setAttribute('aria-label', 'Work Experience 2')
    editor.replaceWith(card); card.append(editor)
    expect(scan().every((field) => field.repeatIndex === 1)).toBe(true)
  })

  it('groups unmarked sibling clusters, including nested field wrappers', () => {
    renderFixture('workday-weak-sections.html')
    document.querySelectorAll('h3').forEach((heading) => heading.remove())
    const first = document.querySelector('[role="region"] > div')!
    const wrapper = document.createElement('div')
    wrapper.append(first.querySelectorAll('label')[0]!, first.querySelectorAll('label')[1]!)
    first.prepend(wrapper)
    expect(scan().map((field) => field.repeatIndex)).toEqual([0,0,0,0,0,1,1,1,1,1])
  })

  it('keeps a visible editor at entry zero while the outgoing step stays hidden', () => {
    renderFixture('workday-single-editor.html')
    const old = document.querySelector('section')!
    const fresh = old.cloneNode(true) as HTMLElement
    old.hidden = true; old.after(fresh)
    expect(scan().map((field) => field.repeatIndex)).toEqual([0,0,0,0,0])
  })

  it('advances one-at-a-time education independently of employment', () => {
    document.body.innerHTML = '<main data-automation-id="applicationPage"><section aria-label="Education"><button>Add Another</button><article data-automation-id="educationEditor"><label>School<input value="First school"></label><label>Degree<input></label></article></section></main>'
    cleanup.push(watchWorkdaySections(document))
    expect(scan()[0]?.proposedValue).toBe('State University')
    document.querySelector<HTMLButtonElement>('button')!.click()
    document.querySelector<HTMLInputElement>('input')!.value = ''
    expect(scan()[0]?.proposedValue).toBe('City College')
  })

  it('does not scan retained hidden steps or fill detached controls', async () => {
    renderFixture('workday-single-editor.html')
    const fields = scan()
    document.querySelector('section')!.hidden = true
    expect(scan()).toHaveLength(0)
    document.body.innerHTML = ''
    await applyDetectedFields(fields, 'auto')
    expect((fields[0]!.control.elements[0] as HTMLInputElement).value).toBe('')
  })
})

async function controller() {
  const listeners: Array<(message: unknown, sender: unknown, reply: (value: unknown) => void) => void> = []
  const data = ctx()
  vi.stubGlobal('chrome', {
    storage: { local: { get: vi.fn(async () => data) }, onChanged: { addListener: vi.fn(), removeListener: vi.fn() } },
    runtime: { onMessage: { addListener: (fn: typeof listeners[number]) => listeners.push(fn), removeListener: vi.fn() }, sendMessage: vi.fn(), lastError: undefined },
  })
  cleanup.push(startController(document, window))
  await wait()
  return () => new Promise<ScanSnapshot>((resolve) => listeners[0]!({ type: 'al:get-state' }, {}, (value) => resolve(value as ScanSnapshot)))
}

describe('Workday controller lifecycle', () => {
  it('preserves manual locks through removal, delayed replacement, and changed generated IDs', async () => {
    renderFixture('workday-single-editor.html')
    const snapshot = await controller()
    const input = document.querySelector<HTMLInputElement>('[data-automation-id="company"]')!
    expect(input.value).toBe('Northwind Labs')
    for (const [automation, value] of [['company', 'My correction'], ['jobTitle', 'Corrected title'], ['startDate', '2021-03'], ['location', 'Corrected location']]) {
      const control = document.querySelector<HTMLInputElement>(`[data-automation-id="${automation}"]`)!
      control.value = value!
      control.dispatchEvent(new Event('input', { bubbles: true }))
    }
    const editor = input.closest('[data-automation-id="workExperienceEditor"]')!
    const markup = editor.outerHTML
    editor.remove()
    await wait()
    expect((await snapshot()).fields).toHaveLength(0)
    document.querySelector('section')!.insertAdjacentHTML('beforeend', markup)
    const replacement = document.querySelector<HTMLInputElement>('[data-automation-id="company"]')!
    replacement.id = 'new-random-id'
    await wait()
    expect(replacement.value).toBe('') // do not replay saved profile over the user's edit
    for (const canonical of ['company', 'jobTitle', 'employmentStart', 'employmentLocation']) {
      expect((await snapshot()).fields.find((f) => f.canonical === canonical)?.status).toBe('manual')
    }
    expect(document.querySelectorAll('#applylocal-root')).toHaveLength(1)
    expect(document.querySelector('#applylocal-root')!.shadowRoot!.querySelectorAll('.dot')).toHaveLength(5)
  })

  it('fills the next logical entry when Workday reuses the same controls', async () => {
    renderFixture('workday-single-editor.html')
    await controller()
    document.querySelector<HTMLButtonElement>('section button')!.click()
    document.querySelectorAll('input').forEach((input) => { input.value = '' })
    await wait()
    expect(document.querySelector<HTMLInputElement>('[data-automation-id="company"]')!.value).toBe('Earlier company')
    expect(document.querySelector<HTMLInputElement>('[data-automation-id="jobTitle"]')!.value).toBe('Earlier title')
  })

  it('catches user input on a replacement before the debounce finishes', async () => {
    renderFixture('workday-single-editor.html')
    const snapshot = await controller()
    const old = document.querySelector<HTMLInputElement>('[data-automation-id="company"]')!
    const next = old.cloneNode() as HTMLInputElement
    next.value = ''; old.replaceWith(next)
    next.value = 'Immediate correction'
    next.dispatchEvent(new Event('input', { bubbles: true }))
    await wait()
    expect(next.value).toBe('Immediate correction')
    expect((await snapshot()).fields.find((field) => field.canonical === 'company')?.status).toBe('manual')
  })

  it('replaces a whole step, discovers its controls, and keeps indicators unique', async () => {
    renderFixture('workday-multistep.html')
    const snapshot = await controller()
    const template = document.getElementById('education-step-template') as HTMLTemplateElement
    document.getElementById('workday-step')!.replaceWith(template.content.cloneNode(true))
    await wait()
    const result = await snapshot()
    expect(result.fields.map((f) => f.canonical)).toEqual(['school', 'major'])
    expect(document.querySelector('#applylocal-root')!.shadowRoot!.querySelectorAll('.dot')).toHaveLength(2)
    expect((document.getElementById('step-school') as HTMLInputElement).value).toBe('State University')
  })

  it('notices history changes and ignores its own indicator mutations', async () => {
    vi.useFakeTimers()
    const changed = vi.fn()
    cleanup.push(observeAdditions(document, changed, true))
    const host = document.createElement('div'); host.id = 'applylocal-test'; host.innerHTML = '<input>'
    document.body.append(host)
    await vi.advanceTimersByTimeAsync(300)
    expect(changed).not.toHaveBeenCalled()
    window.history.pushState({}, '', '/next-step')
    await vi.advanceTimersByTimeAsync(800)
    expect(changed).toHaveBeenCalledTimes(1)
    window.history.replaceState({}, '', '/another-step')
    await vi.advanceTimersByTimeAsync(800)
    expect(changed).toHaveBeenCalledTimes(2)
  })
})
