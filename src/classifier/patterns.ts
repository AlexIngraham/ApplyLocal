import type { CanonicalField, Candidate } from '@/classifier/types'
import { hasSequence, normalize } from '@/classifier/normalize'

type Reject = (tokens: string[], text: string) => boolean

interface SeqRule {
  key: CanonicalField
  sequence: string[]
  confidence: number
  label: string
  reject?: Reject
}

function seq(key: CanonicalField, phrase: string, confidence: number, reject?: Reject): SeqRule {
  return { key, sequence: phrase.split(' '), confidence, label: phrase, reject }
}

const phoneReject: Reject = (tokens) =>
  ['emergency', 'fax', 'reference', 'supervisor', 'extension', 'ext'].some((token) => tokens.includes(token))
const emailReject: Reject = (tokens) =>
  ['emergency', 'reference', 'supervisor', 'manager'].some((token) => tokens.includes(token))
const addressReject: Reject = (tokens) =>
  ['email', 'ip', 'apt', 'apartment', 'unit', 'suite', '2', 'second'].some((token) => tokens.includes(token))
const cityReject: Reject = (tokens) => tokens.includes('citizenship') || tokens.includes('capacity')
const stateReject: Reject = (tokens, text) =>
  tokens.includes('statement') || tokens.includes('united') || tokens.includes('status') || /\bplease state\b/.test(text)
const minorReject: Reject = (tokens) => tokens.some((token) => token.startsWith('minorit'))
const schoolReject: Reject = (tokens) => tokens.includes('year')
const companyReject: Reject = (tokens) => tokens.includes('email') || tokens.includes('phone')

