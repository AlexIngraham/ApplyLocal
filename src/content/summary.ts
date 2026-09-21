import type { DetectedField } from '@/adapters/types'
import type { AtsId } from '@/platform/detect'
import type { ScanSnapshot } from '@/shared/messages'

export function summarize(
  fields: DetectedField[],
  meta: { href: string; ats: AtsId; atsLabel: string; enabled: boolean },
): ScanSnapshot {
  const recognized = fields.filter((field) => field.fillBand !== 'none')
  return {
    ok: true,
    href: meta.href,
    ats: meta.ats,
    atsLabel: meta.atsLabel,
    enabled: meta.enabled,
    counts: {
      detected: recognized.length,
      autofilled: recognized.filter((field) => field.status === 'autofilled').length,
      review: recognized.filter((field) => field.status === 'suggested').length,
      skipped: recognized.filter((field) => field.status === 'skipped' || field.status === 'manual').length,
      unrecognized: fields.filter((field) => field.fillBand === 'none').length,
    },
    fields: recognized.map((field) => ({
      id: field.id,
      canonical: field.canonical,
      label: field.label,
      confidence: field.confidence,
      reason: field.reason,
      status: field.status,
      fillBand: field.fillBand,
      sensitive: field.sensitive,
      proposedPreview: field.sensitive && field.fillBand === 'blocked' ? null : preview(field.proposedValue),
    })),
  }
}

function preview(value: string | string[] | null): string | null {
  if (!value) return null
  const display = Array.isArray(value) ? value.join(', ') : value
  return display.length > 80 ? `${display.slice(0, 77)}…` : display
}
