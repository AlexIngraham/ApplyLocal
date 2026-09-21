import type { CanonicalField } from '@/classifier/types'

export interface Settings {
  version: 1
  enabled: boolean
  autoFillHighConfidence: boolean
  autofillThreshold: number
  reviewThreshold: number
  enableSiteAdapters: boolean
  showFieldIndicators: boolean
  autofillSensitiveDemographics: boolean
  /** Legacy inverse safety flag retained for stored-settings compatibility. */
  neverAutofillSensitive: boolean
  disabledFields: CanonicalField[]
}