const TOKEN_RULES: SeqRule[] = [
  seq('preferredName', 'preferred name', 0.97),
  seq('preferredName', 'chosen name', 0.96),
  seq('preferredName', 'nickname', 0.95),
  seq('firstName', 'legal first name', 0.98),
  seq('firstName', 'first name', 0.97),
  seq('firstName', 'given name', 0.97),
  seq('firstName', 'firstname', 0.97),
  seq('firstName', 'givenname', 0.96),
  seq('firstName', 'fname', 0.96),
  seq('middleName', 'middle name', 0.96),
  seq('middleName', 'middle initial', 0.95),
  seq('middleName', 'middlename', 0.96),
  seq('middleName', 'mname', 0.95),
  seq('lastName', 'legal last name', 0.98),
  seq('lastName', 'last name', 0.97),
  seq('lastName', 'family name', 0.97),
  seq('lastName', 'surname', 0.97),
  seq('lastName', 'lastname', 0.97),
  seq('lastName', 'familyname', 0.96),
  seq('lastName', 'lname', 0.96),
  seq('fullName', 'full name', 0.95),
  seq('fullName', 'legal name', 0.93),
  seq('fullName', 'your name', 0.9, (tokens) => tokens.length > 3),
  seq('fullName', 'name', 0.9),
  seq('email', 'email address', 0.98, emailReject),
  seq('email', 'email', 0.97, emailReject),
  seq('phoneExtension', 'phone extension', 0.98),
  seq('phoneExtension', 'telephone extension', 0.97),
  seq('phoneExtension', 'extension', 0.94),
  seq('phoneExtension', 'ext', 0.92),
  seq('phone', 'phone number', 0.97, phoneReject),
  seq('phone', 'mobile phone', 0.97, phoneReject),
  seq('phone', 'cell phone', 0.96, phoneReject),
  seq('phone', 'phone', 0.96, phoneReject),
  seq('phone', 'mobile', 0.95, phoneReject),
  seq('phone', 'telephone', 0.95, phoneReject),
  seq('phone', 'cell', 0.9, phoneReject),
  seq('phone', 'tel', 0.9, phoneReject),
  seq('addressLine2', 'address line 2', 0.98),
  seq('addressLine2', 'address line two', 0.98),
  seq('addressLine2', 'address 2', 0.98),
  seq('addressLine2', 'address2', 0.97),
  seq('addressLine2', 'apartment suite unit', 0.96),
  seq('addressLine2', 'apartment', 0.94),
  seq('addressLine2', 'apt', 0.94),
  seq('addressLine2', 'suite', 0.94),
  seq('addressLine2', 'unit', 0.92),
  seq('address', 'street address', 0.96, addressReject),
  seq('address', 'address line 1', 0.95, addressReject),
  seq('address', 'address1', 0.94, addressReject),
  seq('address', 'street', 0.9, addressReject),
  seq('address', 'address', 0.9, addressReject),
  seq('city', 'current location', 0.86, cityReject),
  seq('city', 'city', 0.95, cityReject),
  seq('city', 'town', 0.9, cityReject),
  seq('city', 'location', 0.78, cityReject),
  seq('county', 'county of residence', 0.97),
  seq('county', 'county', 0.96),
  seq('state', 'state province', 0.9, stateReject),
  seq('state', 'province', 0.92, stateReject),
  seq('state', 'state', 0.93, stateReject),
  seq('state', 'region', 0.75, stateReject),
  seq('zip', 'postal code', 0.96),
  seq('zip', 'zip code', 0.96),
  seq('zip', 'postcode', 0.95),
  seq('zip', 'zip', 0.95),
  seq('country', 'country of residence', 0.96),
  seq('country', 'country', 0.95),
  seq('linkedin', 'linkedin profile', 0.97),
  seq('linkedin', 'linkedin url', 0.97),
  seq('linkedin', 'linked in', 0.95),
  seq('linkedin', 'linkedin', 0.96),
  seq('github', 'github profile', 0.97),
  seq('github', 'github url', 0.97),
  seq('github', 'git hub', 0.95),
  seq('github', 'github', 0.96),
  seq('projectWebsite', 'project website', 0.98),
  seq('projectWebsite', 'project site', 0.97),
  seq('projectWebsite', 'project url', 0.97),
  seq('portfolio', 'portfolio website', 0.97),
  seq('portfolio', 'portfolio site', 0.96),
  seq('portfolio', 'portfolio url', 0.95),
  seq('portfolio', 'portfolio', 0.95),
  seq('website', 'personal website', 0.96),
  seq('website', 'personal site', 0.95),
  seq('website', 'website url', 0.95),
  seq('website', 'personal url', 0.94),
  seq('website', 'other website', 0.93),
  seq('website', 'website', 0.9),
  seq('school', 'school name', 0.95, schoolReject),
  seq('school', 'university', 0.94, schoolReject),
  seq('school', 'college', 0.94, schoolReject),
  seq('school', 'institution', 0.88, schoolReject),
  seq('school', 'school', 0.93, schoolReject),
  seq('degree', 'highest degree', 0.95),
  seq('degree', 'level of education', 0.9),
  seq('degree', 'degree', 0.94),
  seq('degree', 'qualification', 0.86),
  seq('major', 'field of study', 0.94),
  seq('major', 'area of study', 0.93),
  seq('major', 'concentration', 0.88),
  seq('major', 'major', 0.95),
  seq('minor', 'academic minor', 0.94, minorReject),
  seq('minor', 'minor field', 0.93, minorReject),
  seq('minor', 'minor', 0.93, minorReject),
  seq('gpa', 'grade point average', 0.97),
  seq('gpa', 'grade point', 0.94),
  seq('gpa', 'gpa', 0.96),
  seq('company', 'company name', 0.95, companyReject),
  seq('company', 'current company', 0.94, companyReject),
  seq('company', 'employer', 0.94, companyReject),
  seq('company', 'organization', 0.9, companyReject),
  seq('company', 'company', 0.94, companyReject),
  seq('company', 'org', 0.84, companyReject),
  seq('jobTitle', 'job title', 0.96),
  seq('jobTitle', 'position title', 0.95),
  seq('jobTitle', 'role title', 0.93),
  seq('jobTitle', 'job position', 0.9),
  seq('jobTitle', 'title', 0.78),
  seq('jobTitle', 'position', 0.8),
  seq('jobTitle', 'role', 0.74),
  seq('employmentLocation', 'office location', 0.9),
  seq('employmentLocation', 'work location', 0.9),
  seq('employmentLocation', 'job location', 0.88),
  seq('currentPosition', 'i currently work here', 0.95),
  seq('currentPosition', 'currently work here', 0.94),
  seq('currentPosition', 'current position', 0.93),
  seq('currentPosition', 'current employer', 0.9),
  seq('currentPosition', 'currently work', 0.9),
  seq('employmentDescription', 'role description', 0.88),
  seq('employmentDescription', 'position description', 0.88),
  seq('employmentDescription', 'responsibilities', 0.86),
  seq('workAuthorization', 'work authorization', 0.96),
  seq('workAuthorization', 'authorization to work', 0.96),
  seq('workAuthorization', 'authorized to work', 0.96),
  seq('workAuthorization', 'legally authorized', 0.95),
  seq('workAuthorization', 'eligible to work', 0.95),
  seq('workAuthorization', 'right to work', 0.94),
  seq('requiresFutureSponsorship', 'future sponsorship', 0.96),
  seq('requiresSponsorship', 'visa sponsorship', 0.93),
  seq('requiresSponsorship', 'require sponsorship', 0.9),
  seq('requiresSponsorship', 'sponsorship', 0.82),
  seq('relocation', 'willing to relocate', 0.96),
  seq('relocation', 'open to relocation', 0.95),
  seq('relocation', 'willing to move', 0.86),
  seq('relocation', 'relocation', 0.93),
  seq('relocation', 'relocate', 0.9),
  seq('desiredSalary', 'salary expectation', 0.95),
  seq('desiredSalary', 'salary expectations', 0.95),
  seq('desiredSalary', 'desired salary', 0.95),
  seq('desiredSalary', 'expected salary', 0.94),
  seq('desiredSalary', 'compensation expectation', 0.93),
  seq('desiredSalary', 'compensation', 0.8),
  seq('desiredSalary', 'salary', 0.8),
  seq('noticePeriod', 'notice period', 0.94),
  seq('noticePeriod', 'available to start', 0.9),
  seq('noticePeriod', 'earliest start', 0.88),
  seq('yearsOfExperience', 'years of experience', 0.94),
  seq('yearsOfExperience', 'years experience', 0.92),
  seq('workPreference', 'work preference', 0.92),
  seq('workPreference', 'location preference', 0.9),
  seq('workPreference', 'work arrangement', 0.9),
  seq('graduationYear', 'graduation year', 0.95),
  seq('graduationYear', 'year of graduation', 0.95),
  seq('graduationDate', 'expected graduation date', 0.94),
  seq('graduationDate', 'expected graduation', 0.92),
  seq('graduationDate', 'graduation date', 0.94),
  seq('graduationDate', 'date of graduation', 0.94),
  seq('skills', 'technical skills', 0.88),
  seq('skills', 'skills', 0.86),
  seq('resume', 'resume upload', 0.97),
  seq('resume', 'resume cv', 0.95),
  seq('resume', 'resume', 0.95),
  seq('resume', 'cv', 0.9),
]

