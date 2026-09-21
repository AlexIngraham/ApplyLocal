import type { CanonicalField } from '@/classifier/types'
import type { TextSignal } from '@/classifier/types'
import { classify } from '@/classifier/classify'
import { decideFieldPlan } from '@/classifier/confidence'
import type { ControlKind } from '@/classifier/confidence'
import { EDUCATION_FIELDS, EMPLOYMENT_FIELDS } from '@/profile/types'
import { proposedValue, sensitiveBlocked } from '@/profile/resolve'
import type { AdapterHint, DetectedField, RepeatedSectionContext, ScanContext } from '@/adapters/types'
import { normalize } from '@/classifier/normalize'
import {
  ariaText,
  cleanText,
  collectElements,
  cssEscape,
  describedBy,
  detectSection,
  groupQuestion,
  inIgnoredRegion,
  isDisabledControl,
  labelForControl,
  looksLikeHoneypot,
  previousPrompt,
} from '@/utils/dom'

const REPEATING = new Set<CanonicalField>([...EDUCATION_FIELDS, ...EMPLOYMENT_FIELDS])

function useful(text: string): string {
  const normalized = normalize(text)
  if (!normalized || normalized === 'yes' || normalized === 'no' || normalized === 'true' || normalized === 'false') return ''
  return cleanText(text)
}

function controlKind(el: Element, adapterId: string): { kind: ControlKind; inputType: string } | null {
  if (inIgnoredRegion(el)) return null
  if (el.getAttribute('role') === 'combobox') {
    return adapterId === 'workday'
      ? { kind: 'combobox', inputType: 'combobox' }
      : { kind: 'custom', inputType: 'custom' }
  }
  if (el instanceof HTMLTextAreaElement) return { kind: 'textarea', inputType: 'textarea' }
  if (el instanceof HTMLSelectElement) return { kind: 'select', inputType: 'select' }
  if (el instanceof HTMLInputElement) {
    const type = (el.getAttribute('type') || 'text').toLowerCase()
    if (['hidden', 'password', 'submit', 'button', 'reset', 'image'].includes(type)) return null
    if (type === 'search' && !el.closest('form')) return null
    if (type === 'file') return { kind: 'file', inputType: 'file' }
    if (type === 'radio') return { kind: 'radio', inputType: 'radio' }
    if (type === 'checkbox') return { kind: 'checkbox', inputType: 'checkbox' }
    return { kind: 'text', inputType: type }
  }
  return null
}

function radiosInGroup(radio: HTMLInputElement): HTMLInputElement[] {
  if (!radio.name) return [radio]
  const scope: ParentNode = radio.form ?? radio.ownerDocument
  const found = scope.querySelectorAll(`input[type="radio"][name="${cssEscape(radio.name)}"]`)
  const radios = Array.from(found).filter((el): el is HTMLInputElement => el instanceof HTMLInputElement)
  return radios.length ? radios : [radio]
}

function optionTexts(elements: HTMLElement[], kind: ControlKind): string[] {
  if (kind === 'select') {
    const select = elements[0]
    if (!(select instanceof HTMLSelectElement)) return []
    return Array.from(select.options)
      .map((option) => cleanText(option.textContent || option.value))
      .filter(Boolean)
  }
  if (kind === 'radio' || kind === 'checkbox') return elements.map((el) => labelForControl(el)).filter(Boolean)
  return []
}

function signalsFor(elements: HTMLElement[], kind: ControlKind): { signals: TextSignal[]; label: string } {
  const el = elements[0]
  if (!el) return { signals: [], label: '' }
  const signals: TextSignal[] = []
  const name = el.getAttribute('name')
  const id = el.getAttribute('id')
  const placeholder = el.getAttribute('placeholder')
  const autocomplete = el.getAttribute('autocomplete')
  const automationId = el.getAttribute('data-automation-id')
  if (name) signals.push({ source: 'name', text: name })
  if (id) signals.push({ source: 'id', text: id })
  if (placeholder) signals.push({ source: 'placeholder', text: placeholder })
  if (autocomplete) signals.push({ source: 'autocomplete', text: autocomplete })
  if (automationId) signals.push({ source: 'id', text: automationId })
  const aria = ariaText(el)
  if (aria) signals.push({ source: 'aria', text: aria })

  const label = useful(labelForControl(el))
  const question = useful(groupQuestion(el))
  if (kind === 'radio') {
    const prompt = question || label
    if (prompt) signals.push({ source: 'legend', text: prompt })
  } else {
    if (label) signals.push({ source: 'label', text: label })
    if (question && normalize(question) !== normalize(label)) signals.push({ source: 'legend', text: question })
    if (!label && !aria && !question) {
      const previous = previousPrompt(el)
      if (previous) signals.push({ source: 'label', text: previous })
    }
  }
  const described = describedBy(el)
  if (described) signals.push({ source: 'nearby', text: described })
  const options = optionTexts(elements, kind)
  if (options.length) signals.push({ source: 'options', text: options.join(' | ') })
  const display = cleanText(question || label || placeholder || aria || name || id || '').slice(0, 180)
  return { signals, label: display }
}

