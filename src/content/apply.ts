import { workdayVisible } from '@/adapters/workdaySections'
import type { DetectedField, FillOutcome, FillResult } from '@/adapters/types'
import { isControlEmpty, readControl, restoreControl } from '@/content/filler'
import { getAdapter } from '@/adapters/registry'
import { beginFill } from '@/content/fillTransaction'

const pendingFields = new WeakMap<DetectedField, Promise<FillResult>>()

export function applyDetectedFields(fields: DetectedField[], mode: 'auto' | 'page'): Promise<void> {
  const pending: Promise<FillResult>[] = []
  for (const field of fields) {
    if (!field.control.elements[0] || !workdayVisible(field.control.elements[0])) continue
    if (field.locked || field.status === 'manual' || field.status === 'autofilled') continue
    if (mode === 'auto' && field.plan !== 'autofill') continue
    if (mode === 'page' && field.fillBand !== 'high') continue
    if (!hasValue(field.proposedValue)) continue
    if (!isControlEmpty(field)) {
      field.locked = true
      field.status = 'manual'
      field.planReason = 'Already had a value, so it was left unchanged.'
      continue
    }
    const result = writeField(field)
    if (result instanceof Promise) pending.push(result)
  }
  return Promise.all(pending).then(() => undefined)
}

export function fillOne(field: DetectedField): FillOutcome {
  if (field.fillBand === 'blocked' || field.fillBand === 'none' || !hasValue(field.proposedValue)) {
    return { ok: false, status: 'skipped', message: field.planReason }
  }
  return writeField(field)
}

export function undoField(field: DetectedField): void {
  if (field.previousValue == null) return
  restoreControl(field, field.previousValue)
  field.locked = true
  field.status = hasValue(field.proposedValue) ? 'suggested' : 'skipped'
  field.fillError = undefined
  field.planReason = 'Reverted. Automatic fill will not replace this unless you press Fill.'
}

function writeField(field: DetectedField): FillOutcome {
  const pending = pendingFields.get(field)
  if (pending) return pending
  if (!field.control.elements[0] || !workdayVisible(field.control.elements[0])) return { ok: false, status: 'skipped', message: 'This control is no longer active.' }
  field.previousValue = field.control.multiValue ? null : readControl(field)
  field.locked = true
  const end = beginFill(field.control.elements[0]!.ownerDocument)
  try {
    const result = getAdapter(field.adapterId).fill(field, field.proposedValue ?? '')
    if (result instanceof Promise) {
      const task = result.catch((): FillResult => ({ ok: false, status: 'failed', message: 'The page changed before filling finished.' }))
        .then((settled) => updateResult(field, settled))
        .finally(() => { pendingFields.delete(field); end() })
      pendingFields.set(field, task)
      return task
    }
    const settled = updateResult(field, result)
    end()
    return settled
  } catch {
    const settled = updateResult(field, { ok: false, status: 'failed', message: 'The page changed before filling finished.' })
    end()
    return settled
  }
}

function updateResult(field: DetectedField, result: FillResult): FillResult {
  if (field.status === 'manual') return result
  if (result.ok) {
    field.status = result.needsReview ? 'suggested' : 'autofilled'
    field.fillError = result.needsReview ? result.message : undefined
    field.locked = Boolean(result.needsReview)
    if (result.message) field.planReason = result.message
  } else {
    field.status = 'suggested'
    field.fillError = result.message
    field.locked = true
  }
  return result
}

function hasValue(value: DetectedField['proposedValue']): boolean {
  return Array.isArray(value) ? value.length > 0 : Boolean(value)
}
