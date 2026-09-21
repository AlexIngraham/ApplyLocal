import type { ATSAdapter } from '@/adapters/types'
import { fillControl } from '@/content/filler'
import { scanControls } from '@/content/scanControls'

export const genericAdapter: ATSAdapter = {
  id: 'generic',
  label: 'Generic form',
  matches() {
    return false
  },
  scan(root, ctx) {
    return scanControls(root, ctx, this.id)
  },
  fill(field, value) {
    return fillControl(field, value)
  },
}
