import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { scanDocument } from '@/content/scanner'
import { applyDetectedFields, fillOne } from '@/content/apply'
import { fillSkillsWidget } from '@/content/skills/fill'
import { SKILL_FILL_YIELD_MS } from '@/content/skills/scheduling'
import { fillInProgress } from '@/content/fillTransaction'
import { startController } from '@/content/controller'
import { renderFixture, testProfile, testSettings } from './helpers'

const saved = ['TypeScript', 'React', 'Python', 'SQL', 'AWS']
function scan(skills = saved, url = 'https://example.com/apply') {
  const profile = testProfile(); profile.skills = skills
  return scanDocument(document, { url, profile, settings: testSettings() }).fields
}
const boxes = () => Array.from(document.querySelectorAll<HTMLInputElement>('#skills-picker input[type="checkbox"]'))
const selected = () => boxes().filter((box) => box.checked).map((box) => box.value)
let stop: (() => void) | undefined
beforeEach(() => { renderFixture('skills-checkboxes.html') })
afterEach(() => { stop?.(); stop = undefined; vi.unstubAllGlobals(); vi.useRealTimers() })

it.each(['https://example.com/apply', 'https://acme.myworkdayjobs.com/job/1', 'https://boards.greenhouse.io/acme', 'https://jobs.lever.co/acme'])('groups skills and adds only safe matches on %s', async (url) => {
  const fields = scan(saved, url)
  const groups = fields.filter((field) => field.canonical === 'skills')
  expect(groups).toHaveLength(1)
  expect(groups[0]!.control.kind).toBe('skills-checkboxes')
  expect(groups[0]!.proposedValue).toEqual(saved)
  const result = await fillOne(groups[0]!)
  expect(result.skills).toEqual({ requested: 5, filled: saved, alreadySelected: [], unavailable: [], ambiguous: [], failed: [] })
  expect(selected()).toEqual(saved)
  expect(document.querySelector<HTMLInputElement>('#terms')!.checked).toBe(false)
})

it('preserves existing matches and unrelated manual choices without duplicate clicks', async () => {
  boxes().filter((box) => ['React', 'Python', 'Java'].includes(box.value)).forEach((box) => { box.checked = true })
  const clicks = vi.fn()
  document.querySelector('#skills-picker')!.addEventListener('click', clicks)
  const field = scan()[0]!
  const result = await fillOne(field)
  expect(result.skills?.alreadySelected).toEqual(['React', 'Python'])
  expect(clicks).toHaveBeenCalledTimes(3)
  await applyDetectedFields([field], 'auto')
  expect(clicks).toHaveBeenCalledTimes(3)
  expect(selected()).toEqual(['Java', ...saved])
})

it('never cross-matches C, React or Java with related technologies', async () => {
  boxes().filter((box) => ['C', 'React', 'Java'].includes(box.value)).forEach((box) => box.closest('label')!.remove())
  const result = await fillOne(scan(['C', 'React', 'Java', 'FastAPI'])[0]!)
  expect(result.skills?.unavailable).toEqual(['C', 'React', 'Java', 'FastAPI'])
  expect(selected()).toEqual([])
})

it('uses explicit aliases, prefers exact choices, and refuses duplicate matches', async () => {
  document.querySelector('#skills-picker')!.insertAdjacentHTML('beforeend', '<label><input type="checkbox" value="TS">TS</label><label><input type="checkbox" value="react">react</label><label><input type="checkbox" value="Node.js">Node.js</label>')
  const result = await fillOne(scan(['JS', 'TS', 'React', 'Node', 'SQL'])[0]!)
  expect(selected()).toEqual(['JavaScript', 'SQL', 'TS', 'Node.js'])
  expect(result.skills?.ambiguous).toEqual(['React'])
  expect(result.needsReview).toBe(true)
})

it('skips disabled and hidden options and respects disabled skills settings', async () => {
  boxes().find((box) => box.value === 'TypeScript')!.disabled = true
  boxes().find((box) => box.value === 'React')!.closest('label')!.hidden = true
  const result = await fillOne(scan()[0]!)
  expect(result.skills?.failed).toEqual(['TypeScript'])
  expect(result.skills?.unavailable).toEqual(['React'])
  renderFixture('skills-checkboxes.html')
  const profile = testProfile(); profile.skills = saved
  await applyDetectedFields(scanDocument(document, { url: 'https://example.com', profile, settings: testSettings({ disabledFields: ['skills'] }) }).fields, 'auto')
  expect(selected()).toEqual([])
})

it('supports ARIA groups, headings, Workday containers, and meaningful option labels', async () => {
  document.body.innerHTML = '<div role="group" aria-label="Technologies"><span id="python-label">Python</span><div role="checkbox" aria-labelledby="python-label" aria-checked="false"></div><div role="checkbox" aria-label="SQL" aria-checked="true"></div><div><input type="checkbox">AWS</div></div>'
  const ariaBox = document.querySelector<HTMLElement>('[role="checkbox"]')!
  ariaBox.addEventListener('click', () => ariaBox.setAttribute('aria-checked', 'true'))
  const result = await fillOne(scan(['Python', 'SQL', 'AWS'])[0]!)
  expect(result.skills?.filled).toEqual(['Python', 'AWS'])
  expect(result.skills?.alreadySelected).toEqual(['SQL'])
})

