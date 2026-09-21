import { SENSITIVE_CATEGORIES } from '@/profile/types'
import type {
  ApplicationDefaults,
  EducationEntry,
  EmploymentEntry,
  LinkInfo,
  PersonalInfo,
  Profile,
  SensitiveAnswer,
  SensitiveCategory,
} from '@/profile/types'

export const PROFILE_KEY = 'profile'

export function createId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`
  }
  return `${prefix}-${Date.now()}`
}

export function emptyPersonal(): PersonalInfo {
  return {
    firstName: '',
    middleName: '',
    lastName: '',
    preferredName: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    zip: '',
    country: '',
  }
}

export function emptyLinks(): LinkInfo {
  return { linkedin: '', github: '', portfolio: '' }
}

export function emptyDefaults(): ApplicationDefaults {
  return {
    workAuthorization: '',
    requiresSponsorship: '',
    requiresFutureSponsorship: '',
    willingToRelocate: '',
    workPreference: '',
    desiredSalary: '',
    noticePeriod: '',
    graduationYear: '',
    yearsOfExperience: '',
  }
}

export function emptyEducation(): EducationEntry {
  return {
    id: createId('edu'),
    school: '',
    degree: '',
    major: '',
    minor: '',
    startDate: '',
    graduationDate: '',
    gpa: '',
  }
}

export function emptyEmployment(): EmploymentEntry {
  return {
    id: createId('job'),
    company: '',
    jobTitle: '',
    startDate: '',
    endDate: '',
    current: false,
    location: '',
    description: '',
  }
}

function emptySensitive(): Record<SensitiveCategory, SensitiveAnswer> {
  return SENSITIVE_CATEGORIES.reduce(
    (acc, category) => {
      acc[category] = { value: '', autofillEnabled: false }
      return acc
    },
    {} as Record<SensitiveCategory, SensitiveAnswer>,
  )
}

export function createDefaultProfile(): Profile {
  return {
    version: 1,
    personal: emptyPersonal(),
    links: emptyLinks(),
    education: [],
    employment: [],
    defaults: emptyDefaults(),
    sensitive: emptySensitive(),
    skills: [],
    resumeFileName: '',
  }
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function asBool(value: unknown): boolean {
  return value === true
}

export function mergeProfile(value: unknown): Profile {
  const base = createDefaultProfile()
  if (!value || typeof value !== 'object') return base
  const raw = value as Partial<Profile>
  const personal = { ...base.personal, ...(raw.personal ?? {}) }
  const links = { ...base.links, ...(raw.links ?? {}) }
  const defaults = { ...base.defaults, ...(raw.defaults ?? {}) }
  const sensitive = { ...base.sensitive }
  if (raw.sensitive && typeof raw.sensitive === 'object') {
    for (const category of SENSITIVE_CATEGORIES) {
      const answer = raw.sensitive[category]
      if (!answer) continue
      sensitive[category] = {
        value: asString(answer.value),
        autofillEnabled: asBool(answer.autofillEnabled),
      }
    }
  }
  return {
    version: 1,
    personal: {
      firstName: asString(personal.firstName),
      middleName: asString(personal.middleName),
      lastName: asString(personal.lastName),
      preferredName: asString(personal.preferredName),
      email: asString(personal.email),
      phone: asString(personal.phone),
      address: asString(personal.address),
      city: asString(personal.city),
      state: asString(personal.state),
      zip: asString(personal.zip),
      country: asString(personal.country),
    },
    links: {
      linkedin: asString(links.linkedin),
      github: asString(links.github),
      portfolio: asString(links.portfolio),
    },
    education: Array.isArray(raw.education)
      ? raw.education.map((entry) => ({
          id: asString(entry?.id) || createId('edu'),
          school: asString(entry?.school),
          degree: asString(entry?.degree),
          major: asString(entry?.major),
          minor: asString(entry?.minor),
          startDate: asString(entry?.startDate),
          graduationDate: asString(entry?.graduationDate),
          gpa: asString(entry?.gpa),
        }))
      : [],
    employment: Array.isArray(raw.employment)
      ? raw.employment.map((entry) => ({
          id: asString(entry?.id) || createId('job'),
          company: asString(entry?.company),
          jobTitle: asString(entry?.jobTitle),
          startDate: asString(entry?.startDate),
          endDate: asString(entry?.endDate),
          current: asBool(entry?.current),
          location: asString(entry?.location),
          description: asString(entry?.description),
        }))
      : [],
    defaults: {
      workAuthorization: yesNo(defaults.workAuthorization),
      requiresSponsorship: yesNo(defaults.requiresSponsorship),
      requiresFutureSponsorship: yesNo(defaults.requiresFutureSponsorship),
      willingToRelocate: yesNo(defaults.willingToRelocate),
      workPreference: preference(defaults.workPreference),
      desiredSalary: asString(defaults.desiredSalary),
      noticePeriod: asString(defaults.noticePeriod),
      graduationYear: asString(defaults.graduationYear),
      yearsOfExperience: asString(defaults.yearsOfExperience),
    },
    sensitive,
    skills: Array.isArray(raw.skills) ? raw.skills.map((skill) => asString(skill)).filter(Boolean) : [],
    resumeFileName: asString(raw.resumeFileName),
  }
}

function yesNo(value: unknown): '' | 'yes' | 'no' {
  return value === 'yes' || value === 'no' ? value : ''
}

function preference(value: unknown): '' | 'remote' | 'hybrid' | 'onsite' {
  return value === 'remote' || value === 'hybrid' || value === 'onsite' ? value : ''
}

export function createSampleProfile(): Profile {
  const profile = createDefaultProfile()
  profile.personal = {
    firstName: 'Jordan',
    middleName: 'A',
    lastName: 'Lee',
    preferredName: 'Jordan',
    email: 'jordan.lee@example.com',
    phone: '555-0100',
    address: '100 Congress Ave',
    city: 'Austin',
    state: 'TX',
    zip: '78701',
    country: 'United States',
  }
  profile.links = {
    linkedin: 'https://www.linkedin.com/in/jordanlee-example',
    github: 'https://github.com/jordanlee-example',
    portfolio: 'https://jordanlee.example',
  }
  profile.education = [
    {
      id: 'edu-sample-1',
      school: 'State University',
      degree: 'B.S.',
      major: 'Computer Science',
      minor: 'Mathematics',
      startDate: '2016-08',
      graduationDate: '2020-05',
      gpa: '3.8',
    },
    {
      id: 'edu-sample-2',
      school: 'City College',
      degree: 'A.S.',
      major: 'General Studies',
      minor: '',
      startDate: '2014-08',
      graduationDate: '2016-05',
      gpa: '',
    },
  ]
  profile.employment = [
    {
      id: 'job-sample-1',
      company: 'Northwind Labs',
      jobTitle: 'Software Engineer',
      startDate: '2022-06',
      endDate: '',
      current: true,
      location: 'Austin, TX',
      description: 'Built internal tools used by the support team.',
    },
  ]
  profile.defaults = {
    workAuthorization: 'yes',
    requiresSponsorship: 'no',
    requiresFutureSponsorship: 'no',
    willingToRelocate: 'yes',
    workPreference: 'hybrid',
    desiredSalary: '150000',
    noticePeriod: '2 weeks',
    graduationYear: '2020',
    yearsOfExperience: '4',
  }
  profile.skills = ['TypeScript', 'React']
  profile.resumeFileName = 'Jordan-Lee-Resume.pdf'
  return profile
}
