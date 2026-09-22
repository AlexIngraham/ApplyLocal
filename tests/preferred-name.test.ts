import { expect, it } from 'vitest'
import { classify } from '@/classifier/classify'
import { resolveProfileValue } from '@/profile/resolve'
import { scanDocument } from '@/content/scanner'
import { applyDetectedFields } from '@/content/apply'
import { testProfile, testSettings } from './helpers'

it.each(['First Name', 'Legal First Name', 'Given Name'])('%s stays legal first name', (label) => {
  expect(classify({ signals: [{ source: 'label', text: label }] }).key).toBe('firstName')
})
it.each(['Preferred Name', 'Preferred First Name', 'Preferred Given Name', 'Chosen Name', 'Name You Go By', 'What name do you prefer?', 'Nickname'])('%s beats broad names, autocomplete and ATS hints', (label) => {
  const result = classify({ signals: [
    { source: 'label', text: label }, { source: 'name', text: 'first_name' },
    { source: 'autocomplete', text: 'given-name' },
  ], adapterHint: { key: 'firstName', confidence: 0.99, reason: 'Broad ATS hint' } })
  expect(result.key).toBe('preferredName')
  expect(result.confidence).toBeGreaterThanOrEqual(0.9)
})
it.each(['https://example.com/apply', 'https://acme.myworkdayjobs.com/job/1', 'https://boards.greenhouse.io/acme', 'https://jobs.lever.co/acme'])('fills the exact preferred value on %s', async (url) => {
  document.body.innerHTML = '<form><label>Legal First Name<input id="legal" name="first_name"></label><label>Preferred First Name<input id="preferred" name="first_name" autocomplete="given-name"></label></form>'
  const profile = testProfile()
  profile.personal.firstName = 'Alexander'
  profile.personal.preferredName = 'Alex'
  const fields = scanDocument(document, { url, profile, settings: testSettings() }).fields
  expect(fields.map((field) => field.canonical)).toEqual(['firstName', 'preferredName'])
  await applyDetectedFields(fields, 'auto')
  expect(document.querySelector<HTMLInputElement>('#legal')!.value).toBe('Alexander')
  expect(document.querySelector<HTMLInputElement>('#preferred')!.value).toBe('Alex')
})
it.each(['', '   '])('leaves an empty preferred name untouched (%j)', async (preferredName) => {
  const profile = testProfile()
  profile.personal.preferredName = preferredName
  expect(resolveProfileValue(profile, 'preferredName', 0)).toBeNull()
  document.body.innerHTML = '<label>Preferred Name<input></label>'
  await applyDetectedFields(scanDocument(document, { url: 'https://example.com', profile, settings: testSettings() }).fields, 'auto')
  expect(document.querySelector('input')!.value).toBe('')
})