it('does not classify arbitrary checkbox clusters as skill widgets', () => {
  document.querySelector('#skills-picker legend')!.textContent = 'Preferences'
  expect(scan().some((field) => field.control.skillsWidget)).toBe(false)
})

it('excludes separate questions nested in a skills section', async () => {
  document.querySelector('#skills-picker')!.insertAdjacentHTML('beforeend', '<fieldset><legend>Consent</legend><label><input id="nested" type="checkbox">Python</label></fieldset>')
  await fillOne(scan()[0]!)
  expect(document.querySelector<HTMLInputElement>('#nested')!.checked).toBe(false)
  expect(selected().filter((value) => value === 'Python')).toHaveLength(1)
})

it('yields and reacquires a 200-option widget replaced after every selection', async () => {
  const skills = Array.from({ length: 12 }, (_, index) => `Skill ${index}`)
  const choices = Array.from({ length: 200 }, (_, index) => `Skill ${index}`)
  const picked = new Set<string>()
  const clicks: string[] = []
  function render() {
    const root = document.createElement('fieldset'); root.id = 'skills-picker'
    root.innerHTML = '<legend>Skills</legend>'
    for (const skill of choices) {
      const label = document.createElement('label'); label.textContent = skill
      const box = document.createElement('input'); box.type = 'checkbox'; box.value = skill; box.checked = picked.has(skill)
      box.addEventListener('click', () => { picked.add(skill); clicks.push(skill); setTimeout(render, 0) })
      label.append(box); root.append(label)
    }
    document.getElementById('skills-picker')!.replaceWith(root)
  }
  render()
  const field = scan(skills)[0]!
  const task = fillOne(field)
  expect(clicks.length).toBeLessThan(skills.length)
  expect(fillInProgress(document)).toBe(true)
  const result = await task
  expect(result.skills?.filled).toEqual(skills)
  expect(clicks).toEqual(skills)
  expect(selected()).toEqual(skills)
  expect(field.control.elements[0]!.isConnected).toBe(true)
  expect(fillInProgress(document)).toBe(false)
})

function wireSearch(delay = 30) {
  const root = document.getElementById('skills-picker')!
  const search = root.querySelector<HTMLInputElement>('input[type="search"]')!
  const options = root.querySelector<HTMLElement>('.options')!
  const choices = ['React', 'React Native', 'Python', 'SQL']
  const picked = new Set<string>()
  const typed: string[] = []
  let timer: ReturnType<typeof setTimeout>
  function render(query: string) {
    options.innerHTML = ''
    for (const value of choices.filter((choice) => choice.toLowerCase().includes(query.toLowerCase()))) {
      const label = document.createElement('label'); label.textContent = value
      const box = document.createElement('input'); box.type = 'checkbox'; box.value = value; box.checked = picked.has(value)
      box.addEventListener('click', () => { if (box.checked) picked.add(value); else picked.delete(value); render(search.value) })
      label.append(box); options.append(label)
    }
    options.removeAttribute('aria-busy')
  }
  search.addEventListener('input', () => {
    typed.push(search.value); options.setAttribute('aria-busy', 'true')
    clearTimeout(timer)
    const query = search.value
    timer = setTimeout(() => render(query), delay)
  })
  return { picked, typed, search }
}

it.each(['https://example.com', 'https://acme.myworkdayjobs.com/job/1'])('searches, waits, matches, selects and clears across skills on %s', async (url) => {
  renderFixture('skills-searchable.html')
  if (!url.includes('workday')) document.querySelector('main')!.removeAttribute('data-automation-id')
  const { picked, typed, search } = wireSearch()
  const field = scan(['Python', 'SQL', 'React'], url)[0]!
  expect(field.control.skillsWidget?.kind).toBe('searchable-checkbox-list')
  const result = await fillOne(field)
  expect(result.skills?.filled).toEqual(['Python', 'SQL', 'React'])
  expect([...picked]).toEqual(['Python', 'SQL', 'React'])
  expect(typed).toEqual(['Python', 'SQL', 'React', ''])
  expect(search.value).toBe('')
  await new Promise((resolve) => setTimeout(resolve, 40))
})

it('stops for a user edit during the asynchronous search and keeps their text', async () => {
  renderFixture('skills-searchable.html')
  const { picked, search } = wireSearch()
  const field = scan(['SQL', 'Python'])[0]!
  const task = fillOne(field)
  search.value = 'My search'; search.dispatchEvent(new Event('input', { bubbles: true }))
  await task
  expect(field.status).toBe('manual')
  expect(picked.size).toBe(0)
  expect(search.value).toBe('My search')
  await new Promise((resolve) => setTimeout(resolve, 40))
})

