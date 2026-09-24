import { act, createElement, StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import type { Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from '@/ui/popup/App'
import { Toggle } from '@/ui/popup/components/ui'
import { createSampleProfile } from '@/profile/defaults'
import { createDefaultSettings } from '@/settings/defaults'
import { loadPageState, runPageCommand } from '@/ui/popup/api'
import type { PageState } from '@/ui/popup/api'
import { serializeBackup } from '@/backup/serialization'

vi.mock('@/ui/popup/api', () => ({ loadPageState: vi.fn(), runPageCommand: vi.fn() }))
const page: PageState = { url: 'https://example.com/apply', ats: 'workday', atsLabel: 'Workday', snapshot: { ok: true, href: 'https://example.com/apply', ats: 'workday', atsLabel: 'Workday', enabled: true, counts: { detected: 24, autofilled: 18, review: 4, skipped: 2, unrecognized: 0 }, fields: [] } }
let root: Root
let host: HTMLDivElement
let stored: Record<string, unknown>
let setStorage: ReturnType<typeof vi.fn>

function button(text: string, scope: ParentNode = host) {
  const result = [...scope.querySelectorAll<HTMLButtonElement>('button')].find(node => node.textContent?.trim() === text)
  if (!result) throw new Error(`Missing button: ${text}`)
  return result
}
function section(title: string) {
  const result = [...host.querySelectorAll<HTMLButtonElement>('.accordion-trigger')].find(node => node.querySelector('strong')?.textContent === title)
  if (!result) throw new Error(`Missing section: ${title}`)
  return result
}
function input(label: string) {
  const result = [...host.querySelectorAll('label')].find(node => node.querySelector('span')?.textContent === label)?.querySelector('input')
  if (!result) throw new Error(`Missing input: ${label}`)
  return result
}
async function click(node: HTMLElement) { await act(async () => { node.click() }) }
async function type(node: HTMLInputElement, value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(node, value)
    node.dispatchEvent(new Event('input', { bubbles: true }))
  })
}
async function tick(ms: number) { await act(async () => { await vi.advanceTimersByTimeAsync(ms) }) }
async function mount() { await act(async () => { root.render(createElement(StrictMode, null, createElement(App))) }) }

beforeEach(() => {
  vi.useFakeTimers()
  vi.clearAllMocks()
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  stored = { profile: createSampleProfile(), settings: createDefaultSettings(), applications: [] }
  setStorage = vi.fn(async (data: Record<string, unknown>) => { Object.assign(stored, data) })
  vi.stubGlobal('chrome', { storage: { local: { get: vi.fn(async () => stored), set: setStorage }, onChanged: { addListener: vi.fn(), removeListener: vi.fn() } } })
  vi.mocked(loadPageState).mockResolvedValue(page)
  vi.mocked(runPageCommand).mockResolvedValue(page)
  host = document.createElement('div'); document.body.append(host); root = createRoot(host)
})
afterEach(async () => {
  await act(async () => root.unmount())
  host.remove(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks()
})

describe('popup navigation and profile state', () => {
  it('supports arrow/Home/End navigation with one active tab and inert inactive panels', async () => {
    await mount()
    const overview = button('Overview')
    await act(async () => { overview.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })) })
    expect(button('Profile').getAttribute('aria-selected')).toBe('true')
    expect(document.activeElement).toBe(button('Profile'))
    expect(host.querySelector('#panel-overview')?.hasAttribute('inert')).toBe(true)
    expect(host.querySelector('#panel-profile')?.hasAttribute('inert')).toBe(false)
    await act(async () => { button('Profile').dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true })) })
    expect(button('Settings').getAttribute('aria-selected')).toBe('true')
    await act(async () => { button('Settings').dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true })) })
    expect(button('Overview').getAttribute('aria-selected')).toBe('true')
    await tick(500)
    expect(setStorage).not.toHaveBeenCalled()
  })
  it('preserves edits, accordion state and panel scroll across navigation with one debounced save', async () => {
    await mount(); await click(button('Profile')); await click(section('Contact & address'))
    const email = input('Email')
    await type(email, 'new@example.test')
    expect(host.textContent).toContain('Saving…')
    const panel = host.querySelector('#panel-profile')!
    panel.scrollTop = 200
    await click(button('Settings')); await click(button('Profile'))
    expect(input('Email')).toBe(email)
    expect(email.value).toBe('new@example.test')
    expect(section('Contact & address').getAttribute('aria-expanded')).toBe('true')
    expect(panel.scrollTop).toBe(200)
    await tick(300)
    expect(setStorage).toHaveBeenCalledTimes(1)
    expect(stored.profile).toMatchObject({ personal: { email: 'new@example.test' } })
    expect(host.textContent).toContain('Saved locally')
    await click(section('Contact & address'))
    expect(document.getElementById(section('Contact & address').getAttribute('aria-controls')!)?.hasAttribute('inert')).toBe(true)
  })
  it('adds expandable entries and removes only the selected entry without changing saved order', async () => {
    await mount(); await click(button('Profile')); await click(section('Education'))
    const original = createSampleProfile().education
    expect(host.querySelectorAll('.entry-card').length).toBe(original.length + createSampleProfile().employment.length)
    await click(button('Add education'))
    const cards = section('Education').closest('.accordion')!.querySelectorAll('.entry-card')
    const added = cards[cards.length - 1]
    expect(added.getAttribute('data-open')).toBe('true')
    await click(button('Remove entry', added))
    expect(added.closest('.entry-presence')?.getAttribute('data-removing')).toBe('true')
    await tick(180)
    await tick(300)
    expect(stored.profile).toMatchObject({ education: original })
  })
  it('keeps local editing available while page connection is pending', async () => {
    vi.mocked(loadPageState).mockReturnValue(new Promise(() => {}))
    await mount(); await click(button('Profile'))
    expect(input('First name').value).toBe(createSampleProfile().personal.firstName)
  })
  it('surfaces failed saves and retries without discarding input', async () => {
    setStorage.mockRejectedValueOnce(new Error('Storage unavailable'))
    await mount(); await click(button('Profile')); await type(input('First name'), 'Updated')
    await tick(300)
    expect(host.textContent).toContain('Not saved')
    await click(button('Retry save')); await tick(300)
    expect(input('First name').value).toBe('Updated')
    expect(stored.profile).toMatchObject({ personal: { firstName: 'Updated' } })
    expect(host.textContent).toContain('Saved locally')
  })
})

