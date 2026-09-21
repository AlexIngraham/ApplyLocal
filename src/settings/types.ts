import type { CanonicalField } from '@/classifier/types'

export interface Settings {
  version: 1
  enabled: boolean
  autoFillHighConfidence: boolean
  autofillThreshold: number
  reviewThreshold: number
  enableSiteAdapters: boolean
  showFieldIndicators: boolean
  neverAutofillSensitive: boolean
  disabledFields: CanonicalField[]
}
