import { isSensitiveKey } from '@/classifier/types'
import type { CanonicalField } from '@/classifier/types'
import type { Settings } from '@/settings/types'
import { SENSITIVE_CATEGORIES } from '@/profile/types'
import type { EducationEntry, EmploymentEntry, Profile, SensitiveCategory } from '@/profile/types'

function text(value: string | undefined): string | null {
  const trimmed = (value ?? '').trim()
  return trimmed ? trimmed : null
}

function educationAt(profile: Profile, index: number): EducationEntry | null {
  const entry = profile.education[index]
  if (!entry) return null
  const filled = [entry.school, entry.degree, entry.major, entry.minor, entry.startDate, entry.graduationDate, entry.gpa].some(
    (part) => part.trim(),
  )
  return filled ? entry : null
}

function employmentAt(profile: Profile, index: number): EmploymentEntry | null {
  const entry = profile.employment[index]
  if (!entry) return null
  const filled = [entry.company, entry.jobTitle, entry.startDate, entry.endDate, entry.location, entry.description].some((part) =>
    part.trim(),
  )
  if (!filled && !entry.current) return null
  return entry
}

export function sensitiveCategory(key: CanonicalField): SensitiveCategory | null {
  if (!isSensitiveKey(key)) return null
  const category = key.slice('sensitive.'.length)
  return SENSITIVE_CATEGORIES.find((item) => item === category) ?? null
}

export function resolveProfileValue(profile: Profile, key: CanonicalField, index: number): string | null {
  const { personal, links, defaults } = profile
  switch (key) {
    case 'firstName':
      return text(personal.firstName)
    case 'middleName':
      return text(personal.middleName)
    case 'lastName':
      return text(personal.lastName)
    case 'preferredName':
      return text(personal.preferredName)
    case 'fullName': {
      const legal = [personal.firstName, personal.lastName].map((part) => part.trim()).filter(Boolean).join(' ')
      return text(legal) ?? text(personal.preferredName)
    }
    case 'email':
      return text(personal.email)
    case 'phone':
      return text(personal.phone)
    case 'address':
      return text(personal.address)
    case 'city':
      return text(personal.city)
    case 'state':
      return text(personal.state)
    case 'zip':
      return text(personal.zip)
    case 'country':
      return text(personal.country)
    case 'linkedin':
      return text(links.linkedin)
    case 'github':
      return text(links.github)
    case 'portfolio':
      return text(links.portfolio)
    case 'school':
      return text(educationAt(profile, index)?.school)
    case 'degree':
      return text(educationAt(profile, index)?.degree)
    case 'major':
      return text(educationAt(profile, index)?.major)
    case 'minor':
      return text(educationAt(profile, index)?.minor)
    case 'educationStart':
      return text(educationAt(profile, index)?.startDate)
    case 'graduationDate':
      return text(educationAt(profile, index)?.graduationDate)
    case 'gpa':
      return text(educationAt(profile, index)?.gpa)
    case 'company':
      return text(employmentAt(profile, index)?.company)
    case 'jobTitle':
      return text(employmentAt(profile, index)?.jobTitle)
    case 'employmentStart':
      return text(employmentAt(profile, index)?.startDate)
    case 'employmentEnd':
      return text(employmentAt(profile, index)?.endDate)
    case 'currentPosition': {
      const job = employmentAt(profile, index)
      if (!job) return null
      return job.current ? 'yes' : 'no'
    }
    case 'employmentLocation':
      return text(employmentAt(profile, index)?.location)
    case 'employmentDescription':
      return text(employmentAt(profile, index)?.description)
    case 'workAuthorization':
      return text(defaults.workAuthorization)
    case 'requiresSponsorship':
      return text(defaults.requiresSponsorship)
    case 'requiresFutureSponsorship':
      return text(defaults.requiresFutureSponsorship)
    case 'relocation':
      return text(defaults.willingToRelocate)
    case 'workPreference':
      return text(defaults.workPreference)
    case 'desiredSalary':
      return text(defaults.desiredSalary)
    case 'noticePeriod':
      return text(defaults.noticePeriod)
    case 'graduationYear':
      return text(defaults.graduationYear) ?? yearFrom(educationAt(profile, 0)?.graduationDate)
    case 'yearsOfExperience':
      return text(defaults.yearsOfExperience)
    case 'skills': {
      const skills = profile.skills.map((skill) => skill.trim()).filter(Boolean)
      return skills.length ? skills.join(', ') : null
    }
    default:
      return null
  }
}

function yearFrom(value: string | undefined): string | null {
  const match = (value ?? '').match(/\d{4}/)
  return match ? match[0] : null
}

export function proposedValue(profile: Profile, settings: Settings, key: CanonicalField, index: number): string | null {
  const category = sensitiveCategory(key)
  if (category) {
    if (settings.neverAutofillSensitive) return null
    const answer = profile.sensitive[category]
    if (!answer.autofillEnabled) return null
    return text(answer.value)
  }
  return resolveProfileValue(profile, key, index)
}

export function sensitiveBlocked(profile: Profile, settings: Settings, key: CanonicalField): boolean {
  const category = sensitiveCategory(key)
  if (!category) return false
  if (settings.neverAutofillSensitive) return true
  return !profile.sensitive[category].autofillEnabled
}
