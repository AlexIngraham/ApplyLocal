import type { ATSAdapter, DetectedField, FillResult, ProposedValue } from '@/adapters/types'
import { fillControl, formatForControl } from '@/content/filler'
import { fillSkillsWidget } from '@/content/skills/fill'
import { scanControls } from '@/content/scanControls'
import { dateCandidatesForControl } from '@/content/dateFormat'
import { isAshbyUrl } from '@/platform/detect'
import { ariaText, labelForControl } from '@/utils/dom'
import { workdayVisible } from '@/adapters/workdaySections'

export const ashbyAdapter: ATSAdapter = {
  id: 'ashby',
  label: 'Ashby',
  matches: isAshbyUrl,
  detectDom(root) {
    // Ashby's public customization marker, not a generated CSS class.
    return Boolean(root.querySelector('.ashby-application-form-container'))
  },
  scan(root, ctx) { return scanControls(root, ctx, this.id) },
  fill(field, value) {
    if (field.control.kind === 'text' || field.control.kind === 'textarea') return fillText(field, value)
    if (field.canonical === 'skills') return fillSkillsWidget(field, value)
    return fillControl(field, value)
  },
}

async function fillText(field: DetectedField, value: ProposedValue): Promise<FillResult> {
  const original = field.control.elements[0] as HTMLInputElement | HTMLTextAreaElement
  const resolve = textLocator(original)
  const text = Array.isArray(value) ? value.join(', ') : value
  const dates = dateCandidatesForControl(field, text)
  const expected = dates == null ? formatForControl(text, field.control.inputType) : dates[0] ?? null
  const result = field.canonical === 'skills' ? await fillSkillsWidget(field, value) : fillControl(field, value)
  if (!result.ok) return result
  // Let event-driven React updates run before checking the live control. This
  // is a single verification pass, never a clear/retype or repeated fill.
  await afterRender(original.ownerDocument)
  if (field.status === 'manual') return { ok: false, status: 'skipped', message: 'You edited this field, so filling stopped.' }
  const current = resolve()
  if (!current || current.value !== expected) {
    return { ok: false, status: 'failed', message: 'The page did not retain this value. Enter it manually.' }
  }
  field.control.elements = [current]
  const errorIds = (current.getAttribute('aria-errormessage') || '').split(/\s+/).filter(Boolean)
  const hasError = errorIds.some(id => {
    const error = current.ownerDocument.getElementById(id)
    return error && workdayVisible(error) && Boolean(error.textContent?.trim())
  })
  if (current.getAttribute('aria-invalid') === 'true' || !current.validity.valid || (hasError && current.getAttribute('aria-invalid') !== 'false')) {
    return { ok: true, status: 'filled', needsReview: true, message: 'The page still reports this field as invalid. Review its value.' }
  }
  return result
}

function textLocator(original: HTMLInputElement | HTMLTextAreaElement): () => HTMLInputElement | HTMLTextAreaElement | null {
  const scope = original.closest('.ashby-application-form-container') ?? original.form ?? original.getRootNode() as ParentNode
  const id = original.id
  const name = original.name
  const label = ariaText(original) || labelForControl(original)
  return () => {
    if (original.isConnected && workdayVisible(original)) return original
    const candidates = Array.from(scope.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input, textarea'))
      .filter(el => el.localName === original.localName && el.type === original.type && workdayVisible(el))
    // Require a unique semantic match inside the original form; ambiguous or
    // removed controls fail verification instead of selecting a different form.
    const matches = candidates.filter(el => id ? el.id === id : name ? el.name === name : label && (ariaText(el) || labelForControl(el)) === label)
    return matches.length === 1 ? matches[0]! : null
  }
}

function afterRender(doc: Document): Promise<void> {
  const win = doc.defaultView
  return new Promise(resolve => {
    let frame: number | undefined
    const finish = () => {
      clearTimeout(timeout)
      if (frame !== undefined) win?.cancelAnimationFrame(frame)
      resolve()
    }
    // rAF can pause in a background tab. Bound the check there as well.
    const timeout = setTimeout(finish, 100)
    if (win?.requestAnimationFrame) frame = win.requestAnimationFrame(finish)
  })
}
