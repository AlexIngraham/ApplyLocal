import type { AdapterHint, DetectedField, FillResult } from '@/adapters/types'
import type { CanonicalField } from '@/classifier/types'
import { normalize } from '@/classifier/normalize'
import { matchChoice } from '@/content/matchers'
import { cleanText, cssEscape } from '@/utils/dom'
import { withSyntheticFill } from '@/utils/events'
import { devLog } from '@/utils/logging'

const WORKDAY_ROOT_MARKERS = [
  '[data-automation-id="applicationPage"]',
  '[data-automation-id="jobApplication"]',
  '[data-automation-id="candidateHome"]',
  '[data-automation-id="workdayApplication"]',
  '[data-automation-id="jobPostingPage"]',
]

const HINTS: Array<[RegExp, AdapterHint]> = [
  [/\b(first name|firstname)\b/, hint('firstName', 'Workday first name field')],
  [/\b(middle name|middlename|middle initial)\b/, hint('middleName', 'Workday middle name field')],
  [/\b(last name|lastname|family name)\b/, hint('lastName', 'Workday last name field')],
  [/\b(preferred name|preferredname)\b/, hint('preferredName', 'Workday preferred name field')],
  [/\b(email address|emailaddress|email)\b/, hint('email', 'Workday email field')],
  [/\b(phone number|phonenumber|mobile phone)\b/, hint('phone', 'Workday phone field')],
  [/\b(address line 1|addressline1|street address)\b/, hint('address', 'Workday street address field')],
  [/\b(postal code|postalcode|zip code)\b/, hint('zip', 'Workday postal code field')],
  [/\b(country)\b/, hint('country', 'Workday country field')],
  [/\b(state|region|province)\b/, hint('state', 'Workday state or region field')],
  [/\bcity\b/, hint('city', 'Workday city field')],
  [/\b(school|institution|university)\b/, hint('school', 'Workday school field')],
  [/\b(field of study|fieldofstudy|major)\b/, hint('major', 'Workday field of study')],
  [/\bdegree\b/, hint('degree', 'Workday degree field')],
  [/\b(graduation date|graduationdate)\b/, hint('graduationDate', 'Workday graduation date field')],
  [/\blinked ?in\b/, hint('linkedin', 'Workday LinkedIn field')],
  [/\bgithub\b/, hint('github', 'Workday GitHub field')],
  [/\b(portfolio|website)\b/, hint('portfolio', 'Workday portfolio field')],
]

function hint(key: CanonicalField, reason: string): AdapterHint {
  return { key, confidence: 0.98, reason }
}

export function isWorkdayDom(root: ParentNode): boolean {
  if (WORKDAY_ROOT_MARKERS.some((selector) => root.querySelector(selector))) return true
  const automation = root.querySelector('[data-automation-id]')
  if (!automation) return false
  return Boolean(
    root.querySelector(
      '[data-automation-id*="jobApplication" i], [data-automation-id*="candidate" i], [data-automation-id][role="combobox"], [data-automation-id][role="listbox"]',
    ),
  )
}

export function workdayHintFor(el: Element): AdapterHint | null {
  const pieces = [
    el.getAttribute('data-automation-id'),
    el.getAttribute('name'),
    el.getAttribute('id'),
    el.getAttribute('aria-label'),
    el.closest('[data-automation-id]')?.getAttribute('data-automation-id'),
  ]
  const text = normalize(pieces.filter(Boolean).join(' '))
  for (const [pattern, value] of HINTS) {
    if (pattern.test(text)) return value
  }
  return null
}

export function matchWorkdayOption(labels: string[], desired: string, key: CanonicalField): number | null {
  const choices = labels.map((label, index) => ({ value: String(index), label }))
  const matched = matchChoice(choices, desired, key)
  if (matched == null) return null
  const index = Number(matched)
  return Number.isInteger(index) && index >= 0 && index < labels.length ? index : null
}

let comboboxQueue: Promise<void> = Promise.resolve()

