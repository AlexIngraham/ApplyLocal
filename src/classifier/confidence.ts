import type { CanonicalField } from '@/classifier/types'
import type { Settings } from '@/settings/types'

export type FieldPlan = 'autofill' | 'review' | 'skip' | 'ignore'
export type FillBand = 'high' | 'review' | 'blocked' | 'none'
export type ControlKind = 'text' | 'textarea' | 'select' | 'radio' | 'checkbox' | 'file' | 'custom' | 'combobox'

export interface PlanInput {
  key: CanonicalField
  confidence: number
  hasValue: boolean
  sensitiveBlocked: boolean
  typeDisabled: boolean
  controlKind: ControlKind
  disabledControl: boolean
  settings: Pick<Settings, 'autoFillHighConfidence' | 'autofillThreshold' | 'reviewThreshold'>
}

export interface FieldDecision {
  plan: FieldPlan
  fillBand: FillBand
  planReason: string
}

export function decideFieldPlan(input: PlanInput): FieldDecision {
  const { settings } = input
  if (input.key === 'unknown' || input.confidence < settings.reviewThreshold) {
    return { plan: 'ignore', fillBand: 'none', planReason: 'Not confident enough to suggest a value.' }
  }
  if (input.key === 'resume' || input.controlKind === 'file') {
    return {
      plan: 'skip',
      fillBand: 'blocked',
      planReason: 'File uploads stay manual. Nothing is uploaded for you.',
    }
  }
  if (input.typeDisabled) {
    return { plan: 'skip', fillBand: 'blocked', planReason: 'You turned off autofill for this kind of field.' }
  }
  if (input.sensitiveBlocked) {
    return {
      plan: 'skip',
      fillBand: 'blocked',
      planReason: 'Demographic questions stay manual unless you enable that exact category.',
    }
  }
  if (input.disabledControl) {
    return { plan: 'skip', fillBand: 'blocked', planReason: 'This field is disabled or read-only.' }
  }

  const high = input.confidence >= settings.autofillThreshold
  if (!input.hasValue) {
    if (high) return { plan: 'skip', fillBand: 'blocked', planReason: 'No saved value for this field.' }
    return { plan: 'review', fillBand: 'review', planReason: 'Recognized, but there is no saved value yet.' }
  }
  if (input.controlKind === 'custom') {
    return { plan: 'review', fillBand: 'review', planReason: 'Custom dropdown — check this one manually.' }
  }
  if (high && settings.autoFillHighConfidence) {
    return { plan: 'autofill', fillBand: 'high', planReason: 'High confidence match.' }
  }
  if (high) {
    return { plan: 'review', fillBand: 'high', planReason: 'High confidence, but automatic fill is turned off.' }
  }
  return { plan: 'review', fillBand: 'review', planReason: 'Review this suggestion before filling it.' }
}
