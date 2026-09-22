import type { AdapterHint, ATSAdapter } from '@/adapters/types'
import { fillControl } from '@/content/filler'
import { fillSkillsWidget } from '@/content/skills/fill'
import { scanControls } from '@/content/scanControls'

function hintFrom(el: Element, table: Array<[RegExp, AdapterHint]>): AdapterHint | null {
  const name = el.getAttribute('name') || ''
  if (!name) return null
  for (const [pattern, hint] of table) {
    if (pattern.test(name)) return hint
  }
  return null
}

const GREENHOUSE_HINTS: Array<[RegExp, AdapterHint]> = [
  [/\[first_name\]$|^first_name$/, { key: 'firstName', confidence: 0.99, reason: 'Greenhouse first name field' }],
  [/\[last_name\]$|^last_name$/, { key: 'lastName', confidence: 0.99, reason: 'Greenhouse last name field' }],
  [/\[email\]$|^email$/, { key: 'email', confidence: 0.99, reason: 'Greenhouse email field' }],
  [/\[phone\]$|^phone$/, { key: 'phone', confidence: 0.99, reason: 'Greenhouse phone field' }],
  [/\[resume\]|^resume$/i, { key: 'resume', confidence: 0.99, reason: 'Greenhouse resume upload' }],
  [/linkedin/i, { key: 'linkedin', confidence: 0.99, reason: 'Greenhouse LinkedIn field' }],
]

export const greenhouseAdapter: ATSAdapter = {
  id: 'greenhouse',
  label: 'Greenhouse',
  matches(url) {
    try {
      const host = new URL(url).hostname.toLowerCase()
      return host === 'greenhouse.io' || host.endsWith('.greenhouse.io')
    } catch {
      return false
    }
  },
  detectDom(root) {
    return Boolean(root.querySelector('#application_form, #application-form, #grnhse_app, form[action*="greenhouse"]'))
  },
  scan(root, ctx) {
    return scanControls(root, ctx, this.id, (el) => hintFrom(el, GREENHOUSE_HINTS))
  },
  fill(field, value) {
    if (field.canonical === 'skills') return fillSkillsWidget(field, value)
    return fillControl(field, value)
  },
}
