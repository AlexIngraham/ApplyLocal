import type { RepeatedSectionMatch } from '@/adapters/types'
import { normalize } from '@/classifier/normalize'
import { ariaText, labelForControl } from '@/utils/dom'
import { isSyntheticFill } from '@/utils/events'

type Kind = RepeatedSectionMatch['kind']
const controls = 'input:not([type="hidden"]), select, textarea, [role="combobox"]'
const headings = 'h1, h2, h3, h4, h5, h6, legend, [role="heading"]'

export function workdayVisible(el: Element): boolean {
  if (!el.isConnected || el.closest('[hidden], [aria-hidden="true"], [inert]')) return false
  for (let node: Element | null = el; node; node = node.parentElement) {
    const style = node.ownerDocument.defaultView?.getComputedStyle(node)
    if (style?.display === 'none' || style?.visibility === 'hidden') return false
  }
  return true
}

function heading(el: Element): string {
  // A heading may have a presentation wrapper, but must belong to this card.
  return Array.from(el.querySelectorAll(headings)).find((h) => {
    for (let parent = h.parentElement; parent && parent !== el; parent = parent.parentElement) {
      if (parent.matches('article, fieldset, section, [role="group"], [role="region"]')) return false
    }
    return true
  })?.textContent ?? ''
}
function marker(el: Element): string {
  return normalize(`${el.getAttribute('data-automation-id') ?? ''} ${ariaText(el)} ${heading(el)}`)
}
function kindOf(text: string): Kind | null {
  if (/\b(work experience|experience|employment|job history|professional history)\b/.test(text)) return 'employment'
  if (/\b(education|academic history)\b/.test(text)) return 'education'
  return null
}
function ownKind(el: Element): Kind | null {
  return kindOf(marker(el))
}
function cluster(el: Element, kind: Kind): boolean {
  const labels = Array.from(el.querySelectorAll(controls)).map((control) =>
    normalize(`${control.getAttribute('data-automation-id') ?? ''} ${ariaText(control)} ${labelForControl(control)}`),
  )
  const patterns = kind === 'employment'
    ? [/\bcompany|employer\b/, /\bjob title|position title\b/, /\blocation\b/, /\bfrom|start|to|end\b/]
    : [/\bschool|institution\b/, /\bdegree\b/, /\bmajor|field of study\b/, /\bfrom|start|to|end\b/]
  return patterns.filter((pattern) => labels.some((label) => pattern.test(label))).length >= 2
}

interface Session {
  indices: Map<string, number>
  active: Partial<Record<Kind, number>>
  pending?: { kind: Kind; index: number; control: Element | null; hadValue: boolean }
}
const sessions = new WeakMap<Document, Session>()
function session(doc: Document): Session {
  let state = sessions.get(doc)
  if (!state) { state = { indices: new Map(), active: {} }; sessions.set(doc, state) }
  return state
}
export function resetWorkdaySections(doc: Document): void { sessions.delete(doc) }
function hasValue(container: Element): boolean {
  return Array.from(container.querySelectorAll('input:not([type="checkbox"]):not([type="radio"]):not([type="hidden"]), textarea'))
    .some((el) => workdayVisible(el) && Boolean((el as HTMLInputElement).value.trim()))
}

/** Observe the user's Add action; never click it. Advance only after a blank editor appears. */
export function watchWorkdaySections(doc: Document): () => void {
  const onClick = (event: Event) => {
    if (isSyntheticFill() || !(event.target instanceof Element)) return
    const button = event.target.closest('button, [role="button"]')
    if (!button || !/^(add|add another|add (another )?(work experience|experience|employment|education))$/.test(normalize(ariaText(button) || button.textContent || ''))) return
    let scope = button.parentElement
    while (scope && !ownKind(scope)) scope = scope.parentElement
    if (!scope) return
    const kind = ownKind(scope)
    const matches = getWorkdaySections(doc).filter((entry) => entry.kind === kind && scope?.contains(entry.container))
    const active = matches.filter((entry) => Array.from(entry.container.querySelectorAll(controls)).some(workdayVisible)).at(-1)
    if (!active) return
    const state = session(doc)
    state.pending = { kind: active.kind, index: active.sectionIndex + 1,
      control: active.container.querySelector(controls), hadValue: hasValue(active.container) }
  }
  doc.addEventListener('click', onClick, true)
  return () => doc.removeEventListener('click', onClick, true)
}

