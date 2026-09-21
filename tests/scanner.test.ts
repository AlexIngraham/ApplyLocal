import { beforeEach, describe, expect, it } from 'vitest'
import { applyDetectedFields, undoField } from '@/content/apply'
import { scanDocument } from '@/content/scanner'
import { fieldById, renderFixture, scanFixture, testProfile, testSettings } from './helpers'

beforeEach(() => {
  document.body.innerHTML = ''
  document.title = ''
})

describe('fixture scanning', () => {
  it('scans a greenhouse form without visiting the live site', () => {
    const result = scanFixture('greenhouse.html', 'https://boards.greenhouse.io/acme/jobs/123')
    expect(result.ats).toBe('greenhouse')
    expect(fieldById(result.fields, 'first_name')).toMatchObject({
      canonical: 'firstName',
      plan: 'autofill',
      proposedValue: 'Jordan',
    })
    expect(fieldById(result.fields, 'work_auth')?.canonical).toBe('workAuthorization')
    expect(fieldById(result.fields, 'future_sponsor')?.canonical).toBe('requiresFutureSponsorship')
    expect(fieldById(result.fields, 'gender')).toMatchObject({ canonical: 'sensitive.gender', fillBand: 'blocked' })
    const schools = result.fields.filter((field) => field.canonical === 'school')
    expect(schools.map((field) => field.repeatIndex)).toEqual([0, 1])
    expect(schools.map((field) => field.proposedValue)).toEqual(['State University', 'City College'])
    expect(fieldById(result.fields, 'emp_start')).toMatchObject({ canonical: 'employmentStart' })
    expect(fieldById(result.fields, 'emp_start')?.confidence).toBeGreaterThanOrEqual(0.9)
    expect(fieldById(result.fields, 'bare_start')?.canonical).not.toBe('employmentStart')
  })

  it('still recognizes greenhouse labels when site adapters are off', () => {
    const result = scanFixture('greenhouse.html', 'https://boards.greenhouse.io/acme/jobs/123', testSettings({ enableSiteAdapters: false }))
    expect(result.ats).toBe('generic')
    expect(fieldById(result.fields, 'first_name')?.canonical).toBe('firstName')
  })

  it('scans a lever form and keeps location separate from relocation', () => {
    const result = scanFixture('lever.html', 'https://jobs.lever.co/spotify/abc')
    expect(result.ats).toBe('lever')
    expect(fieldById(result.fields, 'name')).toMatchObject({ canonical: 'fullName', proposedValue: 'Jordan Lee' })
    expect(fieldById(result.fields, 'location')?.canonical).toBe('city')
    expect(fieldById(result.fields, 'location')?.canonical).not.toBe('relocation')
    expect(fieldById(result.fields, 'org')?.canonical).toBe('company')
    expect(fieldById(result.fields, 'github')?.canonical).toBe('github')
    expect(fieldById(result.fields, 'sponsor')?.canonical).toBe('requiresFutureSponsorship')
    expect(fieldById(result.fields, 'resume')?.fillBand).toBe('blocked')
  })

  it('scans a generic application form and skips honeypots and sensitive questions', () => {
    const result = scanFixture('generic.html', 'https://example.com/jobs/1')
    expect(result.ats).toBe('generic')
    expect(fieldById(result.fields, 'given')?.canonical).toBe('firstName')
    expect(fieldById(result.fields, 'surname')?.canonical).toBe('lastName')
    expect(fieldById(result.fields, 'mail')?.canonical).toBe('email')
    expect(fieldById(result.fields, 'trap')).toBeUndefined()
    expect(fieldById(result.fields, 'gender')?.fillBand).toBe('blocked')
    expect(fieldById(result.fields, 'visa')?.canonical).toBe('requiresSponsorship')
    const relocate = result.fields.find((field) => field.canonical === 'relocation')
    expect(relocate?.control.kind).toBe('radio')
  })
})

