import type { DetectedField, FillResult, ProposedValue } from '@/adapters/types'
import { labelForControl } from '@/utils/dom'
import { dispatchValueEvents, withSyntheticFill } from '@/utils/events'
import { checkboxShouldBeChecked, matchChoice, parseMoney, toDate, toMonth } from '@/content/matchers'
import type { Choice } from '@/content/matchers'
import { dateCandidatesForControl } from '@/content/dateFormat'

type Tracked = HTMLInputElement & { _valueTracker?: { setValue: (value: string) => void } }

export function setNativeValue(el: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  const prototype = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
  const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value')
  const previous = el.value
  if (typeof el.focus === 'function') el.focus({ preventScroll: true })
  if (descriptor?.set) descriptor.set.call(el, value)
  else el.value = value
  const tracker = (el as Tracked)._valueTracker
  if (tracker) tracker.setValue(previous === value ? `${previous} ` : previous)
  dispatchValueEvents(el)
}

export function setSelectValue(el: HTMLSelectElement, value: string): void {
  const descriptor = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')
  if (descriptor?.set) descriptor.set.call(el, value)
  else el.value = value
  dispatchValueEvents(el)
}

export function formatForControl(value: string, inputType: string): string | null {
  if (inputType === 'month') return toMonth(value)
  if (inputType === 'date') return toDate(value)
  if (inputType === 'number') {
    const money = parseMoney(value)
    if (money != null && /k|\$|,/i.test(value)) return String(money)
    const digits = value.replace(/[^0-9.]/g, '')
    return digits || null
  }
  return value
}

export function fillControl(field: DetectedField, value: ProposedValue): FillResult {
  if (Array.isArray(value) && field.control.kind !== 'text' && field.control.kind !== 'textarea') {
    return { ok: false, status: 'skipped', message: 'Multi-value answers require a supported widget.' }
  }
  return withSyntheticFill(() => fillControlInner(field, Array.isArray(value) ? value.join(', ') : value))
}

function fillControlInner(field: DetectedField, value: string): FillResult {
  const { control } = field
  if (control.kind === 'file' || control.kind === 'custom' || control.kind === 'combobox' || control.kind === 'skills-checkboxes') {
    return { ok: false, status: 'skipped', message: 'This control is left for you to complete.' }
  }
  if (control.kind === 'select') {
    const select = control.elements[0]
    if (!(select instanceof HTMLSelectElement)) return { ok: false, status: 'failed', message: 'Missing select element.' }
    const options = Array.from(select.options).map((option) => ({ value: option.value, label: option.textContent || '' }))
    const candidates = dateCandidatesForControl(field, value) ?? [value]
    const matched = candidates.map((candidate) => matchChoice(options, candidate, field.canonical)).find((item) => item != null) ?? null
    if (matched == null) return { ok: false, status: 'failed', message: 'No option matched the saved answer.' }
    setSelectValue(select, matched)
    return { ok: true, status: 'filled' }
  }
  if (control.kind === 'radio') {
    const radios = control.elements.filter((el): el is HTMLInputElement => el instanceof HTMLInputElement)
    const options: Array<Choice & { el: HTMLInputElement }> = radios.map((radio) => ({
      value: radio.value,
      label: labelForControl(radio) || radio.value,
      el: radio,
    }))
    const matched = matchChoice(options, value, field.canonical)
    const target = options.find((option) => option.value === matched)
    if (!target) return { ok: false, status: 'failed', message: 'No option matched the saved answer.' }
    if (!target.el.checked) {
      target.el.click()
      if (!target.el.checked) {
        target.el.checked = true
        target.el.dispatchEvent(new Event('input', { bubbles: true }))
        target.el.dispatchEvent(new Event('change', { bubbles: true }))
      }
    }
    return { ok: true, status: 'filled' }
  }
  if (control.kind === 'checkbox') {
    const box = control.elements[0]
    if (!(box instanceof HTMLInputElement)) return { ok: false, status: 'failed', message: 'Missing checkbox.' }
    const should = checkboxShouldBeChecked(field.label, value)
    if (box.checked !== should) {
      box.click()
      if (box.checked !== should) {
        box.checked = should
        box.dispatchEvent(new Event('input', { bubbles: true }))
        box.dispatchEvent(new Event('change', { bubbles: true }))
      }
    }
    return { ok: true, status: 'filled' }
  }
  const el = control.elements[0]
  if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) {
    return { ok: false, status: 'failed', message: 'Missing text field.' }
  }
  const dateCandidates = dateCandidatesForControl(field, value)
  const formatted = dateCandidates == null ? formatForControl(value, control.inputType) : dateCandidates[0] ?? null
  if (formatted == null) return { ok: false, status: 'failed', message: 'Saved value does not fit this field.' }
  setNativeValue(el, formatted)
  return { ok: true, status: 'filled' }
}

