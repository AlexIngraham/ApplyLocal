import type { CanonicalField } from '@/classifier/types'
import type { ControlKind, FieldPlan, FillBand } from '@/classifier/confidence'
import type { Profile } from '@/profile/types'
import type { Settings } from '@/settings/types'

export type FieldStatus = 'autofilled' | 'suggested' | 'manual' | 'skipped' | 'untouched'

export interface ControlHandle {
  elements: HTMLElement[]
  kind: ControlKind
  inputType: string
}

export interface DetectedField {
  id: string
  adapterId: string
  canonical: CanonicalField
  confidence: number
  reason: string
  proposedValue: string | null
  plan: FieldPlan
  fillBand: FillBand
  planReason: string
  label: string
  repeatIndex: number
  status: FieldStatus
  sensitive: boolean
  locked: boolean
  control: ControlHandle
  previousValue: string | null
  fillError?: string
}

export interface FillResult {
  ok: boolean
  status: 'filled' | 'skipped' | 'failed'
  message?: string
}

export interface ScanContext {
  url: string
  profile: Profile
  settings: Settings
}

export interface ATSAdapter {
  id: string
  label: string
  matches(url: string): boolean
  detectDom?(root: ParentNode): boolean
  scan(root: ParentNode, ctx: ScanContext): DetectedField[]
  fill(field: DetectedField, value: string): FillResult
}

export interface AdapterHint {
  key: CanonicalField
  confidence: number
  reason: string
}