const AUTOCOMPLETE: Record<string, { key: CanonicalField; confidence: number }> = {
  'given-name': { key: 'firstName', confidence: 0.99 },
  'family-name': { key: 'lastName', confidence: 0.99 },
  'additional-name': { key: 'middleName', confidence: 0.98 },
  nickname: { key: 'preferredName', confidence: 0.96 },
  email: { key: 'email', confidence: 0.99 },
  tel: { key: 'phone', confidence: 0.98 },
  'tel-national': { key: 'phone', confidence: 0.98 },
  'tel-extension': { key: 'phoneExtension', confidence: 0.99 },
  'street-address': { key: 'address', confidence: 0.98 },
  'address-line1': { key: 'address', confidence: 0.98 },
  'address-line2': { key: 'addressLine2', confidence: 0.99 },
  'address-level2': { key: 'city', confidence: 0.97 },
  'address-level1': { key: 'state', confidence: 0.97 },
  'postal-code': { key: 'zip', confidence: 0.98 },
  country: { key: 'country', confidence: 0.97 },
  'country-name': { key: 'country', confidence: 0.97 },
  organization: { key: 'company', confidence: 0.95 },
  'organization-title': { key: 'jobTitle', confidence: 0.95 },
}

export function matchTokenRules(tokens: string[], text: string, mode: 'strict' | 'loose'): Candidate[] {
  const best = new Map<CanonicalField, Candidate>()
  for (const rule of TOKEN_RULES) {
    if (mode === 'loose' && rule.sequence.length < 2) continue
    if (mode === 'strict' && rule.sequence.length === 1 && tokens.length > 3) continue
    if (rule.reject?.(tokens, text)) continue
    if (!hasSequence(tokens, rule.sequence)) continue
    const confidence = mode === 'loose' ? Math.min(rule.confidence, 0.8) : rule.confidence
    const candidate: Candidate = {
      key: rule.key,
      confidence,
      reason: `“${rule.label}”`,
      specificity: rule.sequence.length,
    }
    const current = best.get(rule.key)
    if (
      !current ||
      candidate.specificity > current.specificity ||
      (candidate.specificity === current.specificity && candidate.confidence > current.confidence)
    ) {
      best.set(rule.key, candidate)
    }
  }
  return [...best.values()]
}

