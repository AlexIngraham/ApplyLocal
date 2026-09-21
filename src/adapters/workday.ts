import type { ATSAdapter } from '@/adapters/types'
import { fillControl } from '@/content/filler'
import { scanControls } from '@/content/scanControls'
import { fillWorkdayCombobox, isWorkdayDom, workdayHintFor } from '@/adapters/workdayDom'
import { isWorkdayUrl } from '@/platform/detect'

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
    return scanControls(root, ctx, this.id, workdayHintFor)
  },
  fill(field, value) {
    if (field.control.kind === 'combobox') return fillWorkdayCombobox(field, value)
    return fillControl(field, value)
  },
}
