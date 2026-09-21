export type ApplicationStatus = 'applied' | 'interview' | 'offer' | 'rejected' | 'withdrawn'

export interface ApplicationRecord {
  id: string
  company: string
  jobTitle: string
  url: string
  ats: string
  dateApplied: string
  status: ApplicationStatus
  notes: string
}

export const APPLICATIONS_KEY = 'applications'

export const APPLICATION_STATUSES: ApplicationStatus[] = ['applied', 'interview', 'offer', 'rejected', 'withdrawn']