export function matchAutocomplete(raw: string): Candidate | null {
  const token = raw.trim().toLowerCase().split(/\s+/).pop() ?? ''
  const found = AUTOCOMPLETE[token]
  if (!found) return null
  return {
    key: found.key,
    confidence: found.confidence,
    reason: `Autocomplete “${token}”`,
    specificity: 4,
  }
}

function hasSponsor(text: string): boolean {
  return /\bsponsor(?:ship|ed)?\b/.test(text) || /\bvisa\b/.test(text)
}

function hasFuture(text: string): boolean {
  return /\bfuture\b/.test(text) || /\bnow or in the future\b/.test(text)
}

function hasAuth(text: string): boolean {
  return (
    /\bauthori[sz]ed to work\b/.test(text) ||
    /\blegally authori[sz]ed\b/.test(text) ||
    /\bwork authori[sz]ation\b/.test(text) ||
    /\bauthori[sz]ation to work\b/.test(text) ||
    /\beligible to work\b/.test(text) ||
    /\bright to work\b/.test(text)
  )
}

export function mixesAuthorizationAndSponsorship(text: string): boolean {
  return hasAuth(text) && hasSponsor(text)
}

export function matchQuestion(text: string): Candidate | null {
  if (text.length < 8) return null
  if (mixesAuthorizationAndSponsorship(text)) return null
  if (hasSponsor(text) && hasFuture(text)) {
    return {
      key: 'requiresFutureSponsorship',
      confidence: 0.96,
      reason: 'Question asks about sponsorship in the future',
      specificity: 4,
    }
  }
  if (hasSponsor(text) && /\b(require|requiring|need|needed|needs)\b/.test(text)) {
    return {
      key: 'requiresSponsorship',
      confidence: 0.95,
      reason: 'Question asks about needing sponsorship',
      specificity: 4,
    }
  }
  if (hasAuth(text)) {
    return {
      key: 'workAuthorization',
      confidence: 0.96,
      reason: 'Question asks about work authorization',
      specificity: 4,
    }
  }
  if (/\brelocat(?:e|ion|ing)\b/.test(text) || /\bwilling to move\b/.test(text)) {
    return {
      key: 'relocation',
      confidence: 0.95,
      reason: 'Question asks about relocation',
      specificity: 4,
    }
  }
  if (
    /\b(desired|expected|target)\s+(salary|compensation|pay)\b/.test(text) ||
    /\bsalary expectation/.test(text) ||
    /\bcompensation expectation/.test(text)
  ) {
    return {
      key: 'desiredSalary',
      confidence: 0.95,
      reason: 'Question asks about desired pay',
      specificity: 4,
    }
  }
  if (/\bnotice period\b/.test(text) || /\bwhen can you start\b/.test(text) || /\bearliest start\b/.test(text)) {
    return {
      key: 'noticePeriod',
      confidence: 0.92,
      reason: 'Question asks about availability or notice period',
      specificity: 4,
    }
  }
  if (/\byears of (?:work |professional |relevant )?experience\b/.test(text) || /\bhow many years\b/.test(text)) {
    return {
      key: 'yearsOfExperience',
      confidence: 0.92,
      reason: 'Question asks about years of experience',
      specificity: 4,
    }
  }
  if (/\bgraduation year\b/.test(text) || /\byear of graduation\b/.test(text)) {
    return {
      key: 'graduationYear',
      confidence: 0.95,
      reason: 'Question asks for graduation year',
      specificity: 4,
    }
  }
  if (/\bgraduation date\b/.test(text) || /\bdate of graduation\b/.test(text)) {
    return {
      key: 'graduationDate',
      confidence: 0.94,
      reason: 'Question asks for graduation date',
      specificity: 4,
    }
  }
  if (/\b(remote|hybrid|on site)\b/.test(text) && /\b(preference|prefer|arrangement)\b/.test(text)) {
    return {
      key: 'workPreference',
      confidence: 0.9,
      reason: 'Question asks about remote, hybrid, or onsite work',
      specificity: 4,
    }
  }
  return null
}

