import type { Candidate, CanonicalField } from '@/classifier/types'
import { normalize } from '@/classifier/normalize'

const TEXT_RULES: Array<{ key: CanonicalField; pattern: RegExp; reason: string }> = [
  {
    key: 'sensitive.sexualOrientation',
    pattern: /\b(sexual orientation|sexuality)\b/,
    reason: 'Question asks about sexual orientation',
  },
  {
    key: 'sensitive.gender',
    pattern: /\b(gender identity|gender|pronouns|sex|non binary|nonbinary)\b/,
    reason: 'Question asks about gender or sex',
  },
  {
    key: 'sensitive.disability',
    pattern: /\b(disability|disabled|handicap)\b/,
    reason: 'Question asks about disability',
  },
  {
    key: 'sensitive.veteran',
    pattern: /\b(veteran status|protected veteran|veteran)\b/,
    reason: 'Question asks about veteran status',
  },
  {
    key: 'sensitive.religion',
    pattern: /\b(religion|religious)\b/,
    reason: 'Question asks about religion',
  },
  {
    key: 'sensitive.race',
    pattern: /\b(race|racial)\b/,
    reason: 'Question asks about race',
  },
  {
    key: 'sensitive.ethnicity',
    pattern: /\b(ethnicity|hispanic|latino|latina|latinx|latine|minorit(?:y|ies))\b/,
    reason: 'Question asks about ethnicity',
  },
]

const OPTION_MARKERS = [
  'hispanic',
  'latino',
  'latina',
  'latinx',
  'african american',
  'native hawaiian',
  'alaska native',
  'two or more',
  'white',
  'asian',
  'black or african',
  'decline to self identify',
]

export function detectSensitiveText(text: string): Candidate | null {
  const normalized = normalize(text)
  if (!normalized) return null
  for (const rule of TEXT_RULES) {
    if (rule.pattern.test(normalized)) {
      return { key: rule.key, confidence: 0.97, reason: rule.reason, specificity: 5 }
    }
  }
  return null
}

export function optionsLookSensitive(text: string): boolean {
  const normalized = normalize(text)
  const hits = OPTION_MARKERS.filter((marker) => normalized.includes(normalize(marker)))
  return hits.length >= 2
}

function wordHits(text: string, words: string[]): number {
  return words.filter((word) => new RegExp(`\\b${word}\\b`).test(text)).length
}

export function detectSensitiveOptions(text: string): Candidate | null {
  const fromText = detectSensitiveText(text)
  if (fromText) return fromText
  const normalized = normalize(text)
  const genderHits = wordHits(normalized, ['female', 'male', 'non binary', 'nonbinary', 'woman', 'man', 'genderqueer'])
  if (genderHits >= 2) {
    return {
      key: 'sensitive.gender',
      confidence: 0.93,
      reason: 'Answer choices look like gender self-identification',
      specificity: 4,
    }
  }
  if (!optionsLookSensitive(text)) return null
  return {
    key: 'sensitive.race',
    confidence: 0.9,
    reason: 'Answer choices look like a demographic self-identification list',
    specificity: 4,
  }
}