it('protects a preexisting search', async () => {
  renderFixture('skills-searchable.html')
  const search = document.querySelector<HTMLInputElement>('input[type="search"]')!; search.value = 'My search'
  await fillOne(scan()[0]!)
  expect(search.value).toBe('My search')
  expect(selected()).toEqual([])
})

it('serializes skills only for text widgets and refuses scalar checkbox fallbacks', async () => {
  document.body.innerHTML = '<label>Technical skills<textarea></textarea></label><label>Skills<input type="checkbox"></label>'
  const fields = scan()
  await fillSkillsWidget(fields[0]!, saved)
  expect(document.querySelector('textarea')!.value).toBe(saved.join(', '))
  expect((await fillSkillsWidget(fields[1]!, saved)).ok).toBe(false)
  expect(document.querySelector('input')!.checked).toBe(false)
})

it('releases transaction guards on failure and prevents duplicate concurrent fills', async () => {
  const field = scan()[0]!
  const clicks = vi.fn(); document.querySelector('#skills-picker')!.addEventListener('click', clicks)
  const first = fillOne(field); const second = fillOne(field)
  expect(first).toBe(second)
  await first
  expect(clicks).toHaveBeenCalledTimes(5)
  field.control.skillsWidget!.resolve = () => { throw new Error('Rerender') }
  await fillOne(field)
  expect(fillInProgress(document)).toBe(false)
})

it('defers controller rescans during search, keeps one indicator, and preserves manual removals', async () => {
  renderFixture('skills-searchable.html')
  const { picked } = wireSearch(260)
  const profile = testProfile(); profile.skills = ['SQL', 'Python']
  const listeners: Array<(message: unknown, sender: unknown, reply: (value: unknown) => void) => void> = []
  vi.stubGlobal('chrome', {
    storage: { local: { get: vi.fn(async () => ({ profile, settings: testSettings() })) }, onChanged: { addListener: vi.fn(), removeListener: vi.fn() } },
    runtime: { onMessage: { addListener: (fn: typeof listeners[number]) => listeners.push(fn), removeListener: vi.fn() }, sendMessage: vi.fn(), lastError: undefined },
  })
  stop = startController(document, window)
  await new Promise((resolve) => setTimeout(resolve, 1250))
  expect([...picked]).toEqual(['SQL', 'Python'])
  expect(document.querySelector('#applylocal-root')!.shadowRoot!.querySelectorAll('.dot')).toHaveLength(1)
  const python = boxes().find((box) => box.value === 'Python')!
  python.click()
  await new Promise((resolve) => setTimeout(resolve, 500))
  expect(picked.has('Python')).toBe(false)
  expect(fillInProgress(document)).toBe(false)
  expect(SKILL_FILL_YIELD_MS).toBeGreaterThan(0)
})

it('does not fill a search box before options have loaded', async () => {
  renderFixture('skills-searchable.html')
  document.querySelector('.options')!.innerHTML = ''
  const field = scan()[0]!
  expect(field.control.skillsWidget).toBeUndefined()
  const result = await fillOne(field)
  expect(result.ok).toBe(false)
  expect(document.querySelector<HTMLInputElement>('input[type="search"]')!.value).toBe('')
})

it('treats Workday option markers as rows within one group', async () => {
  document.querySelector('#skills-picker legend')!.remove()
  document.querySelector('#skills-picker')!.setAttribute('data-automation-id', 'skillsSection')
  document.querySelectorAll('#skills-picker label').forEach((label) => label.setAttribute('data-automation-id', 'skillOption'))
  expect(scan().filter((field) => field.control.skillsWidget)).toHaveLength(1)
  await fillOne(scan()[0]!)
  expect(selected()).toEqual(saved)
})

it('stops on a custom checkbox click while waiting on another skill', async () => {
  document.body.innerHTML = '<div role="group" aria-label="Skills"><div role="checkbox" aria-label="SQL" aria-checked="false"></div><div role="checkbox" aria-label="Python" aria-checked="true"></div></div>'
  const python = document.querySelector<HTMLElement>('[aria-label="Python"]')!
  python.addEventListener('click', () => python.setAttribute('aria-checked', 'false'))
  const field = scan(['SQL', 'Python'])[0]!
  const task = fillOne(field)
  python.click()
  await task
  expect(field.status).toBe('manual')
  expect(python.getAttribute('aria-checked')).toBe('false')
})

it('reports refused checkbox selections without force-setting their state', async () => {
  document.body.innerHTML = '<div role="group" aria-label="Skills"><div role="checkbox" aria-label="Python" aria-checked="false"></div><label><input type="checkbox" value="SQL">SQL</label></div>'
  const result = await fillOne(scan(['Python', 'SQL'])[0]!)
  expect(result.skills?.failed).toEqual(['Python'])
  expect(result.skills?.filled).toEqual(['SQL'])
  expect(result.needsReview).toBe(true)
})
