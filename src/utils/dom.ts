import { normalize } from '@/classifier/normalize'

export function cleanText(value: string | null | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').replace(/[\s*]+$/g, '').trim()
}

export function cssEscape(value: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') return CSS.escape(value)
  return value.replace(/[^a-zA-Z0-9_-]/g, (char) => `\\${char}`)
}

export function collectElements(root: ParentNode): Element[] {
  const out: Element[] = []
  const visit = (node: ParentNode) => {
    node.querySelectorAll('*').forEach((el) => {
      out.push(el)
      if (el.shadowRoot) visit(el.shadowRoot)
    })
  }
  visit(root)
  return out
}

export function inIgnoredRegion(el: Element): boolean {
  return Boolean(el.closest('nav, header, footer, [role="navigation"], [role="banner"], [role="contentinfo"], #applylocal-root'))
}

export function looksLikeHoneypot(el: Element, label: string): boolean {
  const blob = normalize(
    `${el.getAttribute('class') || ''} ${el.getAttribute('name') || ''} ${el.getAttribute('id') || ''} ${label}`,
  )
  if (/\bhoneypot\b|\bleave (this )?(field )?blank\b|\bdo not fill\b|\bdo not enter\b/.test(blob)) return true
  const rect = el.getBoundingClientRect?.()
  if (rect && (rect.left < -200 || rect.top < -200)) return true
  return false
}

export function textWithoutControls(root: Element): string {
  const clone = root.cloneNode(true) as Element
  clone.querySelectorAll('input, select, textarea, button').forEach((node) => node.remove())
  return cleanText(clone.textContent)
}

export function labelForControl(el: Element): string {
  const doc = el.ownerDocument
  const id = el.getAttribute('id')
  if (id && doc) {
    const explicit = doc.querySelector(`label[for="${cssEscape(id)}"]`)
    if (explicit) {
      const text = cleanText(explicit.textContent)
      if (text && text.length <= 300) return text
    }
  }
  const wrapping = el.closest('label')
  if (wrapping) {
    const text = textWithoutControls(wrapping)
    if (text && text.length <= 300) return text
  }
  const parent = el.parentElement
  if (parent) {
    const direct = Array.from(parent.children).find((child) => child.tagName === 'LABEL')
    if (direct) {
      const text = cleanText(direct.textContent)
      if (text && text.length <= 300) return text
    }
  }
  return ''
}

export function ariaText(el: Element): string {
  const label = cleanText(el.getAttribute('aria-label'))
  if (label) return label
  const ids = el.getAttribute('aria-labelledby')
  if (!ids || !el.ownerDocument) return ''
  return cleanText(
    ids
      .split(/\s+/)
      .map((id) => el.ownerDocument?.getElementById(id)?.textContent || '')
      .join(' '),
  )
}

export function describedBy(el: Element): string {
  const ids = el.getAttribute('aria-describedby')
  if (!ids || !el.ownerDocument) return ''
  return cleanText(
    ids
      .split(/\s+/)
      .map((id) => el.ownerDocument?.getElementById(id)?.textContent || '')
      .join(' '),
  ).slice(0, 240)
}

export function previousPrompt(el: Element): string {
  const candidates = [el.previousElementSibling, el.parentElement?.previousElementSibling]
  for (const candidate of candidates) {
    if (!candidate || candidate.tagName === 'LABEL') continue
    if (candidate.querySelector('input, select, textarea, button')) continue
    const text = cleanText(candidate.textContent)
    if (text && text.length <= 200) return text
  }
  return ''
}

export function groupQuestion(el: Element): string {
  const fieldset = el.closest('fieldset')
  const legend = fieldset?.querySelector('legend')
  if (legend) {
    const text = cleanText(legend.textContent)
    if (text && text.length <= 300) return text
  }
  const group = el.closest('[role="radiogroup"], [role="group"], .field, .form-group, .question')
  if (!group) return ''
  const heading = Array.from(group.children).find((child) => {
    if (child.contains(el) && child !== el) return false
    if (/^(INPUT|SELECT|TEXTAREA|BUTTON)$/.test(child.tagName)) return false
    if (child.querySelector('input, select, textarea')) return false
    const text = cleanText(child.textContent)
    return text.length > 0 && text.length <= 300
  })
  return heading ? cleanText(heading.textContent) : ''
}

export function sectionFromText(text: string): 'education' | 'employment' | 'unknown' {
  const normalized = normalize(text)
  if (!normalized) return 'unknown'
  const education = /\b(education|academic)\b/.test(normalized)
  const employment = /\b(experience|employment|work history|professional history)\b/.test(normalized)
  if (education && !employment) return 'education'
  if (employment && !education) return 'employment'
  return 'unknown'
}

export function detectSection(el: Element): 'education' | 'employment' | 'unknown' {
  let current: Element | null = el
  while (current && current.tagName !== 'BODY') {
    if (current.tagName === 'FIELDSET') {
      const legend = Array.from(current.children).find((child) => child.tagName === 'LEGEND')
      const kind = sectionFromText(legend?.textContent || '')
      if (kind !== 'unknown') return kind
    }
    const classKind = sectionFromText(
      `${current.getAttribute('class') || ''} ${current.getAttribute('data-automation-id') || ''}`,
    )
    if (classKind !== 'unknown') return classKind
    let sibling = current.previousElementSibling
    while (sibling) {
      if (/^H[1-6]$/.test(sibling.tagName) || sibling.tagName === 'LEGEND') {
        const kind = sectionFromText(sibling.textContent || '')
        if (kind !== 'unknown') return kind
      }
      sibling = sibling.previousElementSibling
    }
    if (current.tagName === 'FORM') break
    current = current.parentElement
  }
  return 'unknown'
}

export function isDisabledControl(el: Element): boolean {
  if (el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true') return true
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) return el.readOnly
  return false
}
