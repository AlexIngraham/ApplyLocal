import { createElement, act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setNativeValue } from '@/content/filler'
import { AshbyControlledFixture } from './fixtures/ashby-controlled'

let root: Root | undefined
let host: HTMLDivElement
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  document.body.innerHTML = ''
  host = document.createElement('div')
  document.body.append(host)
})
afterEach(async () => {
  if (root) await act(async () => root!.unmount())
  root = undefined
  host.remove()
  vi.unstubAllGlobals()
})
async function mount() {
  root = createRoot(host)
  await act(async () => root!.render(createElement(AshbyControlledFixture)))
}
const control = (id: string) => document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement
const saved = () => JSON.parse(host.querySelector('[data-saved]')!.textContent!) as Record<string, string>

describe('controlled text input events', () => {
  it('reproduces visible DOM text with empty React state after direct assignment', async () => {
    await mount()
    const input = control('firstName')
    await act(async () => {
      input.value = 'Alex'
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect(input.value).toBe('Alex')
    expect(host.querySelector('[data-draft="firstName"]')!.textContent).toBe('')
    expect(saved().firstName).toBeUndefined()
    await act(async () => host.querySelector('button')!.click())
    expect(input.value).toBe('')
  })

  it.each([
    ['firstName', 'Alex'], ['lastName', 'Morgan'], ['email', 'alex@example.test'],
    ['phone', '555-0123'], ['skills', 'TypeScript\nReact'],
  ])('updates React draft and committed state for %s without beforeinput or keyboard events', async (id, value) => {
    await mount()
    const input = control(id)
    const events: Event[] = []
    for (const type of ['focus', 'beforeinput', 'input', 'change', 'blur', 'focusout', 'keydown', 'keypress', 'keyup']) {
      input.addEventListener(type, event => events.push(event))
    }
    await act(async () => setNativeValue(input, value))
    expect(input.value).toBe(value)
    expect(host.querySelector(`[data-draft="${id}"]`)!.textContent).toBe(value)
    expect(saved()[id]).toBe(value)
    expect(events.map(event => event.type)).toEqual(['focus', 'input', 'change', 'blur', 'focusout'])
    const inputEvent = events.find(event => event.type === 'input') as InputEvent
    expect(inputEvent).toBeInstanceOf(InputEvent)
    expect(inputEvent).toMatchObject({ bubbles: true, composed: true, inputType: 'insertText', data: value })
    expect(document.activeElement).not.toBe(input)
    await act(async () => host.querySelector('button')!.click())
    expect(input.value).toBe(value)
    expect(saved()[id]).toBe(value)
  })

  it('updates ordinary and Vue-style input/change listeners', () => {
    const input = document.createElement('input'); host.append(input)
    let model = ''; let lazyModel = ''
    input.addEventListener('input', () => { model = input.value })
    input.addEventListener('change', () => { lazyModel = input.value })
    setNativeValue(input, 'Alex')
    expect([input.value, model, lazyModel]).toEqual(['Alex', 'Alex', 'Alex'])
  })

  it('uses constructors from the input document for iframe inputs and textareas', () => {
    const iframe = document.createElement('iframe'); host.append(iframe)
    const doc = iframe.contentDocument!
    for (const tag of ['input', 'textarea'] as const) {
      const input = doc.createElement(tag); doc.body.append(input)
      let event: Event | undefined
      input.addEventListener('input', next => { event = next })
      setNativeValue(input, 'Alex')
      expect(input.value).toBe('Alex')
      expect(event).toBeInstanceOf(doc.defaultView!.InputEvent)
    }
  })

  it('lets input events reach listeners outside an open shadow root', () => {
    const shadow = host.attachShadow({ mode: 'open' })
    const input = document.createElement('input'); shadow.append(input)
    let state = ''
    host.addEventListener('input', () => { state = input.value })
    setNativeValue(input, 'Alex')
    expect(state).toBe('Alex')
  })

  it('falls back to a composed Event when InputEvent is unavailable', () => {
    vi.stubGlobal('InputEvent', undefined)
    const input = document.createElement('input'); host.append(input)
    let event: Event | undefined
    input.addEventListener('input', next => { event = next })
    setNativeValue(input, 'Alex')
    expect(event).toMatchObject({ type: 'input', bubbles: true, composed: true })
    expect(input.value).toBe('Alex')
  })

  it('keeps a searchable widget open when it opts out of blur', () => {
    const input = document.createElement('input'); input.type = 'search'
    const options = document.createElement('div'); host.append(input, options)
    input.addEventListener('blur', () => options.remove())
    setNativeValue(input, 'React', { blur: false })
    expect(document.activeElement).toBe(input)
    expect(options.isConnected).toBe(true)
  })
})