export function fillWorkdayCombobox(field: DetectedField, desiredValue: string, timeoutMs = 1800): Promise<FillResult> {
  const task = comboboxQueue
    .then(() => fillComboboxNow(field, desiredValue, timeoutMs))
    .catch(() => failed('Workday changed this dropdown before it could be filled.'))
  comboboxQueue = task.then(
    () => undefined,
    () => undefined,
  )
  return task
}

async function fillComboboxNow(field: DetectedField, desiredValue: string, timeoutMs: number): Promise<FillResult> {
  const original = field.control.elements[0]
  if (!original) return failed('Missing Workday combobox.')
  const doc = original.ownerDocument
  const locator = controlLocator(original)
  const resolve = () => resolveControl(doc, locator, original)
  let control = resolve()
  if (!control) return failed('The Workday combobox is no longer on the page.')

  devLog('Workday combobox detected')
  devLog('Opening Workday combobox')
  withSyntheticFill(() => {
    control?.focus({ preventScroll: true })
    control?.click()
  })

  control = resolve()
  const editor = editableFor(control)
  if (editor && !editor.readOnly && !editor.disabled) {
    withSyntheticFill(() => typeIntoCombobox(editor, desiredValue))
  }

  const options = await waitForOptions(doc, control, timeoutMs)
  devLog('Workday options found', { count: options.length })
  if (!options.length) return failed('Workday did not show any choices for this field.')
  const labels = options.map(optionText)
  const matchIndex = matchWorkdayOption(labels, desiredValue, field.canonical)
  if (matchIndex == null) return failed('No unambiguous Workday option matched the saved answer.')
  const option = options[matchIndex]
  if (!option) return failed('The matching Workday option disappeared.')
  const matchedLabel = labels[matchIndex] || ''
  devLog('Workday option matched', { option: matchedLabel.slice(0, 80) })

  control = resolve()
  const controlBeforeSelection = control
  const textBeforeSelection = control ? selectedText(control) : ''
  const wasExpanded = control?.getAttribute('aria-expanded') === 'true'

  withSyntheticFill(() => {
    option.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    option.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
    option.click()
  })

  const confirmed = await waitFor(
    doc,
    () => {
      const current = resolve()
      if (!current) return option.getAttribute('aria-selected') === 'true'
      const after = selectedText(current)
      const selected = option.getAttribute('aria-selected') === 'true'
      const matchedText = normalize(after) === normalize(matchedLabel)
      const selectionChanged = matchedText && normalize(after) !== normalize(textBeforeSelection)
      const controlReplaced = matchedText && current !== controlBeforeSelection
      const dropdownClosed = matchedText && wasExpanded && current.getAttribute('aria-expanded') === 'false'
      return (
        selected ||
        selectionChanged ||
        controlReplaced ||
        dropdownClosed
      )
    },
    Math.min(timeoutMs, 1200),
  )
  if (!confirmed) return failed('Workday did not confirm the selected option.')
  devLog('Workday selection confirmed')
  return { ok: true, status: 'filled' }
}

interface ControlLocator {
  id: string
  automationId: string
  name: string
  ariaLabel: string
  ariaLabelledby: string
}

function controlLocator(el: HTMLElement): ControlLocator {
  return {
    id: el.id,
    automationId: el.getAttribute('data-automation-id') || '',
    name: el.getAttribute('name') || '',
    ariaLabel: el.getAttribute('aria-label') || '',
    ariaLabelledby: el.getAttribute('aria-labelledby') || '',
  }
}

function resolveControl(doc: Document, locator: ControlLocator, fallback: HTMLElement): HTMLElement | null {
  const selectors: string[] = []
  if (locator.id) selectors.push(`#${cssEscape(locator.id)}`)
  if (locator.automationId) selectors.push(`[data-automation-id="${cssEscape(locator.automationId)}"][role="combobox"]`)
  if (locator.name) selectors.push(`[name="${cssEscape(locator.name)}"][role="combobox"]`)
  if (locator.ariaLabel) selectors.push(`[aria-label="${cssEscape(locator.ariaLabel)}"][role="combobox"]`)
  if (locator.ariaLabelledby) selectors.push(`[aria-labelledby="${cssEscape(locator.ariaLabelledby)}"][role="combobox"]`)
  for (const selector of selectors) {
    const found = doc.querySelector(selector)
    if (found instanceof HTMLElement) return found
  }
  return fallback.isConnected ? fallback : null
}

