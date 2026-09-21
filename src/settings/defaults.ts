import { isCanonicalField } from '@/classifier/types'
import type { Settings } from '@/settings/types'

export const SETTINGS_KEY = 'settings'

export function createDefaultSettings(): Settings {
  return {
    version: 1,
    enabled: true,
    autoFillHighConfidence: true,
    autofillThreshold: 0.9,
    reviewThreshold: 0.65,
    enableSiteAdapters: true,
    showFieldIndicators: true,
    autofillSensitiveDemographics: false,
    neverAutofillSensitive: true,
    disabledFields: [],
  }
}

function clamp(value: unknown, fallback: number): number {
  const number = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(number)) return fallback
  return Math.min(0.99, Math.max(0.5, number))
}

export function mergeSettings(value: unknown): Settings {
  const base = createDefaultSettings()
  if (!value || typeof value !== 'object') return base
  const raw = value as Partial<Settings>
  let reviewThreshold = clamp(raw.reviewThreshold, base.reviewThreshold)
  let autofillThreshold = clamp(raw.autofillThreshold, base.autofillThreshold)
  if (autofillThreshold < reviewThreshold + 0.05) autofillThreshold = Math.min(0.99, reviewThreshold + 0.05)
  if (reviewThreshold >= autofillThreshold) reviewThreshold = Math.max(0.5, autofillThreshold - 0.05)
  const autofillSensitiveDemographics =
    typeof raw.autofillSensitiveDemographics === 'boolean'
      ? raw.autofillSensitiveDemographics
      : raw.neverAutofillSensitive === false
  return {
    version: 1,
    enabled: raw.enabled !== false,
    autoFillHighConfidence: raw.autoFillHighConfidence !== false,
    autofillThreshold,
    reviewThreshold,
    enableSiteAdapters: raw.enableSiteAdapters !== false,
    showFieldIndicators: raw.showFieldIndicators !== false,
    autofillSensitiveDemographics,
    neverAutofillSensitive: !autofillSensitiveDemographics,
    disabledFields: Array.isArray(raw.disabledFields) ? raw.disabledFields.filter((item) => isCanonicalField(item)) : [],
  }
}
