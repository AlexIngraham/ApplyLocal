import { beforeEach, describe, expect, it, vi } from 'vitest'
import { selectAdapter } from '@/adapters/registry'
import {
  fillWorkdayCombobox,
  fillWorkdayMultiValueCombobox,
  matchWorkdayOption,
  matchWorkdaySkillOption,
} from '@/adapters/workdayDom'
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
      ['wd-phone-extension', 'phoneExtension'],
      ['wd-address', 'address'],
      ['wd-address-2', 'addressLine2'],
      ['wd-city', 'city'],
      ['wd-county', 'county'],
      ['wd-zip', 'zip'],
      ['wd-website', 'website'],
      ['wd-project-website', 'projectWebsite'],
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
    expect((document.getElementById('wd-address-2') as HTMLInputElement).value).toBe('Suite 200')
    expect((document.getElementById('wd-county') as HTMLInputElement).value).toBe('Travis')
    expect((document.getElementById('wd-phone-extension') as HTMLInputElement).value).toBe('')
    expect((document.getElementById('wd-website') as HTMLInputElement).value).toBe('https://jordanlee.example/about')
    expect((document.getElementById('wd-project-website') as HTMLInputElement).value).toBe('https://project.jordanlee.example')
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

describe('Workday repeated sections', () => {
  it('maps every employment and education field by its containing card', async () => {
    renderFixture('workday-repeated-sections.html')
    const profile = testProfile()
    profile.employment = [
      {
        id: 'job-alpha',
        company: 'Company Alpha',
        jobTitle: 'Software Engineer Intern',
        startDate: '2023-05',
        endDate: '2023-08',
        current: false,
        location: 'New York, NY',
        description: '',
      },
      {
        id: 'job-beta',
        company: 'Company Beta',
        jobTitle: 'Data Analyst Intern',
        startDate: '2024-01',
        endDate: '2024-06',
        current: false,
        location: 'Philadelphia, PA',
        description: '',
      },
    ]
    profile.education = [
      {
        id: 'edu-alpha',
        school: 'Alpha University',
        degree: 'B.S.',
        major: 'Computer Science',
        minor: '',
        startDate: '2018-08',
        graduationDate: '2022-05',
        gpa: '',
      },
      {
        id: 'edu-beta',
        school: 'Beta College',
        degree: 'M.S.',
        major: 'Data Science',
        minor: '',
        startDate: '2022-08',
        graduationDate: '2024-05',
        gpa: '',
      },
    ]
    const result = scanDocument(document, {
      url: 'https://acme.myworkdayjobs.com/job/1',
      profile,
      settings: testSettings(),
    })
    const expected: Record<string, string> = {
      'job-1-company': 'Company Alpha',
      'job-1-title': 'Software Engineer Intern',
      'job-1-start': '2023-05',
      'job-1-end': '2023-08',
      'job-1-location': 'New York, NY',
      'job-2-company': 'Company Beta',
      'job-2-title': 'Data Analyst Intern',
      'job-2-start': '2024-01',
      'job-2-end': '2024-06',
      'job-2-location': 'Philadelphia, PA',
      'edu-1-school': 'Alpha University',
      'edu-1-degree': 'B.S.',
      'edu-1-major': 'Computer Science',
      'edu-1-start': '2018-08',
      'edu-1-end': '2022-05',
      'edu-2-school': 'Beta College',
      'edu-2-degree': 'M.S.',
      'edu-2-major': 'Data Science',
      'edu-2-start': '2022-08',
      'edu-2-end': '2024-05',
    }
    for (const [id, value] of Object.entries(expected)) {
      expect(fieldById(result.fields, id)?.proposedValue, id).toBe(value)
    }
    for (const id of Object.keys(expected).filter((id) => id.startsWith('job-1'))) {
      expect(fieldById(result.fields, id)?.repeatedSection).toMatchObject({ kind: 'employment', sectionIndex: 0 })
    }
    for (const id of Object.keys(expected).filter((id) => id.startsWith('job-2'))) {
      expect(fieldById(result.fields, id)?.repeatedSection).toMatchObject({ kind: 'employment', sectionIndex: 1 })
    }
    for (const id of Object.keys(expected).filter((id) => id.startsWith('edu-1'))) {
      expect(fieldById(result.fields, id)?.repeatedSection).toMatchObject({ kind: 'education', sectionIndex: 0 })
    }
    for (const id of Object.keys(expected).filter((id) => id.startsWith('edu-2'))) {
      expect(fieldById(result.fields, id)?.repeatedSection).toMatchObject({ kind: 'education', sectionIndex: 1 })
    }
    const firstJobKeys = Object.keys(expected)
      .filter((id) => id.startsWith('job-1'))
      .map((id) => fieldById(result.fields, id)?.repeatedSection?.sectionKey)
    const secondJobKeys = Object.keys(expected)
      .filter((id) => id.startsWith('job-2'))
      .map((id) => fieldById(result.fields, id)?.repeatedSection?.sectionKey)
    expect(new Set(firstJobKeys).size).toBe(1)
    expect(new Set(secondJobKeys).size).toBe(1)
    expect(firstJobKeys[0]).not.toBe(secondJobKeys[0])
    await applyDetectedFields(result.fields, 'auto')
    for (const [id, value] of Object.entries(expected)) {
      expect((document.getElementById(id) as HTMLInputElement).value, id).toBe(value)
    }
  })

  it('indexes a newly inserted Workday card from the full document order during a mutation rescan', async () => {
    renderFixture('workday-repeated-sections.html')
    const profile = testProfile()
    profile.employment = [
      profile.employment[0]!,
      { ...profile.employment[0]!, id: 'job-second' },
      {
        id: 'job-gamma',
        company: 'Company Gamma',
        jobTitle: 'Research Intern',
        startDate: '',
        endDate: '',
        current: false,
        location: '',
        description: '',
      },
    ]
    const rescans: Array<ReturnType<typeof scanDocument>> = []
    const stop = observeAdditions(document, (nodes) => {
      const node = nodes[0]
      if (node) {
        rescans.push(
          scanDocument(node, {
            url: 'https://acme.myworkdayjobs.com/job/1',
            profile,
            settings: testSettings(),
          }),
        )
      }
    })
    const card = document.createElement('article')
    card.setAttribute('data-automation-id', 'workExperienceCard')
    card.setAttribute('aria-label', 'Work Experience 3')
    card.innerHTML = '<label for="job-3-company">Company</label><input id="job-3-company" data-automation-id="company">'
    document.querySelector('[data-automation-id="workExperienceSection"]')?.append(card)
    await new Promise((resolve) => window.setTimeout(resolve, 240))
    stop()
    const company = rescans[0] ? fieldById(rescans[0].fields, 'job-3-company') : undefined
    expect(company?.repeatedSection).toMatchObject({ kind: 'employment', sectionIndex: 2 })
    expect(company?.proposedValue).toBe('Company Gamma')
  })

  it('normalizes From and To dates per control and leaves a current role end date blank', async () => {
    renderFixture('workday-dates-auth-sensitive.html')
    const profile = testProfile()
    profile.employment = [
      {
        id: 'job-dated',
        company: '',
        jobTitle: '',
        startDate: '2023-05-17',
        endDate: '08/20/2023',
        current: false,
        location: '',
        description: '',
      },
      {
        id: 'job-current',
        company: '',
        jobTitle: '',
        startDate: '2024-06',
        endDate: '',
        current: true,
        location: '',
        description: '',
      },
    ]
    const result = scanDocument(document, {
      url: 'https://acme.myworkdayjobs.com/job/2',
      profile,
      settings: testSettings(),
    })
    expect(fieldById(result.fields, 'job-1-from')).toMatchObject({ canonical: 'employmentStart', proposedValue: '2023-05-17' })
    expect(fieldById(result.fields, 'job-1-to')).toMatchObject({ canonical: 'employmentEnd', proposedValue: '08/20/2023' })
    expect(fieldById(result.fields, 'job-2-from-month')).toMatchObject({ canonical: 'employmentStart', proposedValue: '2024-06' })
    expect(fieldById(result.fields, 'job-2-from-year')).toMatchObject({ canonical: 'employmentStart', proposedValue: '2024-06' })
    expect(fieldById(result.fields, 'job-2-to-month')).toMatchObject({ canonical: 'employmentEnd', proposedValue: null })
    expect(fieldById(result.fields, 'job-2-current')).toMatchObject({ canonical: 'currentPosition', proposedValue: 'yes' })

    await applyDetectedFields(
      result.fields.filter((field) => field.repeatedSection?.kind === 'employment'),
      'auto',
    )
    expect((document.getElementById('job-1-from') as HTMLInputElement).value).toBe('05/2023')
    expect((document.getElementById('job-1-to') as HTMLInputElement).value).toBe('08/20/2023')
    expect((document.getElementById('job-2-from-month') as HTMLSelectElement).value).toBe('6')
    expect((document.getElementById('job-2-from-year') as HTMLSelectElement).value).toBe('2024')
    expect((document.getElementById('job-2-to-month') as HTMLSelectElement).value).toBe('')
    expect((document.getElementById('job-2-to-year') as HTMLSelectElement).value).toBe('')
    expect((document.getElementById('job-2-current') as HTMLInputElement).checked).toBe(true)
  })
})

