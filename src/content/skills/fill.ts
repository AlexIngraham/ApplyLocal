import type { DetectedField, FillOutcome, FillResult, ProposedValue, SkillsFillDetails } from '@/adapters/types'
import { fillControl, setNativeValue } from '@/content/filler'
import { workdayVisible } from '@/adapters/workdaySections'
import { isDisabledControl } from '@/utils/dom'
import { isSyntheticFill, withSyntheticFill } from '@/utils/events'
import { skillCheckboxes, skillCheckboxLabel, skillSearch } from './dom'
import { indexSkills, matchSkill, uniqueSkills } from './matching'

import { yieldSkillsDom as yieldDom, waitForSkillsCondition as waitUntil } from './scheduling'

/** Arrays reach a widget strategy intact. Only text controls serialize them. */
export function fillSkillsWidget(
  field: DetectedField,
  value: ProposedValue,
  combobox?: (field: DetectedField, values: string[]) => FillOutcome,
): FillOutcome {
  const skills = Array.isArray(value) ? value : [value]
  if (field.control.skillsWidget) return fillCheckboxSkills(field, skills)
  if (field.control.kind === 'combobox' && field.control.multiValue && combobox) return combobox(field, skills)
  if (field.control.inputType === 'search' || /\b(search|filter)\b/i.test(field.label)) {
    return { ok: false, status: 'skipped', message: 'This skills search has no recognized selection widget yet.' }
  }
  if (field.control.kind === 'text' || field.control.kind === 'textarea') return fillControl(field, skills.join(', '))
  return { ok: false, status: 'skipped', message: 'This skills widget needs manual selection.' }
}

async function fillCheckboxSkills(field: DetectedField, values: string[]): Promise<FillResult> {
  const skills = uniqueSkills(values)
  const details: SkillsFillDetails = { requested: skills.length, filled: [], alreadySelected: [], unavailable: [], ambiguous: [], failed: [] }
  const widget = field.control.skillsWidget!
  const doc = field.control.elements[0]!.ownerDocument
  let root: HTMLElement | null = null
  let dirty = true
  let index = indexSkills<HTMLElement>([], skillCheckboxLabel)
  let searchBefore: string | undefined
  let searchWritten: string | undefined
  const observer = new MutationObserver(() => { dirty = true })
  const cancelled = () => field.status === 'manual'
  const checked = (box: HTMLElement) => box instanceof HTMLInputElement ? box.checked : box.getAttribute('aria-checked') === 'true'

  function currentRoot(): HTMLElement | null {
    const next = widget.resolve()
    if (next !== root) {
      observer.disconnect()
      root = next
      dirty = true
      if (root) observer.observe(root, { subtree: true, childList: true, characterData: true, attributes: true })
    }
    if (root) field.control.elements = [root]
    return root
  }
  function lookup(desired: string): HTMLElement[] {
    const current = currentRoot()
    if (!current || current.getAttribute('aria-busy') === 'true' || current.querySelector('[aria-busy="true"]')) return []
    if (observer.takeRecords().length) dirty = true
    if (dirty) {
      index = indexSkills(skillCheckboxes(current), skillCheckboxLabel)
      dirty = false
    }
    // Style/layout checks are only needed for candidate matches, not every option.
    return matchSkill(index, desired).filter(workdayVisible)
  }
  function onEdit(event: Event) {
    if (isSyntheticFill()) return
    const target = event.target
    if (event.type === 'click' && (!(target instanceof Element) || !target.closest('input[type="checkbox"], [role="checkbox"]'))) return
    if (target instanceof Node && currentRoot()?.contains(target)) {
      field.status = 'manual'
      field.locked = true
      field.planReason = 'You edited skills, so selection stopped.'
    }
  }
  doc.addEventListener('input', onEdit, true)
  doc.addEventListener('change', onEdit, true)
  doc.addEventListener('click', onEdit, true)
  try {
    currentRoot()
    for (let position = 0; position < skills.length; position += 1) {
      const desired = skills[position]!
      if (cancelled() || !currentRoot()) { details.failed.push(...skills.slice(position)); break }
      if (widget.kind === 'searchable-checkbox-list') {
        const current = currentRoot()
        const search = current && skillSearch(current)
        if (!search) { details.failed.push(...skills.slice(position)); break }
        searchBefore ??= search.value
        // Existing user search text is protected just like other occupied editors.
        if (searchBefore.trim() && searchWritten === undefined) { details.failed.push(...skills.slice(position)); break }
        searchWritten = desired
        withSyntheticFill(() => setNativeValue(search, desired))
        await yieldDom()
        await waitUntil(() => cancelled() || lookup(desired).length > 0)
      }
      if (cancelled()) { details.failed.push(...skills.slice(position)); break }
      const matches = lookup(desired)
      if (matches.length > 1) { details.ambiguous.push(desired); continue }
      const box = matches[0]
      if (!box) { details.unavailable.push(desired); continue }
      if (checked(box)) { details.alreadySelected.push(desired); continue }
      if (isDisabledControl(box) || box.matches(':disabled') || box.closest('[inert], [aria-disabled="true"]')) {
        details.failed.push(desired); continue
      }
      withSyntheticFill(() => box.click())
      await yieldDom()
      const confirmed = await waitUntil(() => {
        if (cancelled()) return true
        const fresh = lookup(desired)
        return fresh.length === 1 && checked(fresh[0]!)
      })
      if (cancelled()) { details.failed.push(...skills.slice(position)); break }
      if (confirmed) details.filled.push(desired)
      else details.failed.push(desired)
    }
  } catch {
    const accounted = new Set([...details.filled, ...details.alreadySelected, ...details.unavailable, ...details.ambiguous, ...details.failed])
    details.failed.push(...skills.filter((skill) => !accounted.has(skill)))
  } finally {
    // Do not clear a search the user changed while the transaction was waiting.
    try {
      const current = currentRoot()
      const search = current && skillSearch(current)
      if (!cancelled() && searchWritten !== undefined && search?.value === searchWritten) {
        withSyntheticFill(() => setNativeValue(search, searchBefore ?? ''))
      }
    } finally {
      observer.disconnect()
      doc.removeEventListener('input', onEdit, true)
      doc.removeEventListener('change', onEdit, true)
      doc.removeEventListener('click', onEdit, true)
    }
  }
  const matched = details.filled.length + details.alreadySelected.length
  return {
    ok: matched > 0,
    status: matched > 0 ? 'filled' : 'failed',
    requested: details.requested,
    filled: details.filled.length,
    skipped: details.requested - details.filled.length,
    needsReview: matched < details.requested,
    message: `${matched} / ${details.requested} saved skills matched (${details.filled.length} added, ${details.alreadySelected.length} already selected).`,
    skills: details,
  }
}
