import type { CanonicalField } from '@/classifier/types'
import { normalize } from '@/classifier/normalize'
import { COUNTRY_ALIASES, US_STATES } from '@/utils/states'

export interface Choice {
  value: string
  label: string
}

const YES_NO_KEYS = new Set<CanonicalField>([
  'workAuthorization',
  'requiresSponsorship',
  'requiresFutureSponsorship',
  'relocation',
  'currentPosition',
])

export function parseMoney(value: string): number | null {
  const compact = value.trim().toLowerCase().replace(/[$,\s]/g, '')
  const thousands = compact.match(/^(\d+(?:\.\d+)?)k$/)
  if (thousands?.[1]) return Math.round(parseFloat(thousands[1]) * 1000)
  const plain = compact.match(/^(\d+(?:\.\d+)?)$/)
  if (!plain?.[1]) return null
  const amount = parseFloat(plain[1])
  return Number.isFinite(amount) ? amount : null
}

export function polarity(text: string): 'yes' | 'no' | null {
  const normalized = normalize(text)
  if (!normalized) return null
  if (/^(yes|y|true|1)$/.test(normalized)) return 'yes'
  if (/^(no|n|false|0)$/.test(normalized)) return 'no'
  const negated = /\b(no|not|never|false)\b/.test(normalized) || /\bdon t\b/.test(normalized) || /\bdo not\b/.test(normalized)
  if (negated) return 'no'
  if (/\b(yes|true)\b/.test(normalized)) return 'yes'
  if (/\b(authorized|authorised|eligible|citizen)\b/.test(normalized)) return 'yes'
  return null
}

export function checkboxShouldBeChecked(label: string, desired: string): boolean {
  const want = polarity(desired)
  if (!want) return false
  return polarity(label) === 'no' ? want === 'no' : want === 'yes'
}

export function matchChoice(options: Choice[], desired: string, key: CanonicalField): string | null {
  const cleaned = desired.trim()
  if (!cleaned || !options.length) return null
  if (YES_NO_KEYS.has(key)) return matchYesNo(options, cleaned)
  if (key === 'workPreference') return matchPreference(options, cleaned)
  if (key === 'desiredSalary') return matchSalary(options, cleaned) ?? matchLoose(options, cleaned)
  if (key === 'state') return matchState(options, cleaned) ?? matchLoose(options, cleaned)
  if (key === 'country') return matchCountry(options, cleaned) ?? matchLoose(options, cleaned)
  return matchLoose(options, cleaned)
}

export function matchYesNo(options: Choice[], desired: string): string | null {
  const want = polarity(desired)
  if (!want) return null
  const matches = options.filter((option) => polarity(`${option.label} ${option.value}`) === want)
  if (!matches.length) return null
  const exact = matches.find((option) => polarity(option.label) === want && normalize(option.label) === want)
  return (exact ?? matches.sort((a, b) => a.label.length - b.label.length)[0])?.value ?? null
}

export function matchState(options: Choice[], desired: string): string | null {
  const token = normalize(desired)
  const pair = US_STATES.find(([abbr, name]) => normalize(abbr) === token || normalize(name) === token)
  const aliases = pair ? [normalize(pair[0]), normalize(pair[1])] : [token]
  return matchAliases(options, aliases)
}

export function matchCountry(options: Choice[], desired: string): string | null {
  const token = normalize(desired)
  const direct = COUNTRY_ALIASES[token]
  const listed = Object.values(COUNTRY_ALIASES).find((aliases) => aliases.includes(token))
  return matchAliases(options, (direct ?? listed ?? [token]).map((alias) => normalize(alias)))
}

export function matchSalary(options: Choice[], desired: string): string | null {
  const amount = parseMoney(desired)
  if (amount == null) return null
  for (const option of options) {
    const range = parseRange(option.label) ?? parseRange(option.value)
    if (range && amount >= range.min && amount <= range.max) return option.value
  }
  return null
}

export function matchPreference(options: Choice[], desired: string): string | null {
  const aliases: Record<string, string[]> = {
    remote: ['remote', 'work from home', 'wfh'],
    hybrid: ['hybrid'],
    onsite: ['onsite', 'on site', 'in office', 'in person'],
  }
  const wanted = aliases[normalize(desired)]
  if (!wanted) return matchLoose(options, desired)
  return matchAliases(options, wanted)
}

export function toMonth(value: string): string | null {
  const iso = value.trim().match(/^(\d{4})-(\d{2})(?:-\d{2})?$/)
  if (iso) return `${iso[1]}-${iso[2]}`
  const us = value.trim().match(/^(\d{1,2})\/(\d{4})$/)
  if (us) return `${us[2]}-${us[1].padStart(2, '0')}`
  return null
}

export function toDate(value: string): string | null {
  const full = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (full) return `${full[1]}-${full[2]}-${full[3]}`
  const month = toMonth(value)
  return month ? `${month}-01` : null
}

function parseRange(text: string): { min: number; max: number } | null {
  const cleaned = text.toLowerCase().replace(/,/g, '')
  const matches = [...cleaned.matchAll(/\$?\s*(\d+(?:\.\d+)?)\s*(k)?/g)]
  const numbers = matches
    .map((match) => {
      if (!match[1]) return null
      return Math.round(parseFloat(match[1]) * (match[2] ? 1000 : 1))
    })
    .filter((value): value is number => value != null && Number.isFinite(value))
  if (numbers.length < 2) return null
  return { min: Math.min(numbers[0] ?? 0, numbers[1] ?? 0), max: Math.max(numbers[0] ?? 0, numbers[1] ?? 0) }
}

function matchAliases(options: Choice[], aliases: string[]): string | null {
  const wanted = new Set(aliases.map((alias) => normalize(alias)).filter(Boolean))
  const exact = options.find((option) => wanted.has(normalize(option.label)) || wanted.has(normalize(option.value)))
  if (exact) return exact.value
  const partial = options.filter((option) => {
    const label = normalize(option.label)
    return [...wanted].some((alias) => alias.length > 2 && (label.includes(alias) || alias.includes(label)))
  })
  return partial.length === 1 ? partial[0]?.value ?? null : null
}

function matchLoose(options: Choice[], desired: string): string | null {
  const token = normalize(desired)
  if (!token) return null
  const exact = options.find((option) => normalize(option.label) === token || normalize(option.value) === token)
  if (exact) return exact.value
  if (token.length < 3) return null
  const partial = options.filter((option) => {
    const label = normalize(option.label)
    return label.includes(token) || token.includes(label)
  })
  return partial.length === 1 ? partial[0]?.value ?? null : null
}