describe('Workday eligibility and sensitive answers', () => {
  it('fills work authorization across radio, select, and custom combobox controls', async () => {
    const { fields } = scanFixture('workday-dates-auth-sensitive.html', 'https://acme.myworkdayjobs.com/job/2')
    for (const id of ['auth-radio-yes', 'auth-select', 'auth-combo']) {
      expect(fieldById(fields, id)).toMatchObject({ canonical: 'workAuthorization', proposedValue: 'yes' })
    }
    const combo = document.getElementById('auth-combo') as HTMLInputElement
    document.querySelectorAll<HTMLElement>('#auth-options [role="option"]').forEach((option) => {
      option.addEventListener('click', () => {
        combo.value = option.textContent || ''
        combo.setAttribute('aria-expanded', 'false')
        option.setAttribute('aria-selected', 'true')
      })
    })
    await applyDetectedFields(fields, 'auto')
    expect((document.getElementById('auth-radio-yes') as HTMLInputElement).checked).toBe(true)
    expect((document.getElementById('auth-select') as HTMLSelectElement).value).toBe('yes')
    expect(combo.value).toBe('Yes')
  })

  it('requires the global gate and an exact saved demographic answer', async () => {
    renderFixture('workday-dates-auth-sensitive.html')
    const profile = testProfile()
    profile.sensitive.race = { value: 'Asian', autofillEnabled: false }
    profile.sensitive.ethnicity = { value: 'Hispanic or Latino', autofillEnabled: false }
    profile.sensitive.gender = { value: 'Female', autofillEnabled: false }
    profile.sensitive.veteran = { value: 'I am not a protected veteran', autofillEnabled: false }

    const blocked = scanDocument(document, {
      url: 'https://acme.myworkdayjobs.com/job/2',
      profile,
      settings: testSettings(),
    })
    for (const id of ['race', 'ethnicity', 'gender', 'veteran']) {
      expect(fieldById(blocked.fields, id)).toMatchObject({ fillBand: 'blocked', proposedValue: null })
    }

    const enabled = scanDocument(document, {
      url: 'https://acme.myworkdayjobs.com/job/2',
      profile,
      settings: testSettings({ autofillSensitiveDemographics: true }),
    })
    expect(fieldById(enabled.fields, 'race')?.canonical).toBe('sensitive.race')
    expect(fieldById(enabled.fields, 'ethnicity')?.canonical).toBe('sensitive.ethnicity')
    expect(fieldById(enabled.fields, 'gender')?.canonical).toBe('sensitive.gender')
    expect(fieldById(enabled.fields, 'veteran')?.canonical).toBe('sensitive.veteran')
    await applyDetectedFields(enabled.fields.filter((field) => field.sensitive), 'auto')
    expect((document.getElementById('race') as HTMLSelectElement).value).toBe('asian')
    expect((document.getElementById('ethnicity') as HTMLSelectElement).value).toBe('hispanic')
    expect((document.getElementById('gender') as HTMLSelectElement).value).toBe('female')
    expect((document.getElementById('veteran') as HTMLSelectElement).value).toBe('not-protected')
  })
})

