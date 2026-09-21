import type { AtsId } from '@/platform/detect'
import type { CanonicalField } from '@/classifier/types'
import type { FillBand } from '@/classifier/confidence'
import type { FieldStatus } from '@/adapters/types'

export interface FieldSummary {
  id: string
  canonical: CanonicalField
  label: string
  confidence: number
  reason: string
  status: FieldStatus
  fillBand: FillBand
  proposedPreview: string | null
  sensitive: boolean
}

export interface ScanCounts {
  detected: number
  autofilled: number
  review: number
  skipped: number
  unrecognized: number
}

export interface ScanSnapshot {
  ok: true
  href: string
  ats: AtsId
  atsLabel: string
  counts: ScanCounts
  fields: FieldSummary[]
  enabled: boolean
}

export type ContentResponse = ScanSnapshot | { ok: false; error: string }

export type ContentRequest =
  | { type: 'al:get-state' }
  | { type: 'al:scan' }
  | { type: 'al:autofill' }
  | { type: 'al:hello'; href: string }

export interface FrameRecord {
  tabId: number
  frameId: number
  href: string
  at: number
}