export function readControl(field: DetectedField): string {
  if (field.control.kind === 'checkbox') {
    const box = field.control.elements[0]
    return box instanceof HTMLInputElement && box.checked ? 'yes' : 'no'
  }
  if (field.control.kind === 'radio') {
    const checked = field.control.elements.find((el): el is HTMLInputElement => el instanceof HTMLInputElement && el.checked)
    return checked?.value ?? ''
  }
  const el = field.control.elements[0]
  if (field.control.kind === 'combobox' && el) {
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) return el.value
    return el.getAttribute('data-value') || el.getAttribute('aria-valuetext') || el.textContent?.trim() || ''
  }
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) return el.value
  return ''
}

export function isControlEmpty(field: DetectedField): boolean {
  // Skills checkboxes are additive; preselected options do not block new matches.
  if (field.control.skillsWidget) return true
  const el = field.control.elements[0]
  if (field.control.kind === 'select' && el instanceof HTMLSelectElement) {
    if (!el.value) return true
    const option = el.selectedOptions[0]
    if (!option) return true
    if (option.disabled) return true
    const label = (option.textContent || '').trim().toLowerCase()
    if (el.selectedIndex === 0 && /^(select|please select|choose|choose one|--|—)$/.test(label)) return true
    return false
  }
  if (field.control.kind === 'radio') {
    return !field.control.elements.some((item) => item instanceof HTMLInputElement && item.checked)
  }
  if (field.control.kind === 'checkbox') {
    return !(el instanceof HTMLInputElement && el.checked)
  }
  if (field.control.kind === 'combobox') {
    if (field.control.multiValue) {
      const editor = field.control.elements.find(
        (item): item is HTMLInputElement | HTMLTextAreaElement =>
          item instanceof HTMLInputElement || item instanceof HTMLTextAreaElement,
      )
      return editor ? editor.value.trim() === '' : true
    }
    return readControl(field).trim() === ''
  }
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) return el.value.trim() === ''
  return true
}

export function restoreControl(field: DetectedField, previous: string): void {
  withSyntheticFill(() => {
    if (field.control.kind === 'radio') {
      for (const radio of field.control.elements) {
        if (!(radio instanceof HTMLInputElement)) continue
        const should = previous !== '' && radio.value === previous
        if (radio.checked === should) continue
        if (should) radio.click()
        else {
          radio.checked = false
          radio.dispatchEvent(new Event('change', { bubbles: true }))
        }
      }
      return
    }
    if (field.control.kind === 'checkbox') {
      const box = field.control.elements[0]
      if (!(box instanceof HTMLInputElement)) return
      const should = previous === 'yes'
      if (box.checked !== should) {
        box.click()
        if (box.checked !== should) box.checked = should
      }
      return
    }
    if (field.control.kind === 'select') {
      const select = field.control.elements[0]
      if (select instanceof HTMLSelectElement) setSelectValue(select, previous)
      return
    }
    const el = field.control.elements[0]
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) setNativeValue(el, previous)
  })
}