describe('Workday multi-value skills', () => {
  it('adds skills individually, skips duplicates and missing exact matches, and reports partial results', async () => {
    renderFixture('workday-skills.html')
    const profile = testProfile()
    profile.skills = ['TypeScript', 'React', 'Rust', 'Python']
    const result = scanDocument(document, {
      url: 'https://acme.myworkdayjobs.com/job/1',
      profile,
      settings: testSettings(),
    })
    const field = fieldById(result.fields, 'workday-skills')
    expect(field).toMatchObject({ canonical: 'skills', proposedValue: profile.skills })
    expect(field?.control.multiValue).toBe(true)
    if (!field) throw new Error('missing Workday skills field')

    const typed: string[] = []
    const input = document.getElementById('workday-skills') as HTMLInputElement
    input.addEventListener('input', () => typed.push(input.value))
    const selected = document.querySelector('[data-automation-id="selectedSkills"]') as HTMLElement
    document.querySelectorAll<HTMLElement>('#skills-list [role="option"]').forEach((option) => {
      option.addEventListener('click', () => {
        const chip = document.createElement('span')
        chip.setAttribute('data-automation-id', 'skillChip')
        chip.setAttribute('role', 'listitem')
        chip.textContent = option.textContent
        selected.append(chip)
        input.value = ''
      })
    })

    const outcome = await fillOne(field)
    expect(outcome).toMatchObject({ ok: true, requested: 4, filled: 2, skipped: 2 })
    expect(field).toMatchObject({ status: 'suggested', locked: true })
    const chips = Array.from(selected.querySelectorAll('[role="listitem"]')).map((chip) => chip.textContent?.trim())
    expect(chips).toEqual(['React', 'TypeScript', 'Python'])
    expect(chips.filter((skill) => skill === 'React')).toHaveLength(1)
    expect(typed).not.toContain('React')
    expect(typed.every((value) => !value.includes(','))).toBe(true)
  })

  it('uses punctuation-safe exact matching for short language names', () => {
    expect(matchWorkdaySkillOption(['C++', 'C#'], 'C')).toBeNull()
    expect(matchWorkdaySkillOption(['C', 'C++', 'C#'], ' c ')).toBe(0)
  })

  it('stops safely when the widget refuses another skill', async () => {
    const { fields } = scanFixture('workday-skills.html', 'https://acme.myworkdayjobs.com/job/1')
    const field = fieldById(fields, 'workday-skills')
    if (!field) throw new Error('missing Workday skills field')
    const input = document.getElementById('workday-skills') as HTMLInputElement
    const typed: string[] = []
    input.addEventListener('input', () => typed.push(input.value))
    const selected = document.querySelector('[data-automation-id="selectedSkills"]') as HTMLElement
    const typeScript = Array.from(document.querySelectorAll<HTMLElement>('#skills-list [role="option"]')).find(
      (option) => option.textContent === 'TypeScript',
    )
    typeScript?.addEventListener('click', () => {
      const chip = document.createElement('span')
      chip.setAttribute('data-automation-id', 'skillChip')
      chip.setAttribute('role', 'listitem')
      chip.textContent = 'TypeScript'
      selected.append(chip)
      input.value = ''
    })

    const outcome = await fillWorkdayMultiValueCombobox(field, ['TypeScript', 'Python', 'C#'], 40)
    expect(outcome).toMatchObject({ ok: true, requested: 3, filled: 1, skipped: 2, needsReview: true })
    expect(typed).toContain('TypeScript')
    expect(typed).toContain('Python')
    expect(typed).not.toContain('C#')
  })

  it('keeps comma-separated filling for an ordinary skills textarea', async () => {
    document.body.innerHTML = `
      <main data-automation-id="applicationPage">
        <form data-automation-id="jobApplication">
          <label for="plain-skills">List your technical skills</label>
          <textarea id="plain-skills"></textarea>
        </form>
      </main>
    `
    const profile = testProfile()
    profile.skills = ['TypeScript', 'React', 'Python']
    const result = scanDocument(document, {
      url: 'https://acme.myworkdayjobs.com/job/1',
      profile,
      settings: testSettings(),
    })
    const field = fieldById(result.fields, 'plain-skills')
    expect(field?.proposedValue).toEqual(profile.skills)
    expect(field?.control.multiValue).not.toBe(true)
    await applyDetectedFields(result.fields, 'auto')
    expect((document.getElementById('plain-skills') as HTMLTextAreaElement).value).toBe('TypeScript, React, Python')
  })
})
