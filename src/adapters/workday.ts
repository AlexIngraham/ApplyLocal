import type { ATSAdapter } from '@/adapters/types'
import { fillControl } from '@/content/filler'
import { scanControls } from '@/content/scanControls'
import {
  fillWorkdayCombobox,
  fillWorkdayMultiValueCombobox,
  findWorkdayRepeatedSection,
  isWorkdayDom,
  isWorkdayMultiValueSkillsField,
  workdayHintFor,
} from '@/adapters/workdayDom'
import { isWorkdayUrl } from '@/platform/detect'
import { dateCandidatesForControl } from '@/content/dateFormat'

export const workdayAdapter: ATSAdapter = {
  id: 'workday',
  label: 'Workday',
  matches(url) {
    return isWorkdayUrl(url)
  },
  detectDom(root) {
    return isWorkdayDom(root)
  },
  scan(root, ctx) {
    const fields = scanControls(root, ctx, this.id, workdayHintFor, findWorkdayRepeatedSection)
    for (const field of fields) {
      if (isWorkdayMultiValueSkillsField(field)) field.control.multiValue = true
    }
    return fields
  },
  fill(field, value) {
    if (field.control.kind === 'combobox' && field.control.multiValue && Array.isArray(value)) {
      return fillWorkdayMultiValueCombobox(field, value)
    }
    if (field.control.kind === 'combobox' && typeof value === 'string') {
      const formatted = dateCandidatesForControl(field, value)
      if (formatted && !formatted.length) {
        return { ok: false, status: 'failed', message: 'Saved value does not fit this date field.' }
      }
      return fillWorkdayCombobox(field, formatted?.[0] ?? value)
    }
    return fillControl(field, value)
  },
}
