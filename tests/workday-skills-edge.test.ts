import { beforeEach, expect, it } from 'vitest'
import { fillWorkdayMultiValueCombobox, matchWorkdaySkillOption } from '@/adapters/workdayDom'
import { resetWorkdaySections } from '@/adapters/workdaySections'
import { fieldById, scanFixture } from './helpers'

beforeEach(() => resetWorkdaySections(document))
it('waits for filtered options and reacquires a replaced skills input after each chip', async () => {
  const { fields } = scanFixture('workday-skills.html', 'https://acme.myworkdayjobs.com/job/1')
  const field = fieldById(fields, 'workday-skills')!
  const selected = document.querySelector('[data-automation-id="selectedSkills"]')!
  const list = document.getElementById('skills-list')!
  list.innerHTML = ''
  const typed: string[] = []
  function wire(input: HTMLInputElement) {
    input.addEventListener('input', () => {
      if (!input.value) return
      typed.push(input.value)
      const desired = input.value
      setTimeout(() => {
        list.innerHTML = ''
        const option = document.createElement('div')
        option.setAttribute('role', 'option'); option.textContent = desired
        option.addEventListener('click', () => {
          const chip = document.createElement('span')
          chip.setAttribute('data-automation-id', 'skillChip'); chip.textContent = desired
          selected.append(chip)
          const next = input.cloneNode() as HTMLInputElement
          next.id = `${input.id}-replaced`; next.value = ''
          input.replaceWith(next); wire(next)
          list.innerHTML = ''
        })
        list.append(option)
      }, 420) // Longer than the former hard-coded 350ms cutoff.
    })
  }
  wire(document.getElementById('workday-skills') as HTMLInputElement)
  const result = await fillWorkdayMultiValueCombobox(field, ['React', 'TypeScript', ' typescript ', '', 'Python'], 900)
  expect(result).toMatchObject({ requested: 3, filled: 2, skipped: 1, needsReview: false })
  expect(typed).toHaveLength(2)
  expect(selected.querySelectorAll('[data-automation-id="skillChip"]')).toHaveLength(3)
})

it('keeps punctuation distinctions and refuses ambiguous exact options', () => {
  expect(matchWorkdaySkillOption(['JavaScript', 'javascript'], ' JavaScript ')).toBeNull()
  expect(matchWorkdaySkillOption(['C', 'C++', 'C#'], 'C++')).toBe(1)
  expect(matchWorkdaySkillOption(['Node.js'], 'Nodejs')).toBeNull()
  expect(matchWorkdaySkillOption(['JavaScript'], ' javascript ')).toBe(0)
  expect(matchWorkdaySkillOption([''], ' ')).toBeNull()
})

it('skips an ambiguous or unavailable skill and continues to a safe match', async () => {
  const { fields } = scanFixture('workday-skills.html', 'https://acme.myworkdayjobs.com/job/1')
  const list = document.getElementById('skills-list')!
  list.insertAdjacentHTML('beforeend', '<div role="option">TypeScript</div>')
  const python = Array.from(list.children).find((option) => option.textContent === 'Python')!
  python.addEventListener('click', () => {
    document.querySelector('[data-automation-id="selectedSkills"]')!.insertAdjacentHTML('beforeend', '<span data-automation-id="skillChip">Python</span>')
  })
  const result = await fillWorkdayMultiValueCombobox(fieldById(fields, 'workday-skills')!, ['TypeScript', 'Unavailable', 'Python'], 40)
  expect(result).toMatchObject({ filled: 1, skipped: 2, needsReview: true })
})

it('reacquires a repeated combobox inside its own card rather than the first matching automation ID', async () => {
  const { fillWorkdayCombobox } = await import('@/adapters/workdayDom')
  const { scanDocument } = await import('@/content/scanner')
  const { testProfile, testSettings } = await import('./helpers')
  document.body.innerHTML = `<main data-automation-id="applicationPage">
    <article aria-label="Education 1"><label>Degree<input role="combobox" data-automation-id="degree" aria-controls="one"></label></article>
    <article aria-label="Education 2"><label>Degree<input role="combobox" data-automation-id="degree" aria-controls="two"></label></article>
    <div id="one" role="listbox"><div role="option">B.S.</div></div>
    <div id="two" role="listbox"><div role="option">A.S.</div></div>
  </main>`
  const fields = scanDocument(document, { url: 'https://acme.myworkdayjobs.com/job/1', profile: testProfile(), settings: testSettings() }).fields
  const original = fields[1]!.control.elements[0]!
  const replacement = original.cloneNode() as HTMLInputElement
  original.replaceWith(replacement)
  document.querySelector('#two [role="option"]')!.addEventListener('click', () => { replacement.value = 'A.S.'; replacement.setAttribute('aria-expanded', 'false'); document.querySelector('#two [role="option"]')!.setAttribute('aria-selected', 'true') })
  const result = await fillWorkdayCombobox(fields[1]!, 'A.S.', 100)
  expect(result.ok).toBe(true)
  expect(replacement.value).toBe('A.S.')
  expect(document.querySelector<HTMLInputElement>('[aria-controls="one"]')!.value).toBe('')
})
