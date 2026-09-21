import { beforeEach, describe, expect, it, vi } from 'vitest'
import { selectAdapter } from '@/adapters/registry'
import { fillWorkdayCombobox, matchWorkdayOption } from '@/adapters/workdayDom'
import { applyDetectedFields, fillOne } from '@/content/apply'
import { observeAdditions } from '@/content/mutationObserver'
import { scanDocument } from '@/content/scanner'
import type { CanonicalField } from '@/classifier/types'
import { fieldById, renderFixture, scanFixture, testProfile, testSettings } from './helpers'

beforeEach(() => {
  document.body.innerHTML = ''
  vi.useRealTimers()
})

describe('Workday discovery', () => {
  it('detects Workday by host and by semantic DOM markers', () => {
    renderFixture('workday-basic.html')
    expect(selectAdapter('https://acme.wd5.myworkdayjobs.com/en-US/Careers/job/1', document, testSettings()).id).toBe('workday')
    expect(selectAdapter('https://careers.example.com/apply/1', document, testSettings()).id).toBe('workday')
  })

  it('classifies common personal, education, and eligibility fields distinctly', () => {
    const result = scanFixture('workday-basic.html', 'https://acme.wd5.myworkdayjobs.com/en-US/Careers/job/1')
    expect(result.ats).toBe('workday')
    const expected: Array<[string, CanonicalField]> = [
      ['wd-first', 'firstName'],
      ['wd-last', 'lastName'],
      ['wd-email', 'email'],
      ['wd-phone', 'phone'],
      ['wd-address', 'address'],
      ['wd-city', 'city'],
      ['wd-zip', 'zip'],
      ['wd-school', 'school'],
      ['wd-degree', 'degree'],
      ['wd-major', 'major'],
      ['wd-grad', 'graduationDate'],
      ['wd-company', 'company'],
      ['wd-title', 'jobTitle'],
      ['wd-job-start', 'employmentStart'],
      ['wd-auth-yes', 'workAuthorization'],
      ['wd-sponsor-yes', 'requiresFutureSponsorship'],
    ]
    for (const [id, canonical] of expected) expect(fieldById(result.fields, id)?.canonical).toBe(canonical)
    expect(fieldById(result.fields, 'wd-gender')).toMatchObject({ canonical: 'sensitive.gender', fillBand: 'blocked' })
  })

  it('fills native Workday fields without clicking navigation or weakening sensitive handling', async () => {
    const { fields } = scanFixture('workday-basic.html', 'https://acme.myworkdayjobs.com/job/1')
    const next = document.querySelector('[data-automation-id="bottom-navigation-next-button"]') as HTMLButtonElement
    const clicked = vi.fn()
    next.addEventListener('click', clicked)
    await applyDetectedFields(fields, 'auto')
    expect((document.getElementById('wd-first') as HTMLInputElement).value).toBe('Jordan')
    expect((document.getElementById('wd-address') as HTMLInputElement).value).toBe('100 Congress Ave')
    expect((document.getElementById('wd-school') as HTMLInputElement).value).toBe('State University')
    expect((document.getElementById('wd-degree') as HTMLInputElement).value).toBe('B.S.')
    expect((document.getElementById('wd-major') as HTMLInputElement).value).toBe('Computer Science')
    expect((document.getElementById('wd-grad') as HTMLInputElement).value).toBe('2020-05')
    expect((document.getElementById('wd-company') as HTMLInputElement).value).toBe('Northwind Labs')
    expect((document.getElementById('wd-title') as HTMLInputElement).value).toBe('Software Engineer')
    expect((document.getElementById('wd-job-start') as HTMLInputElement).value).toBe('2022-06')
    expect((document.getElementById('wd-auth-yes') as HTMLInputElement).checked).toBe(true)
    expect((document.getElementById('wd-sponsor-no') as HTMLInputElement).checked).toBe(true)
    expect((document.getElementById('wd-gender') as HTMLSelectElement).value).toBe('')
    expect(clicked).not.toHaveBeenCalled()
  })
})