function editableFor(control: HTMLElement | null): HTMLInputElement | HTMLTextAreaElement | null {
  if (control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement) return control
  const nested = control?.querySelector('input:not([type="hidden"]), textarea')
  return nested instanceof HTMLInputElement || nested instanceof HTMLTextAreaElement ? nested : null
}

function typeIntoCombobox(el: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  const prototype = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
  const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value')
  const previous = el.value
  if (descriptor?.set) descriptor.set.call(el, value)
  else el.value = value
  const tracked = el as (HTMLInputElement | HTMLTextAreaElement) & { _valueTracker?: { setValue: (next: string) => void } }
  tracked._valueTracker?.setValue(previous === value ? `${previous} ` : previous)
  el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: value }))
}

function optionText(option: HTMLElement): string {
  return cleanText(option.getAttribute('aria-label') || option.getAttribute('data-value') || option.textContent)
}

function selectedText(control: HTMLElement): string {
  if (control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement) return cleanText(control.value)
  const selected = control.querySelector('[aria-selected="true"]')
  return cleanText(
    control.getAttribute('data-value') ||
      control.getAttribute('aria-valuetext') ||
      selected?.getAttribute('aria-label') ||
      selected?.textContent ||
      control.textContent,
  )
}

async function waitForOptions(doc: Document, control: HTMLElement | null, timeoutMs: number): Promise<HTMLElement[]> {
  let found: HTMLElement[] = []
  await waitFor(
    doc,
    () => {
      found = queryOptions(doc, control)
      return found.length > 0
    },
    timeoutMs,
  )
  return found
}

function queryOptions(doc: Document, control: HTMLElement | null): HTMLElement[] {
  const controlledIds = `${control?.getAttribute('aria-controls') || ''} ${control?.getAttribute('aria-owns') || ''}`
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  const scoped: HTMLElement[] = []
  for (const id of controlledIds) {
    const listbox = doc.getElementById(id)
    if (!listbox) continue
    listbox.querySelectorAll('[role="option"], [data-automation-id="promptOption"]').forEach((el) => {
      if (el instanceof HTMLElement) scoped.push(el)
    })
  }
  if (controlledIds.length) return unique(scoped).filter((option) => optionText(option).length > 0)
  return unique(
    Array.from(doc.querySelectorAll('[role="listbox"] [role="option"], [role="option"][data-automation-id], [data-automation-id="promptOption"]')).filter(
      (el): el is HTMLElement => el instanceof HTMLElement,
    ),
  ).filter((option) => optionText(option).length > 0)
}

function unique(elements: HTMLElement[]): HTMLElement[] {
  return [...new Set(elements)]
}

function waitFor(doc: Document, predicate: () => boolean, timeoutMs: number): Promise<boolean> {
  if (predicate()) return Promise.resolve(true)
  return new Promise((resolve) => {
    let finished = false
    const root = doc.documentElement
    const observer = new MutationObserver(check)
    const interval = window.setInterval(check, 50)
    const timeout = window.setTimeout(() => finish(false), timeoutMs)
    observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-selected', 'aria-expanded', 'value', 'data-value'] })

    function check() {
      if (predicate()) finish(true)
    }

    function finish(result: boolean) {
      if (finished) return
      finished = true
      observer.disconnect()
      window.clearInterval(interval)
      window.clearTimeout(timeout)
      resolve(result)
    }
  })
}

function failed(message: string): FillResult {
  devLog('Workday combobox fill stopped')
  return { ok: false, status: 'failed', message }
}
