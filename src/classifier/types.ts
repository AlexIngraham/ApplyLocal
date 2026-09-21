export const CANONICAL_FIELDS = [
  'firstName',
  'middleName',
  'lastName',
  'preferredName',
  'fullName',
  'email',
  'phone',
  'phoneExtension',
  'address',
  'addressLine2',
  'city',
  'county',
  'state',
  'zip',
  'country',
  'linkedin',
  'github',
  'portfolio',
  'website',
  'projectWebsite',
  'school',
  'degree',
  'major',
  'minor',
  'educationStart',
  'graduationDate',
  'graduationYear',
  'gpa',
  'company',
  'jobTitle',
  'employmentStart',
  'employmentEnd',
  'currentPosition',
  'employmentLocation',
  'employmentDescription',
  'workAuthorization',
  'requiresSponsorship',
  'requiresFutureSponsorship',
  'relocation',
  'workPreference',
  'desiredSalary',
  'noticePeriod',
  'yearsOfExperience',
  'skills',
  'resume',
  'sensitive.race',
  'sensitive.ethnicity',
  'sensitive.gender',
  'sensitive.disability',
  'sensitive.veteran',
  'sensitive.religion',
  'sensitive.sexualOrientation',
  'unknown',
] as const

export type CanonicalField = (typeof CANONICAL_FIELDS)[number]

export type SignalSource =
  | 'name'
  | 'id'
  | 'placeholder'
  | 'label'
  | 'aria'
  | 'legend'
  | 'nearby'
  | 'options'
  | 'autocomplete'

export type SectionKind = 'education' | 'employment' | 'unknown'

export interface TextSignal {
  source: SignalSource
  text: string
}

export interface ClassifyInput {
  signals: TextSignal[]
  controlType?: string
  section?: SectionKind
  adapterHint?: { key: CanonicalField; confidence: number; reason: string } | null
}

export interface Classification {
  key: CanonicalField
  confidence: number
  reason: string
  sensitive: boolean
}

export interface Candidate {
  key: CanonicalField
  confidence: number
  reason: string
  specificity: number
}

export const FIELD_LABELS: Record<CanonicalField, string> = {
  firstName: 'First name',
  middleName: 'Middle name',
  lastName: 'Last name',
  preferredName: 'Preferred name',
  fullName: 'Full name',
  email: 'Email',
  phone: 'Phone',
  phoneExtension: 'Phone extension',
  address: 'Address line 1',
  addressLine2: 'Address line 2',
  city: 'City',
  county: 'County',
  state: 'State',
  zip: 'ZIP',
  country: 'Country',
  linkedin: 'LinkedIn',
  github: 'GitHub',
  portfolio: 'Portfolio',
  website: 'Website',
  projectWebsite: 'Project website',
  school: 'School',
  degree: 'Degree',
  major: 'Major',
  minor: 'Minor',
  educationStart: 'Education start',
  graduationDate: 'Graduation date',
  graduationYear: 'Graduation year',
  gpa: 'GPA',
  company: 'Company',
  jobTitle: 'Job title',
  employmentStart: 'Employment start',
  employmentEnd: 'Employment end',
  currentPosition: 'Current position',
  employmentLocation: 'Work location',
  employmentDescription: 'Role description',
  workAuthorization: 'Work authorization',
  requiresSponsorship: 'Sponsorship now',
  requiresFutureSponsorship: 'Future sponsorship',
  relocation: 'Willing to relocate',
  workPreference: 'Work preference',
  desiredSalary: 'Desired salary',
  noticePeriod: 'Notice period',
  yearsOfExperience: 'Years of experience',
  skills: 'Skills',
  resume: 'Resume',
  'sensitive.race': 'Race',
  'sensitive.ethnicity': 'Ethnicity',
  'sensitive.gender': 'Gender',
  'sensitive.disability': 'Disability',
  'sensitive.veteran': 'Veteran status',
  'sensitive.religion': 'Religion',
  'sensitive.sexualOrientation': 'Sexual orientation',
  unknown: 'Unknown',
}

export function isSensitiveKey(key: CanonicalField): boolean {
  return key.startsWith('sensitive.')
}

export function isCanonicalField(value: string): value is CanonicalField {
  return (CANONICAL_FIELDS as readonly string[]).includes(value)
}
