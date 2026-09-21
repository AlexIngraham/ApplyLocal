import type { CanonicalField } from '@/classifier/types'

export const SENSITIVE_CATEGORIES = [
  'race',
  'ethnicity',
  'gender',
  'disability',
  'veteran',
  'religion',
  'sexualOrientation',
] as const

export type SensitiveCategory = (typeof SENSITIVE_CATEGORIES)[number]
export type YesNo = '' | 'yes' | 'no'
export type WorkPreference = '' | 'remote' | 'hybrid' | 'onsite'

export interface PersonalInfo {
  firstName: string
  middleName: string
  lastName: string
  preferredName: string
  email: string
  phone: string
  address: string
  city: string
  state: string
  zip: string
  country: string
}

export interface LinkInfo {
  linkedin: string
  github: string
  portfolio: string
}

export interface EducationEntry {
  id: string
  school: string
  degree: string
  major: string
  minor: string
  startDate: string
  graduationDate: string
  gpa: string
}

export interface EmploymentEntry {
  id: string
  company: string
  jobTitle: string
  startDate: string
  endDate: string
  current: boolean
  location: string
  description: string
}

export interface ApplicationDefaults {
  workAuthorization: YesNo
  requiresSponsorship: YesNo
  requiresFutureSponsorship: YesNo
  willingToRelocate: YesNo
  workPreference: WorkPreference
  desiredSalary: string
  noticePeriod: string
  graduationYear: string
  yearsOfExperience: string
}

export interface SensitiveAnswer {
  value: string
  autofillEnabled: boolean
}

export interface Profile {
  version: 1
  personal: PersonalInfo
  links: LinkInfo
  education: EducationEntry[]
  employment: EmploymentEntry[]
  defaults: ApplicationDefaults
  sensitive: Record<SensitiveCategory, SensitiveAnswer>
  skills: string[]
  resumeFileName: string
}

export type RepeatingField = Extract<
  CanonicalField,
  | 'school'
  | 'degree'
  | 'major'
  | 'minor'
  | 'educationStart'
  | 'graduationDate'
  | 'gpa'
  | 'company'
  | 'jobTitle'
  | 'employmentStart'
  | 'employmentEnd'
  | 'currentPosition'
  | 'employmentLocation'
  | 'employmentDescription'
>

export const EDUCATION_FIELDS: RepeatingField[] = [
  'school',
  'degree',
  'major',
  'minor',
  'educationStart',
  'graduationDate',
  'gpa',
]
export const EMPLOYMENT_FIELDS: RepeatingField[] = [
  'company',
  'jobTitle',
  'employmentStart',
  'employmentEnd',
  'currentPosition',
  'employmentLocation',
  'employmentDescription',
]
