import { describe, expect, it } from 'vitest'
import { detectSuccess, guessCompanyFromUrl, guessJobTitle } from '@/applicationTracker/detect'
import { observeAdditions } from '@/content/mutationObserver'

describe('application tracker detection', () => {
  it('recognizes a confirmation and ignores a normal job posting', () => {
    expect(detectSuccess({
      title: 'Thank you for applying',
      h1: 'Application submitted',
      alert: '',
      url: 'https://boards.greenhouse.io/acme/jobs/1/confirmation',
    })).toBe(true)
    expect(detectSuccess({
      title: 'Software Engineer',
      h1: 'Software Engineer',
      alert: 'Applicants will receive an email if selected.',
      url: 'https://boards.greenhouse.io/acme/jobs/1',
    })).toBe(false)
  })

  it('guesses company and title without treating a thank-you heading as the job', () => {
    expect(guessCompanyFromUrl('https://boards.greenhouse.io/airbnb/jobs/123')).toBe('Airbnb')
    expect(guessCompanyFromUrl('https://jobs.lever.co/spotify/abc')).toBe('Spotify')
    expect(guessJobTitle('Thank you for applying')).toBe('')
    expect(guessJobTitle('Software Engineer')).toBe('Software Engineer')
  })
})

describe('mutation observer', () => {
  it('reports nodes added after the debounce', async () => {
    document.body.innerHTML = ''
    const seen: ParentNode[] = []
    const stop = observeAdditions(document, (nodes) => seen.push(...nodes))
    const added = document.createElement('div')
    document.body.append(added)
    expect(seen).toHaveLength(0)
    await new Promise((resolve) => setTimeout(resolve, 250))
    expect(seen).toContain(added)
    stop()
  })
})
