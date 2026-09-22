import type { CanonicalField } from '@/classifier/types'
import type { ControlKind, FieldPlan, FillBand } from '@/classifier/confidence'
import type { Profile } from '@/profile/types'
import type { Settings } from '@/settings/types'

export type FieldStatus = 'autofilled' | 'suggested' | 'manual' | 'skipped' | 'untouched'
export type ProposedValue = string | string[]

export interface RepeatedSectionContext {
  kind: 'employment' | 'education'
  sectionKey: string
  sectionIndex: number
}

export interface ControlHandle {
  elements: HTMLElement[]
  kind: ControlKind
  inputType: string
  multiValue?: boolean
}

export interface DetectedField {
  id: string
  adapterId: string
  canonical: CanonicalField
  confidence: number
  reason: string
  proposedValue: ProposedValue | null
  plan: FieldPlan
  fillBand: FillBand
  planReason: string
  label: string
  repeatIndex: number
  repeatedSection?: RepeatedSectionContext
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
  requested?: number
  filled?: number
  skipped?: number
  needsReview?: boolean
}

export type FillOutcome = FillResult | Promise<FillResult>

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
  fill(field: DetectedField, value: ProposedValue): FillOutcome
}

export interface AdapterHint {
  key: CanonicalField
  confidence: number
  reason: string
}

export interface RepeatedSectionMatch extends RepeatedSectionContext {
  confidence?: number
  container: HTMLElement
}
