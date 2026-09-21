import { describe, expect, it } from 'vitest'
import { decideFieldPlan } from '@/classifier/confidence'
import { createDefaultSettings } from '@/settings/defaults'

const settings = createDefaultSettings()

function plan(patch: Partial<Parameters<typeof decideFieldPlan>[0]>) {
  return decideFieldPlan({
    key: 'email',
    confidence: 0.95,
    hasValue: true,
    sensitiveBlocked: false,
    typeDisabled: false,
    controlKind: 'text',
    disabledControl: false,
    settings,
    ...patch,
  })
}

describe('decideFieldPlan', () => {
  it('autofills high-confidence fields with a saved value', () => {
    expect(plan({ confidence: 0.9 }).plan).toBe('autofill')
    expect(plan({ confidence: 0.95 }).fillBand).toBe('high')
  })

  it('suggests the middle band and ignores weak matches', () => {
    expect(plan({ confidence: 0.65 }).plan).toBe('review')
    expect(plan({ confidence: 0.89 }).plan).toBe('review')
    expect(plan({ confidence: 0.649 }).plan).toBe('ignore')
  })

  it('turns high-confidence matches into suggestions when automatic fill is off', () => {
    const decision = plan({ settings: { ...settings, autoFillHighConfidence: false } })
    expect(decision.plan).toBe('review')
    expect(decision.fillBand).toBe('high')
  })

  it('blocks sensitive, disabled, empty, file, and unknown fields', () => {
    expect(plan({ sensitiveBlocked: true, key: 'sensitive.gender' }).plan).toBe('skip')
    expect(plan({ typeDisabled: true }).plan).toBe('skip')
    expect(plan({ hasValue: false }).plan).toBe('skip')
    expect(plan({ hasValue: false, confidence: 0.8 }).plan).toBe('review')
    expect(plan({ controlKind: 'file', key: 'resume' }).plan).toBe('skip')
    expect(plan({ key: 'unknown', confidence: 0.99 }).plan).toBe('ignore')
    expect(plan({ controlKind: 'custom' }).plan).toBe('review')
  })
})
