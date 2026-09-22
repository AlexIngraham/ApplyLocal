import type { ControlHandle } from '@/adapters/types'
import { normalize } from '@/classifier/normalize'
import { workdayVisible } from '@/adapters/workdaySections'
import { ariaText, cleanText, cssEscape, inIgnoredRegion } from '@/utils/dom'

export const SKILL_CHECKBOX_SELECTOR = 'input[type="checkbox"], [role="checkbox"]'
const CONTAINERS = 'fieldset, [role="group"], [role="region"], section, div, article, ul'
const SKILL_WORDS = /\b(skills?|technologies|competencies)\b/
const NOT_SKILL = /\b(agree|consent|terms|relocat|veteran|disability|gender|race|ethnicity|yes|no)\b/i

export function skillCheckboxLabel(el: HTMLElement): string {
  const accessible = ariaText(el)
  if (accessible) return accessible
  if (el instanceof HTMLInputElement && el.labels?.length) {
    return cleanText(Array.from(el.labels).map((label) => label.textContent).join(' '))
  }
  if (el.getAttribute('role') === 'checkbox' && cleanText(el.textContent)) return cleanText(el.textContent)
  const row = el.closest('label') ?? el.parentElement
  // Only use nearby text when it belongs to one option, never the whole selector.
  if (row && row.querySelectorAll(SKILL_CHECKBOX_SELECTOR).length === 1) return cleanText(row.textContent)
  return ''
}

function regionLabel(el: HTMLElement): string {
  const accessible = ariaText(el)
  if (accessible) return accessible
  const heading = Array.from(el.children).find((child) => child.matches('legend, h1, h2, h3, h4, h5, h6, [role="heading"], label') && !child.querySelector(SKILL_CHECKBOX_SELECTOR))
  if (heading) return cleanText(heading.textContent)
  const automation = normalize(el.getAttribute('data-automation-id') ?? '')
  // Option/chip markers describe individual rows, not the logical skills region.
  return /\b(option|checkbox|chip|pill|input|selected)\b/.test(automation) ? '' : automation
}

function owner(el: HTMLElement, labels: Map<HTMLElement, string>): HTMLElement | null {
  let parent = el.parentElement
  while (parent && !parent.matches('body, form, main')) {
    if (parent.matches(CONTAINERS)) {
      let label = labels.get(parent)
      if (label === undefined) { label = regionLabel(parent); labels.set(parent, label) }
      if (SKILL_WORDS.test(normalize(label))) return parent
      // A separate named question inside a larger skills section is not an option.
      if (label && parent.matches('fieldset, [role="group"], [role="region"]')) return null
    }
    parent = parent.parentElement
  }
  return null
}

export function skillCheckboxes(root: HTMLElement): HTMLElement[] {
  const labels = new Map<HTMLElement, string>()
  return Array.from(root.querySelectorAll<HTMLElement>(SKILL_CHECKBOX_SELECTOR)).filter((el) => {
    if (el.querySelector(SKILL_CHECKBOX_SELECTOR) || owner(el, labels) !== root) return false
    const label = skillCheckboxLabel(el)
    return Boolean(label) && !NOT_SKILL.test(label)
  })
}

export function skillSearch(root: HTMLElement): HTMLInputElement | null {
  const inputs = Array.from(root.querySelectorAll<HTMLInputElement>('input:not([type="hidden"]):not([type="checkbox"])'))
  const candidates = inputs.filter((el) => (el.type === 'search' || /\b(search|filter)\b/i.test(`${ariaText(el)} ${el.placeholder}`)) && !el.disabled && !el.readOnly)
  return candidates.length === 1 ? candidates[0]! : null
}

export interface CheckboxSkillGroup {
  root: HTMLElement
  label: string
  controls: HTMLElement[]
  widget: NonNullable<ControlHandle['skillsWidget']>
}

/** Called once per scan; ancestor labels are cached across hundreds of options. */
export function detectCheckboxSkillGroups(elements: Element[]): CheckboxSkillGroup[] {
  const labels = new Map<HTMLElement, string>()
  const roots = new Set<HTMLElement>()
  for (const el of elements) {
    if (!(el instanceof HTMLElement) || !el.matches(SKILL_CHECKBOX_SELECTOR) || inIgnoredRegion(el)) continue
    const root = owner(el, labels)
    if (root) roots.add(root)
  }
  const groups: CheckboxSkillGroup[] = []
  for (const root of roots) {
    if (!workdayVisible(root)) continue
    const controls = skillCheckboxes(root)
    if (!controls.length) continue
    const search = skillSearch(root)
    const label = regionLabel(root)
    const scope = root.getRootNode() as Document | ShadowRoot
    const id = root.id
    const automation = root.getAttribute('data-automation-id')
    let resolvedRoot = root
    const resolve = () => {
      if (resolvedRoot.isConnected && workdayVisible(resolvedRoot) && regionLabel(resolvedRoot) === label) return resolvedRoot
      const selectors = [id ? `#${cssEscape(id)}` : '', automation ? `[data-automation-id="${cssEscape(automation)}"]` : ''].filter(Boolean)
      for (const selector of selectors) {
        const matches = Array.from(scope.querySelectorAll<HTMLElement>(selector)).filter((el) => workdayVisible(el) && regionLabel(el) === label)
        if (matches.length === 1) return (resolvedRoot = matches[0]!)
      }
      const matches = Array.from(scope.querySelectorAll<HTMLElement>(CONTAINERS)).filter((el) => workdayVisible(el) && regionLabel(el) === label)
      return matches.length === 1 ? (resolvedRoot = matches[0]!) : null
    }
    groups.push({ root, label, controls: search ? [...controls, search] : controls,
      widget: { kind: search ? 'searchable-checkbox-list' : 'checkbox-list', resolve } })
  }
  return groups
}