/** Build once per scan. No generated classes/IDs, random keys, or fixed ancestor depth. */
export function getWorkdaySections(doc: Document): RepeatedSectionMatch[] {
  const state = session(doc)
  const candidates = new Map<HTMLElement, { kind: Kind; confidence: number }>()
  const elements = Array.from(doc.querySelectorAll<HTMLElement>(
    '[data-automation-id], section, article, fieldset, [role="group"], [role="region"], div',
  )).filter((el) => !el.closest('#applylocal-root'))
  for (const el of elements) {
    const automation = normalize(el.getAttribute('data-automation-id') ?? '')
    const text = marker(el)
    const kind = ownKind(el)
    const entry = /\b(card|entry|item|record|panel|detail|editor|summary)\b|\b\d+\b/.test(text)
    if (kind && ((entry && (el.querySelector(controls) || automation || el.matches('article, fieldset, [role="group"]'))) || /^(work experience|employment|education)$/.test(automation))) {
      candidates.set(el, { kind, confidence: automation ? 0.98 : 0.94 })
      continue
    }
    // Weak markers: require multiple distinct editable field roles under a known section.
    let ancestor: Element | null = el
    let context: Kind | null = null
    while (ancestor && ancestor.tagName !== 'BODY') {
      context = ownKind(ancestor)
      if (context) break
      ancestor = ancestor.parentElement
    }
    if (context && cluster(el, context)) {
      const peers = Array.from(el.parentElement?.children ?? []).filter((peer) => cluster(peer, context!))
      candidates.set(el, { kind: context, confidence: peers.length > 1 ? 0.9 : 0.85 })
    }
  }
  // A weak subcluster must not split a stronger enclosing card boundary.
  for (const [el, evidence] of candidates) {
    if (evidence.confidence >= 0.9) continue
    if ([...candidates].some(([parent, other]) => parent !== el && parent.contains(el) && other.kind === evidence.kind && other.confidence >= 0.9)) candidates.delete(el)
  }
  const leaves = [...candidates.keys()].filter((el) =>
    ![...candidates.keys()].some((other) => other !== el && el.contains(other) && candidates.get(other)?.kind === candidates.get(el)?.kind),
  )
  const result: RepeatedSectionMatch[] = []
  for (const kind of ['employment', 'education'] as const) {
    const peers = leaves.filter((el) => candidates.get(el)?.kind === kind && workdayVisible(el))
    const editable = peers.filter((el) => Array.from(el.querySelectorAll(controls)).some(workdayVisible))
    for (const [position, container] of peers.entries()) {
      // Editors nested inside a collapsed card inherit the card's logical identity.
      let numbered: RegExpMatchArray | null = null
      let instance: string | null = null
      for (let ancestor: HTMLElement | null = container; ancestor && ancestor.tagName !== 'BODY'; ancestor = ancestor.parentElement) {
        const text = normalize(`${ariaText(ancestor)} ${heading(ancestor)}`)
        if (ownKind(ancestor) !== kind) continue
        numbered ??= text.match(/\b(?:work experience|experience|employment|education)\s*(\d+)\b/)
        instance ??= ancestor.getAttribute('data-instance-id')
        if (numbered || instance) break
      }
      const instanceKey = instance ? `${kind}:instance:${instance}` : null
      let index = numbered ? Math.max(0, Number(numbered[1]) - 1) : position
      if (!numbered && instanceKey && state.indices.has(instanceKey)) index = state.indices.get(instanceKey)!
      if (!numbered && editable.length === 1 && editable[0] === container) {
        const associated = peers.findIndex((peer) => peer !== container && Array.from(peer.querySelectorAll('[aria-controls]'))
          .some((button) => button.getAttribute('aria-controls')?.split(/\s+/).includes(container.id)))
        if (associated >= 0) index = associated
        else if (!instanceKey) index = Math.max(position, state.active[kind] ?? 0)
        const pending = state.pending
        if (pending?.kind === kind && !hasValue(container) &&
            (pending.hadValue || pending.control !== container.querySelector(controls))) {
          index = Math.max(index, pending.index)
          state.pending = undefined
        }
        state.active[kind] = index
      }
      const sectionKey = instanceKey ?? `${kind}:entry:${index}`
      state.indices.set(sectionKey, index)
      result.push({ kind, container, sectionIndex: index, sectionKey, confidence: candidates.get(container)!.confidence })
    }
  }
  return result
}

export function findWorkdayRepeatedSection(el: HTMLElement, sections = getWorkdaySections(el.ownerDocument)): RepeatedSectionMatch | null {
  return sections.find((section) => section.container.contains(el)) ?? null
}