export function scanControls(
  root: ParentNode,
  ctx: ScanContext,
  adapterId: string,
  hintFor?: (el: Element) => AdapterHint | null,
  repeatedSectionFor?: (el: HTMLElement) => RepeatedSectionContext | null,
): DetectedField[] {
  const seenRadios = new Set<HTMLInputElement>()
  const seenControls = new Set<HTMLElement>()
  const repeats = new Map<CanonicalField, number>()
  const fields: DetectedField[] = []
  let seq = 0

  for (const el of collectElements(root)) {
    if (el instanceof HTMLElement && seenControls.has(el)) continue
    const kind = controlKind(el, adapterId)
    if (!kind || !(el instanceof HTMLElement)) continue
    if (kind.kind === 'combobox') {
      const nested = Array.from(el.querySelectorAll('input:not([type="hidden"]), textarea')).filter(
        (item): item is HTMLElement => item instanceof HTMLElement,
      )
      nested.forEach((item) => seenControls.add(item))
      const field = buildField([el, ...nested], kind.kind, kind.inputType)
      if (field) fields.push(field)
      continue
    }
    if (el instanceof HTMLInputElement && kind.kind === 'radio') {
      if (seenRadios.has(el)) continue
      const group = radiosInGroup(el)
      group.forEach((radio) => seenRadios.add(radio))
      const field = buildField(group, kind.kind, kind.inputType)
      if (field) fields.push(field)
      continue
    }
    if (el instanceof HTMLInputElement && el.type === 'radio') continue
    const field = buildField([el], kind.kind, kind.inputType)
    if (field) fields.push(field)
  }

  return fields

  function buildField(elements: HTMLElement[], kind: ControlKind, inputType: string): DetectedField | null {
    const primary = elements[0]
    if (!primary) return null
    const extracted = signalsFor(elements, kind)
    if (looksLikeHoneypot(primary, extracted.label)) return null
    const section = detectSection(primary)
    const classification = classify({
      signals: extracted.signals,
      controlType: inputType,
      section,
      adapterHint: hintFor?.(primary) ?? null,
    })
    const detectedSection = REPEATING.has(classification.key) ? repeatedSectionFor?.(primary) ?? null : null
    const repeatedSection = sectionMatchesField(detectedSection, classification.key) ? detectedSection ?? undefined : undefined
    const repeatIndex = repeatedSection?.sectionIndex ?? (REPEATING.has(classification.key) ? nextRepeat(classification.key) : 0)
    const value = proposedValue(ctx.profile, ctx.settings, classification.key, repeatIndex, repeatedSection)
    const decision = decideFieldPlan({
      key: classification.key,
      confidence: classification.confidence,
      hasValue: value != null,
      sensitiveBlocked: sensitiveBlocked(ctx.profile, ctx.settings, classification.key),
      typeDisabled: ctx.settings.disabledFields.includes(classification.key),
      controlKind: kind,
      disabledControl: elements.some((element) => isDisabledControl(element)),
      settings: ctx.settings,
    })
    seq += 1
    return {
      id: `f${seq}`,
      adapterId,
      canonical: classification.key,
      confidence: classification.confidence,
      reason: classification.reason,
      proposedValue: value,
      plan: decision.plan,
      fillBand: decision.fillBand,
      planReason: decision.planReason,
      label: extracted.label || classification.key,
      repeatIndex,
      repeatedSection,
      status: decision.plan === 'review' ? 'suggested' : decision.plan === 'skip' ? 'skipped' : 'untouched',
      sensitive: classification.sensitive,
      locked: false,
      control: { elements, kind, inputType },
      previousValue: null,
    }
  }

  function sectionMatchesField(section: RepeatedSectionContext | null, key: CanonicalField): boolean {
    if (!section) return false
    if (section.kind === 'education') return EDUCATION_FIELDS.includes(key as (typeof EDUCATION_FIELDS)[number])
    return EMPLOYMENT_FIELDS.includes(key as (typeof EMPLOYMENT_FIELDS)[number])
  }

  function nextRepeat(key: CanonicalField): number {
    const current = repeats.get(key) ?? 0
    repeats.set(key, current + 1)
    return current
  }
}
