import { createId } from '@/profile/defaults'
import { APPLICATIONS_KEY } from '@/applicationTracker/types'
import type { ApplicationRecord, ApplicationStatus } from '@/applicationTracker/types'

const STATUSES = new Set<ApplicationStatus>(['applied', 'interview', 'offer', 'rejected', 'withdrawn'])

function cleanRecord(value: unknown): ApplicationRecord | null {
  if (!value || typeof value !== 'object') return null
  const raw = value as Partial<ApplicationRecord>
  if (typeof raw.company !== 'string' || typeof raw.url !== 'string') return null
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : createId('app'),
    company: raw.company,
    jobTitle: typeof raw.jobTitle === 'string' ? raw.jobTitle : '',
    url: raw.url,
    ats: typeof raw.ats === 'string' ? raw.ats : 'generic',
    dateApplied: typeof raw.dateApplied === 'string' ? raw.dateApplied : new Date().toISOString(),
    status: raw.status && STATUSES.has(raw.status) ? raw.status : 'applied',
    notes: typeof raw.notes === 'string' ? raw.notes : '',
  }
}

export async function listApplications(): Promise<ApplicationRecord[]> {
  const data = await chrome.storage.local.get(APPLICATIONS_KEY)
  const stored = data[APPLICATIONS_KEY]
  if (!Array.isArray(stored)) return []
  return stored.map(cleanRecord).filter((record): record is ApplicationRecord => record !== null)
}

export async function addApplication(record: ApplicationRecord): Promise<void> {
  const existing = await listApplications()
  const next = [record, ...existing.filter((item) => item.url !== record.url)].slice(0, 200)
  await chrome.storage.local.set({ [APPLICATIONS_KEY]: next })
}

export async function updateApplication(id: string, patch: Partial<ApplicationRecord>): Promise<void> {
  const existing = await listApplications()
  const next = existing.map((record) => (record.id === id ? { ...record, ...patch, id: record.id } : record))
  await chrome.storage.local.set({ [APPLICATIONS_KEY]: next })
}

export async function removeApplication(id: string): Promise<void> {
  const existing = await listApplications()
  await chrome.storage.local.set({ [APPLICATIONS_KEY]: existing.filter((record) => record.id !== id) })
}
