import type { DetectedField, FillResult } from '@/adapters/types'
import { fillControl, isControlEmpty, readControl, restoreControl } from '@/content/filler'

export function applyDetectedFields(fields: DetectedField[], mode: 'auto' | 'page'): void {
  for (const field of fields) {
    if (field.locked || field.status === 'manual' || field.status === 'autofilled') continue
    if (mode === 'auto' && field.plan !== 'autofill') continue
    if (mode === 'page' && field.fillBand !== 'high') continue
    if (!field.proposedValue) continue
    if (!isControlEmpty(field)) {
      field.locked = true
      field.status = 'manual'
      field.planReason = 'Already had a value, so it was left unchanged.'
      continue
    }
    writeField(field)
  }
}

export function fillOne(field: DetectedField): FillResult {
  if (field.fillBand === 'blocked' || field.fillBand === 'none' || !field.proposedValue) {
    return { ok: false, status: 'skipped', message: field.planReason }
  }
  return writeField(field)
}

export function undoField(field: DetectedField): void {
  if (field.previousValue == null) return
  restoreControl(field, field.previousValue)
  field.locked = true
  field.status = field.proposedValue ? 'suggested' : 'skipped'
  field.fillError = undefined
  field.planReason = 'Reverted. Automatic fill will not replace this unless you press Fill.'
}

function writeField(field: DetectedField): FillResult {
  field.previousValue = readControl(field)
  const result = fillControl(field, field.proposedValue ?? '')
  if (result.ok) {
    field.status = 'autofilled'
    field.fillError = undefined
    field.locked = false
  } else {
    field.status = 'suggested'
    field.fillError = result.message
  }
  return result
}
