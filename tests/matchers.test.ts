import { describe, expect, it } from 'vitest'
import { checkboxShouldBeChecked, matchChoice, matchSalary, matchState, parseMoney, toMonth } from '@/content/matchers'
import { setNativeValue } from '@/content/filler'

describe('answer matching', () => {
  const yesNo = [
    { value: '', label: 'Select' },
    { value: 'yes', label: 'Yes' },
    { value: 'no', label: 'No' },
  ]

  it('parses money and picks a containing salary range', () => {
    expect(parseMoney('150k')).toBe(150000)
    expect(parseMoney('$150,000')).toBe(150000)
    const options = [
      { value: 'low', label: '$80,000 - $100,000' },
      { value: 'mid', label: '120k-160k' },
    ]
    expect(matchSalary(options, '150000')).toBe('mid')
    expect(matchSalary(options, '90000')).toBe('low')
  })

  it('maps state abbreviations and country names onto options', () => {
    const states = [
      { value: 'TX', label: 'Texas' },
      { value: 'CA', label: 'California' },
    ]
    expect(matchState(states, 'TX')).toBe('TX')
    expect(matchChoice(states, 'Texas', 'state')).toBe('TX')
    const countries = [
      { value: 'USA', label: 'United States' },
      { value: 'CA', label: 'Canada' },
    ]
    expect(matchChoice(countries, 'United States', 'country')).toBe('USA')
  })

  it('matches yes and no without treating them as interchangeable', () => {
    expect(matchChoice(yesNo, 'yes', 'workAuthorization')).toBe('yes')
    expect(matchChoice(yesNo, 'no', 'requiresSponsorship')).toBe('no')
    expect(checkboxShouldBeChecked('I am legally authorized to work', 'yes')).toBe(true)
    expect(checkboxShouldBeChecked('I do not require sponsorship', 'no')).toBe(true)
    expect(checkboxShouldBeChecked('I do not require sponsorship', 'yes')).toBe(false)
  })

  it('converts month values and refuses a bare year', () => {
    expect(toMonth('2020-05-01')).toBe('2020-05')
    expect(toMonth('2020')).toBeNull()
  })
})

describe('controlled inputs', () => {
  it('sets the value through the prototype and notifies listeners', () => {
    const input = document.createElement('input')
    document.body.append(input)
    const seen: string[] = []
    const tracker: string[] = []
    ;(input as HTMLInputElement & { _valueTracker?: { setValue: (value: string) => void } })._valueTracker = {
      setValue: (value) => tracker.push(value),
    }
    input.addEventListener('input', () => seen.push('input'))
    input.addEventListener('change', () => seen.push('change'))
    setNativeValue(input, 'Jordan')
    expect(input.value).toBe('Jordan')
    expect(seen).toEqual(['input', 'change'])
    expect(tracker).toHaveLength(1)
    input.remove()
  })
})
