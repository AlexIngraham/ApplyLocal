import type { AdapterHint, ATSAdapter } from '@/adapters/types'
import { fillControl } from '@/content/filler'
import { fillSkillsWidget } from '@/content/skills/fill'
import { scanControls } from '@/content/scanControls'

const EXACT: Record<string, AdapterHint> = {
  name: { key: 'fullName', confidence: 0.93, reason: 'Lever name field is the full name' },
  email: { key: 'email', confidence: 0.99, reason: 'Lever email field' },
  phone: { key: 'phone', confidence: 0.99, reason: 'Lever phone field' },
  org: { key: 'company', confidence: 0.9, reason: 'Lever org field is the current company' },
  location: { key: 'city', confidence: 0.9, reason: 'Lever location field is the candidate city' },
  'urls[LinkedIn]': { key: 'linkedin', confidence: 0.99, reason: 'Lever LinkedIn URL' },
  'urls[GitHub]': { key: 'github', confidence: 0.99, reason: 'Lever GitHub URL' },
  'urls[Portfolio]': { key: 'portfolio', confidence: 0.99, reason: 'Lever portfolio URL' },
  'urls[Other]': { key: 'website', confidence: 0.9, reason: 'Lever other website URL' },
  resume: { key: 'resume', confidence: 0.99, reason: 'Lever resume upload' },
}

export const leverAdapter: ATSAdapter = {
  id: 'lever',
  label: 'Lever',
  matches(url) {
    try {
      const host = new URL(url).hostname.toLowerCase()
      return host === 'lever.co' || host.endsWith('.lever.co')
    } catch {
      return false
    }
  },
  detectDom(root) {
    return Boolean(root.querySelector('form.application-form, form[action*="lever.co"], .lever-application'))
  },
  scan(root, ctx) {
    return scanControls(root, ctx, this.id, (el) => EXACT[el.getAttribute('name') || ''] ?? null)
  },
  fill(field, value) {
    if (field.canonical === 'skills') return fillSkillsWidget(field, value)
    return fillControl(field, value)
  },
}