describe('Workday comboboxes', () => {
  it('recognizes country and state comboboxes as fillable controls', () => {
    const { fields } = scanFixture('workday-combobox.html', 'https://acme.myworkdayjobs.com/job/1')
    expect(fieldById(fields, 'wd-country')).toMatchObject({ canonical: 'country', fillBand: 'high' })
    expect(fieldById(fields, 'wd-country')?.control.kind).toBe('combobox')
    expect(fieldById(fields, 'wd-state')).toMatchObject({ canonical: 'state', fillBand: 'high' })
  })

  it('matches exact values and known country/state aliases but rejects ambiguous partials', () => {
    expect(matchWorkdayOption(['Canada', 'United States of America'], 'United States', 'country')).toBe(1)
    expect(matchWorkdayOption(['California', 'Pennsylvania'], 'PA', 'state')).toBe(1)
    expect(matchWorkdayOption(['United Kingdom', 'United States'], 'United', 'country')).toBeNull()
    expect(matchWorkdayOption(['Yes', 'No'], 'maybe', 'workAuthorization')).toBeNull()
  })

  it('waits for delayed options and confirms selection after React-style replacement', async () => {
    const result = scanFixture('workday-combobox.html', 'https://acme.myworkdayjobs.com/job/1')
    document.getElementById('country-list')?.remove()
    const field = fieldById(result.fields, 'wd-country')
    if (!field) throw new Error('missing country field')
    const combo = document.getElementById('wd-country') as HTMLInputElement
    combo.addEventListener('click', () => {
      window.setTimeout(() => {
        const list = document.createElement('div')
        list.id = 'country-list'
        list.setAttribute('role', 'listbox')
        for (const label of ['Canada', 'United States of America']) {
          const option = document.createElement('div')
          option.setAttribute('role', 'option')
          option.textContent = label
          option.addEventListener('click', () => {
            const replacement = document.createElement('input')
            replacement.id = 'wd-country'
            replacement.setAttribute('role', 'combobox')
            replacement.setAttribute('data-automation-id', 'country')
            replacement.setAttribute('aria-controls', 'country-list')
            replacement.setAttribute('aria-expanded', 'false')
            replacement.value = label
            combo.replaceWith(replacement)
          })
          list.append(option)
        }
        document.body.append(list)
      }, 15)
    })

    const outcome = await fillOne(field)
    expect(outcome.ok).toBe(true)
    expect((document.getElementById('wd-country') as HTMLInputElement).value).toBe('United States of America')
  })

  it('does not report success when typing filters options but selection is not accepted', async () => {
    const { fields } = scanFixture('workday-combobox.html', 'https://acme.myworkdayjobs.com/job/1')
    const field = fieldById(fields, 'wd-country')
    if (!field) throw new Error('missing country field')
    const outcome = await fillWorkdayCombobox(field, 'United States', 40)
    expect(outcome).toMatchObject({ ok: false, status: 'failed' })
  })

  it('fills country, state, and degree from their own associated listboxes', async () => {
    const { fields } = scanFixture('workday-combobox.html', 'https://acme.myworkdayjobs.com/job/1')
    for (const id of ['wd-country', 'wd-state', 'wd-degree-combo']) {
      const control = document.getElementById(id) as HTMLElement
      const list = document.getElementById(control.getAttribute('aria-controls') || '')
      list?.querySelectorAll<HTMLElement>('[role="option"]').forEach((option) => {
        option.addEventListener('click', () => {
          if (control instanceof HTMLInputElement) control.value = option.textContent || ''
          else control.textContent = option.textContent || ''
          control.setAttribute('aria-expanded', 'false')
          option.setAttribute('aria-selected', 'true')
        })
      })
    }
    await applyDetectedFields(fields, 'auto')
    expect((document.getElementById('wd-country') as HTMLInputElement).value).toBe('United States of America')
    expect((document.getElementById('wd-state') as HTMLInputElement).value).toBe('Texas')
    expect(document.getElementById('wd-degree-combo')?.textContent).toBe('B.S.')
  })
})

describe('Workday multi-step changes', () => {
  it('reports newly inserted step content for rescanning without duplicate batches', async () => {
    renderFixture('workday-multistep.html')
    const batches: ParentNode[][] = []
    const stop = observeAdditions(document, (nodes) => batches.push(nodes))
    const template = document.getElementById('education-step-template') as HTMLTemplateElement
    document.querySelector('[data-automation-id="jobApplication"]')?.append(template.content.cloneNode(true))
    await new Promise((resolve) => window.setTimeout(resolve, 240))
    stop()
    expect(batches).toHaveLength(1)
    const added = batches[0]?.[0]
    if (!added) throw new Error('missing added step')
    const result = scanDocument(added, {
      url: 'https://careers.example.com/apply/1',
      profile: testProfile(),
      settings: testSettings(),
    })
    expect(result.ats).toBe('workday')
    expect(fieldById(result.fields, 'step-school')?.canonical).toBe('school')
    expect(fieldById(result.fields, 'step-major')?.canonical).toBe('major')
  })
})