describe('settings, backup and page actions', () => {
  it('updates switches and both sensitive compatibility flags while retaining unrelated settings', async () => {
    await mount(); await click(button('Settings'))
    const switches = host.querySelectorAll<HTMLButtonElement>('#panel-settings [role="switch"]')
    await click(switches[0]); await tick(200)
    expect(switches[0].getAttribute('aria-checked')).toBe('false')
    expect(stored.settings).toMatchObject({ enabled: false, autofillThreshold: .9 })
    await click(switches[4]); await tick(200)
    expect(stored.settings).toMatchObject({ autofillSensitiveDemographics: true, neverAutofillSensitive: false })
    await click(button('Overview'))
    expect(button('Autofill page').disabled).toBe(true)
  })
  it('does not activate a disabled toggle', async () => {
    const change = vi.fn()
    await act(async () => root.render(createElement(Toggle, { label: 'Disabled option', checked: false, onChange: change, disabled: true })))
    await click(host.querySelector('button')!)
    expect(change).not.toHaveBeenCalled()
    expect(host.querySelector('button')?.getAttribute('aria-checked')).toBe('false')
  })
  it('calls existing scan/autofill commands and prevents repeats while displaying progress', async () => {
    let finish!: (page: PageState) => void
    vi.mocked(runPageCommand).mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    await mount(); await click(button('Autofill page'))
    expect(button('Filling…').disabled).toBe(true)
    await click(button('Filling…'))
    expect(runPageCommand).toHaveBeenCalledTimes(1)
    expect(runPageCommand).toHaveBeenCalledWith('al:autofill')
    await act(async () => finish(page))
    expect(host.textContent).toContain('18 fields filled on this page.')
    await click(button('Scan again'))
    expect(runPageCommand).toHaveBeenLastCalledWith('al:scan')
  })
  it('recovers the action buttons after command failure and explains next steps', async () => {
    vi.mocked(runPageCommand).mockRejectedValueOnce(new Error('Disconnected'))
    await mount(); await click(button('Autofill page'))
    expect(host.textContent).toContain('refresh it, then scan again')
    expect(button('Autofill page').disabled).toBe(false)
  })
  it('exports a backup and keeps import reachable through the file picker', async () => {
    const createURL = vi.fn(() => 'blob:test')
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createURL })
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() })
    const download = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    await mount(); await click(button('Settings')); await click(button('Export backup'))
    expect(createURL).toHaveBeenCalledWith(expect.any(Blob)); expect(download).toHaveBeenCalledOnce()
    const file = host.querySelector<HTMLInputElement>('input[type="file"]')!
    const pick = vi.spyOn(file, 'click').mockImplementation(() => {})
    await click(button('Import backup')); expect(pick).toHaveBeenCalledOnce()
  })
  it('previews an import, restores it only on confirmation, and does not duplicate autosave writes', async () => {
    await mount(); await click(button('Settings'))
    const profile = createSampleProfile(); profile.personal.firstName = 'Restored'
    const file = host.querySelector<HTMLInputElement>('input[type="file"]')!
    Object.defineProperty(file, 'files', { configurable: true, value: [{ size: 100, text: async () => serializeBackup(profile, createDefaultSettings()) }] })
    await act(async () => { file.dispatchEvent(new Event('change', { bubbles: true })) })
    expect(setStorage).not.toHaveBeenCalled()
    await click(button('Replace profile and settings'))
    await click(button('Profile')); await tick(500)
    expect(input('First name').value).toBe('Restored')
    expect(setStorage).toHaveBeenCalledTimes(1)
    expect(stored.profile).toEqual(profile)
  })
})
