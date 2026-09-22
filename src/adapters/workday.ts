import { devLog } from '@/utils/logging'
import { getWorkdaySections, findWorkdayRepeatedSection, workdayVisible } from '@/adapters/workdaySections'
import type { ATSAdapter } from '@/adapters/types'
import { fillControl } from '@/content/filler'
import { fillSkillsWidget } from '@/content/skills/fill'
import { scanControls } from '@/content/scanControls'
import {
  fillWorkdayCombobox,
  fillWorkdayMultiValueCombobox,
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
    const doc = root instanceof Document ? root : root.ownerDocument ?? document
    const sections = getWorkdaySections(doc)
    const sectionFor = (el: HTMLElement) => findWorkdayRepeatedSection(el, sections)
    const fields = scanControls(root, ctx, this.id, (el) => workdayHintFor(el, sectionFor), sectionFor)
      .filter((field) => workdayVisible(field.control.elements[0]!))
    devLog('Workday scan reconciled', { sections: sections.length, controls: fields.length })
    for (const field of fields) {
      if (isWorkdayMultiValueSkillsField(field)) field.control.multiValue = true
    }
    return fields
  },
  fill(field, value) {
    if (field.canonical === 'skills') return fillSkillsWidget(field, value, fillWorkdayMultiValueCombobox)
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
