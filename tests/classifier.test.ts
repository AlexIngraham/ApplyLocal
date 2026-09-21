import { describe, expect, it } from 'vitest'
import { classify } from '@/classifier/classify'
import type { ClassifyInput, CanonicalField } from '@/classifier/types'
import { normalize, tokenize } from '@/classifier/normalize'

function fromLabel(text: string, extra: Partial<ClassifyInput> = {}) {
  return classify({ signals: [{ source: 'label', text }], ...extra })
}

function fromName(text: string) {
  return classify({ signals: [{ source: 'name', text }] })
}

describe('normalize', () => {
  it('splits camel case, brackets, and e-mail', () => {
    expect(normalize('firstName')).toBe('first name')
    expect(normalize('job_application[first_name]')).toBe('job application first name')
    expect(normalize('E-mail address')).toBe('email address')
    expect(tokenize('LinkedIn')).toEqual(['linked', 'in'])
  })
})

describe('classifier labels', () => {
  const cases: Array<[string, CanonicalField]> = [
    ['First Name', 'firstName'],
    ['Given name', 'firstName'],
    ['Legal First Name', 'firstName'],
    ['Surname', 'lastName'],
    ['Family Name', 'lastName'],
    ['E-mail address', 'email'],
    ['Mobile phone', 'phone'],
    ['Mobile', 'phone'],
    ['LinkedIn profile', 'linkedin'],
    ['LinkedIn URL', 'linkedin'],
    ['GitHub URL', 'github'],
    ['GitHub Profile', 'github'],
    ['University', 'school'],
    ['College', 'school'],
    ['School', 'school'],
    ['Degree', 'degree'],
    ['Major', 'major'],
    ['Minor', 'minor'],
    ['Graduation date', 'graduationDate'],
    ['Expected Graduation', 'graduationDate'],
    ['Eligible to work', 'workAuthorization'],
    ['Legally authorized to work', 'workAuthorization'],
    ['Require visa sponsorship', 'requiresSponsorship'],
    ['Require future sponsorship', 'requiresFutureSponsorship'],
    ['Willing to relocate', 'relocation'],
    ['Desired salary', 'desiredSalary'],
  ]

  it.each(cases)('maps %s to %s', (label, key) => {
    const result = fromLabel(label)
    expect(result.key).toBe(key)
    expect(result.confidence).toBeGreaterThanOrEqual(0.9)
  })

  it('maps known name attributes', () => {
    expect(fromName('first_name').key).toBe('firstName')
    expect(fromName('fname').key).toBe('firstName')
    expect(fromName('job_application[first_name]').key).toBe('firstName')
    expect(fromName('candidate[first_name]').key).toBe('firstName')
    expect(fromName('first_name').confidence).toBeGreaterThanOrEqual(0.9)
  })

  it('keeps sponsorship questions distinct', () => {
    const future = fromLabel('Will you now or in the future require employer sponsorship?')
    const later = fromLabel('Will you require visa sponsorship in the future?')
    const now = fromLabel('Do you require sponsorship now?')
    const visa = fromLabel('Will you require visa sponsorship now?')
    expect(future.key).toBe('requiresFutureSponsorship')
    expect(later.key).toBe('requiresFutureSponsorship')
    expect(now.key).toBe('requiresSponsorship')
    expect(visa.key).toBe('requiresSponsorship')
    expect(future.key).not.toBe(now.key)
  })

  it('does not treat work authorization as sponsorship', () => {
    const result = fromLabel('Are you legally authorized to work in the United States?')
    expect(result.key).toBe('workAuthorization')
    expect(result.confidence).toBeGreaterThanOrEqual(0.9)
  })

  it('leaves mixed authorization and sponsorship questions for review', () => {
    const result = fromLabel('Are you legally authorized to work, or will you require sponsorship?')
    expect(result.confidence).toBeLessThan(0.9)
    expect(['workAuthorization', 'requiresSponsorship', 'requiresFutureSponsorship']).toContain(result.key)
  })

  it('does not confuse nearby or similar wording', () => {
    expect(fromLabel('Preferred name').key).toBe('preferredName')
    expect(fromLabel('Emergency contact phone').key).not.toBe('phone')
    expect(fromLabel('Emergency contact phone').confidence).toBeLessThan(0.65)
    expect(fromLabel('Location').key).not.toBe('relocation')
    expect(fromLabel('Location').key).toBe('city')
    expect(fromLabel('Please state your name').key).not.toBe('state')
    expect(fromLabel('Please state your name').confidence).toBeLessThan(0.65)
    expect(fromLabel('Email address').key).not.toBe('address')
    expect(fromLabel('Personal statement').key).not.toBe('state')
    expect(fromLabel('Are you a member of a minority group?').key).toBe('sensitive.ethnicity')
    expect(fromLabel('Minor').key).toBe('minor')
  })

  it('keeps demographic questions sensitive and specific', () => {
    expect(fromLabel('Gender').key).toBe('sensitive.gender')
    expect(fromLabel('Gender').sensitive).toBe(true)
    expect(fromLabel('Veteran status').key).toBe('sensitive.veteran')
    expect(fromLabel('Sexual orientation').key).toBe('sensitive.sexualOrientation')
    expect(fromLabel('Race/Ethnicity').key.startsWith('sensitive.')).toBe(true)
    expect(fromLabel('Disability')).toMatchObject({ key: 'sensitive.disability', sensitive: true })
  })

  it('does not let nearby equal-opportunity text mark an email field sensitive', () => {
    const result = classify({
      signals: [
        { source: 'label', text: 'Email' },
        { source: 'nearby', text: 'We are an equal opportunity employer and welcome all genders and veterans.' },
      ],
    })
    expect(result.key).toBe('email')
    expect(result.sensitive).toBe(false)
  })

  it('uses section context for dates and ignores a bare start date', () => {
    expect(fromLabel('Start date').confidence).toBeLessThan(0.65)
    expect(fromLabel('Start date', { section: 'employment' }).key).toBe('employmentStart')
    expect(fromLabel('Start date', { section: 'education' }).key).toBe('educationStart')
  })

  it('caps nearby-only matches below the autofill threshold', () => {
    const result = classify({ signals: [{ source: 'nearby', text: 'First Name' }] })
    expect(result.key).toBe('firstName')
    expect(result.confidence).toBeLessThanOrEqual(0.8)
  })

  it('trusts autocomplete and input type as separate signals', () => {
    const auto = classify({ signals: [{ source: 'autocomplete', text: 'given-name' }] })
    expect(auto.key).toBe('firstName')
    expect(auto.confidence).toBeGreaterThanOrEqual(0.9)
    const typed = classify({ signals: [], controlType: 'email' })
    expect(typed.key).toBe('email')
    expect(typed.confidence).toBeLessThan(0.9)
    expect(typed.confidence).toBeGreaterThanOrEqual(0.65)
  })

  it('downgrades contradictory name and label matches', () => {
    const result = classify({
      signals: [
        { source: 'name', text: 'email' },
        { source: 'label', text: 'Phone' },
      ],
    })
    expect(result.confidence).toBeLessThan(0.9)
  })
})
