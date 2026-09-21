import { FIELD_LABELS } from '@/classifier/types'
import type { ApplicationRecord, ApplicationStatus } from '@/applicationTracker/types'
import { APPLICATION_STATUSES } from '@/applicationTracker/types'
import type { PageState } from '@/ui/popup/api'

interface OverviewProps {
  page: PageState | null
  applications: ApplicationRecord[]
  busy: boolean
  enabled: boolean
  onScan: () => void
  onAutofill: () => void
  onOpenSettings: () => void
  onStatus: (id: string, status: ApplicationStatus) => void
  onDelete: (id: string) => void
}

export function Overview({ page, applications, busy, enabled, onScan, onAutofill, onOpenSettings, onStatus, onDelete }: OverviewProps) {
  const counts = page?.snapshot?.counts
  const fields = [...(page?.snapshot?.fields ?? [])].sort((a, b) => rank(a.status) - rank(b.status))
  return (
    <div className="stack">
      {!enabled ? (
        <div className="callout">
          ApplyLocal is paused.
          <button type="button" onClick={onOpenSettings}>Open settings</button>
        </div>
      ) : null}
      <div className="site">
        <span>{page ? hostOf(page.url) : 'Looking at this tab…'}</span>
        <strong>{page?.atsLabel ?? '…'}</strong>
      </div>
      {page?.error ? <p className="error">{page.error}</p> : null}
      <div className="stats">
        <Stat label="Detected" value={counts?.detected ?? 0} />
        <Stat label="Filled" value={counts?.autofilled ?? 0} />
        <Stat label="Review" value={counts?.review ?? 0} />
      </div>
      <p className="quiet">
        {counts ? `${counts.unrecognized} unclear fields were left untouched.` : 'Scan the form to see what ApplyLocal recognizes.'}
        {' '}Nothing is submitted for you.
      </p>
      <div className="actions">
        <button type="button" className="primary" disabled={busy || !enabled} onClick={onAutofill}>
          Autofill page
        </button>
        <button type="button" disabled={busy || !enabled} onClick={onScan}>
          Scan again
        </button>
      </div>
      {fields.length ? (
        <ul className="fields">
          {fields.map((field) => (
            <li key={field.id}>
              <i data-tone={tone(field.status)} />
              <div>
                <strong>{field.label}</strong>
                <span>
                  {FIELD_LABELS[field.canonical]} · {Math.round(field.confidence * 100)}%
                  {field.proposedPreview ? ` · ${field.proposedPreview}` : ''}
                </span>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="applications">
        <h2>Saved applications</h2>
        {applications.length === 0 ? <p className="quiet">When you submit an application yourself, ApplyLocal can ask to save it here.</p> : null}
        <ul>
          {applications.map((application) => (
            <li key={application.id}>
              <div>
                <strong>{application.company}</strong>
                <span>{application.jobTitle || application.ats} · {new Date(application.dateApplied).toLocaleDateString()}</span>
              </div>
              <select
                aria-label={`Status for ${application.company}`}
                value={application.status}
                onChange={(event) => onStatus(application.id, event.target.value as ApplicationStatus)}
              >
                {APPLICATION_STATUSES.map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
              <button type="button" onClick={() => onDelete(application.id)}>Delete</button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  )
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return 'This tab'
  }
}

function rank(status: string): number {
  if (status === 'suggested') return 0
  if (status === 'autofilled') return 1
  if (status === 'manual') return 2
  return 3
}

function tone(status: string): string {
  if (status === 'autofilled') return 'green'
  if (status === 'suggested') return 'yellow'
  return 'gray'
}