describe('autofill', () => {
  it('fills empty greenhouse controls and does not submit anything', () => {
    const { fields } = scanFixture('greenhouse.html', 'https://boards.greenhouse.io/acme/jobs/123')
    applyDetectedFields(fields, 'auto')
    expect((document.getElementById('first_name') as HTMLInputElement).value).toBe('Jordan')
    expect((document.getElementById('email') as HTMLInputElement).value).toBe('jordan.lee@example.com')
    expect((document.getElementById('work_auth') as HTMLSelectElement).value).toBe('yes')
    expect((document.getElementById('future_sponsor') as HTMLSelectElement).value).toBe('no')
    expect((document.getElementById('school_1') as HTMLInputElement).value).toBe('State University')
    expect((document.getElementById('school_2') as HTMLInputElement).value).toBe('City College')
    expect((document.getElementById('emp_start') as HTMLInputElement).value).toBe('2022-06')
    expect((document.getElementById('gender') as HTMLSelectElement).value).toBe('')
    expect((document.getElementById('bare_start') as HTMLInputElement).value).toBe('')
    expect(document.querySelector('[type="submit"]')).toBeNull()
  })

  it('does not overwrite a value the user already entered', () => {
    const { fields } = scanFixture('greenhouse.html', 'https://boards.greenhouse.io/acme/jobs/123')
    const email = document.getElementById('email') as HTMLInputElement
    email.value = 'kept@example.com'
    applyDetectedFields(fields, 'auto')
    expect(email.value).toBe('kept@example.com')
    expect(fieldById(fields, 'email')?.status).toBe('manual')
  })

  it('fills generic radios and checkboxes, and undo restores the previous value', () => {
    const { fields } = scanFixture('generic.html', 'https://example.com/jobs/1')
    applyDetectedFields(fields, 'auto')
    expect((document.getElementById('auth') as HTMLInputElement).checked).toBe(true)
    expect((document.querySelector('input[name="relocate"][value="yes"]') as HTMLInputElement).checked).toBe(true)
    expect((document.getElementById('visa') as HTMLSelectElement).value).toBe('no')
    expect((document.getElementById('gender') as HTMLSelectElement).value).toBe('')
    expect((document.getElementById('trap') as HTMLInputElement).value).toBe('')
    const given = fieldById(fields, 'given')
    expect((document.getElementById('given') as HTMLInputElement).value).toBe('Jordan')
    if (!given) throw new Error('missing given name')
    undoField(given)
    expect((document.getElementById('given') as HTMLInputElement).value).toBe('')
    expect(given.locked).toBe(true)
  })

  it('fills high-confidence fields from the page button even when automatic fill is off', () => {
    const { fields } = scanFixture(
      'generic.html',
      'https://example.com/jobs/1',
      testSettings({ autoFillHighConfidence: false }),
    )
    expect(fieldById(fields, 'given')?.plan).toBe('review')
    expect(fieldById(fields, 'given')?.fillBand).toBe('high')
    applyDetectedFields(fields, 'auto')
    expect((document.getElementById('given') as HTMLInputElement).value).toBe('')
    applyDetectedFields(fields, 'page')
    expect((document.getElementById('given') as HTMLInputElement).value).toBe('Jordan')
  })

  it('can autofill a sensitive answer only after that category is explicitly enabled', () => {
    const profile = testProfile()
    profile.sensitive.gender = { value: 'decline', autofillEnabled: true }
    renderFixture('greenhouse.html')
    const blocked = scanDocument(document, {
      url: 'https://boards.greenhouse.io/acme/jobs/123',
      profile: testProfile(),
      settings: testSettings(),
    })
    expect(fieldById(blocked.fields, 'gender')?.fillBand).toBe('blocked')
    renderFixture('greenhouse.html')
    const allowed = scanDocument(document, {
      url: 'https://boards.greenhouse.io/acme/jobs/123',
      profile,
      settings: testSettings({ neverAutofillSensitive: false }),
    })
    expect(fieldById(allowed.fields, 'gender')).toMatchObject({ fillBand: 'high', proposedValue: 'decline' })
  })
})
