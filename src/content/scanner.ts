import type { AtsId } from '@/platform/detect'
import { ATS_LABELS } from '@/platform/detect'
import type { DetectedField, ScanContext } from '@/adapters/types'
import { selectAdapter } from '@/adapters/registry'

export interface ScanResult {
  ats: AtsId
  atsLabel: string
  fields: DetectedField[]
}

export function scanDocument(root: ParentNode, ctx: ScanContext): ScanResult {
  const detectionRoot = root instanceof Node ? root.ownerDocument ?? root : root
  const adapter = selectAdapter(ctx.url, detectionRoot, ctx.settings)
  const ats = adapter.id === 'greenhouse' || adapter.id === 'lever' || adapter.id === 'workday' ? adapter.id : 'generic'
  return {
    ats,
    atsLabel: ATS_LABELS[ats] || adapter.label,
    fields: adapter.scan(root, ctx),
  }
}
