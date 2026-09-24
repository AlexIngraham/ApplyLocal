import { Accordion } from './components/Accordion'
import { Icon } from './components/Icon'
import { Badge, Button, EmptyState, IconButton, StatusMessage } from './components/ui'
import { FIELD_LABELS } from '@/classifier/types'
import type { ApplicationRecord, ApplicationStatus } from '@/applicationTracker/types'
import { APPLICATION_STATUSES } from '@/applicationTracker/types'
import type { PageState } from '@/ui/popup/api'

interface OverviewProps {
  page: PageState | null
  applications: ApplicationRecord[]
  busy: 'scan' | 'autofill' | null
  notice: string
  actionError: string
  enabled: boolean
  onScan: () => void
  onAutofill: () => void
  onOpenSettings: () => void
  onStatus: (id: string, status: ApplicationStatus) => void
  onDelete: (id: string) => void
}

export function Overview({ page, applications, busy, enabled, notice, actionError, onScan, onAutofill, onOpenSettings, onStatus, onDelete }: OverviewProps) {
  const counts = page?.snapshot?.counts
  const fields = [...(page?.snapshot?.fields ?? [])].sort((a, b) => rank(a.status) - rank(b.status))
  return (
    <div className="stack">
      <div className="page-heading"><div><h1>Ready when you are.</h1><p>Your details. Fewer repetitive fields.</p></div></div>
      {!enabled && <StatusMessage tone="warning">ApplyLocal is paused.<br /><Button onClick={onOpenSettings}>Open settings</Button></StatusMessage>}
      <div className="site-card">
        <p className="eyebrow">Current page</p>
        <div className="site-header"><span className="site-symbol"><Icon name="globe" /></span><div className="site-copy"><strong>{page?.atsLabel ?? 'Connecting…'}</strong><p>{page ? hostOf(page.url) : 'Checking the active tab'}</p></div><Badge tone={page?.error ? 'warning' : page?.ats !== 'generic' && page ? 'success' : 'neutral'}>{page?.error ? 'Unavailable' : !page ? 'Connecting' : page.ats === 'generic' ? 'Generic' : 'Detected'}</Badge></div>
        <div className="stats">
          <Stat label="Detected" value={counts?.detected} />
          <Stat label="Filled" value={counts?.autofilled} tone="success" />
          <Stat label="Review" value={counts?.review} tone="warning" />
          <Stat label="Skipped" value={counts?.skipped} />
        </div>
      </div>
      {page?.error && <StatusMessage tone="error">{page.error} Open a job application and reopen this popup to reconnect.</StatusMessage>}
      {actionError && <StatusMessage tone="error">{actionError}</StatusMessage>}
      <div className="actions primary-actions" aria-busy={busy !== null}>
        <Button variant="primary" icon={busy === 'autofill' ? 'spinner' : 'arrow'} disabled={!!busy || !enabled || !page || !!page.error} onClick={onAutofill}>{busy === 'autofill' ? 'Filling…' : 'Autofill page'}</Button>
        <Button icon={busy === 'scan' ? 'spinner' : 'refresh'} disabled={!!busy || !enabled || !page} onClick={onScan}>{busy === 'scan' ? 'Scanning…' : 'Scan again'}</Button>
      </div>
      <p className="action-note">You stay in control. Nothing is submitted for you.</p>
      {notice && !actionError && <StatusMessage tone="success">{notice}</StatusMessage>}
      {!!counts?.review && <StatusMessage tone="warning">{counts.review} {counts.review === 1 ? 'field needs' : 'fields need'} review. Check the suggestions before submitting.</StatusMessage>}
      {counts ? <p className="quiet">{counts.unrecognized} unclear {counts.unrecognized === 1 ? 'field was' : 'fields were'} left untouched.</p> : !page?.error && <EmptyState>Open an application form to see recognized fields here.</EmptyState>}
      {fields.length ? (
        <Accordion title="Field details" icon="overview" summary={`${fields.length} fields · Review suggestions first`}>
        <ul className="fields">
          {fields.map((field) => (
            <li key={field.id}>
              <i className="field-dot" data-tone={tone(field.status)} />
              <div>
                <strong>{field.label}</strong>
                <span>
                  {field.status === 'suggested' ? 'Needs review' : field.status === 'autofilled' ? 'Filled' : field.status === 'manual' ? 'Manual' : 'Not filled'} · {FIELD_LABELS[field.canonical]} · {Math.round(field.confidence * 100)}%
                  {field.proposedPreview ? ` · ${field.proposedPreview}` : ''}
                </span>
              </div>
            </li>
          ))}
        </ul>
        </Accordion>
      ) : null}
      <Accordion title="Saved applications" icon="work" summary={applications.length ? `${applications.length} saved on this device` : 'Keep track after you submit'}>
        {applications.length === 0 ? <EmptyState>When you submit an application yourself, ApplyLocal can ask to save it here.</EmptyState> : null}
        <ul className="applications">
          {applications.map((application) => (
            <li key={application.id}>
              <div>
                <strong>{application.company}</strong>
                <span>{application.jobTitle || application.ats} · {new Date(application.dateApplied).toLocaleDateString()}</span>
              </div>
              <div className="application-controls"><select
                aria-label={`Status for ${application.company}`}
                value={application.status}
                onChange={(event) => onStatus(application.id, event.target.value as ApplicationStatus)}
              >
                {APPLICATION_STATUSES.map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
              <IconButton icon="trash" label={`Delete application for ${application.company}`} onClick={() => onDelete(application.id)} /></div>
            </li>
          ))}
        </ul>
      </Accordion>
    </div>
  )
}

function Stat({ label, value, tone = '' }: { label: string; value?: number; tone?: string }) {
  return (
    <div>
      <strong className={tone}>{value ?? '—'}</strong>
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