export function matchDate(text: string, section: 'education' | 'employment' | 'unknown'): Candidate | null {
  if (/\bgraduation year\b|\byear of graduation\b|\byear graduated\b/.test(text)) {
    return { key: 'graduationYear', confidence: 0.95, reason: 'Label mentions graduation year', specificity: 3 }
  }
  if (/\bgraduation date\b|\bdate of graduation\b|\bgraduated\b/.test(text)) {
    return { key: 'graduationDate', confidence: 0.94, reason: 'Label mentions graduation date', specificity: 3 }
  }
  const contextualStart = section !== 'unknown' && /^(from|from month|from year)$/.test(text)
  const contextualEnd = section !== 'unknown' && /^(to|to month|to year)$/.test(text)
  const isStart = /\b(start|begin) (date|month|year)\b/.test(text) || text === 'start' || text === 'start date' || contextualStart
  const isEnd = /\b(end|to) (date|month|year)\b/.test(text) || text === 'end date' || contextualEnd
  if (!isStart && !isEnd) return null
  if (section === 'education' || /\b(education|school|degree|academic)\b/.test(text)) {
    return isStart
      ? { key: 'educationStart', confidence: 0.92, reason: 'Start date in an education section', specificity: 3 }
      : { key: 'graduationDate', confidence: 0.84, reason: 'End date in an education section', specificity: 3 }
  }
  if (section === 'employment' || /\b(employment|employer|work|job|position|company)\b/.test(text)) {
    return isStart
      ? { key: 'employmentStart', confidence: 0.92, reason: 'Start date in an employment section', specificity: 3 }
      : { key: 'employmentEnd', confidence: 0.92, reason: 'End date in an employment section', specificity: 3 }
  }
  return null
}

export function matchOptionHints(text: string): Candidate | null {
  const normalized = normalize(text)
  if (!normalized) return null
  const preferenceHits = ['remote', 'hybrid', 'onsite', 'on site', 'in office'].filter((item) => normalized.includes(item))
  if (preferenceHits.length >= 2) {
    return {
      key: 'workPreference',
      confidence: 0.86,
      reason: 'Answer choices look like a work-location preference',
      specificity: 2,
    }
  }
  const degreeHits = ['bachelor', 'master', 'phd', 'doctorate', 'associate', 'high school'].filter((item) =>
    normalized.includes(item),
  )
  if (degreeHits.length >= 2) {
    return {
      key: 'degree',
      confidence: 0.8,
      reason: 'Answer choices look like academic degrees',
      specificity: 2,
    }
  }
  return null
}
