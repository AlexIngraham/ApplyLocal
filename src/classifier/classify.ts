import { FIELD_LABELS, isSensitiveKey } from '@/classifier/types'
import type { Candidate, CanonicalField, Classification, ClassifyInput } from '@/classifier/types'
import { normalize, tokenize } from '@/classifier/normalize'
import {
  matchAutocomplete,
  matchDate,
  matchOptionHints,
  matchQuestion,
  matchTokenRules,
  mixesAuthorizationAndSponsorship,
} from '@/classifier/patterns'
import { detectSensitiveOptions, detectSensitiveText } from '@/classifier/sensitive'

const SOURCE_LABEL: Record<string, string> = {
  name: 'Field name matches',
  id: 'Field id matches',
  placeholder: 'Placeholder matches',
  label: 'Label matches',
  aria: 'Accessible name matches',
  legend: 'Section label matches',
  nearby: 'Nearby text matches',
}

function tag(candidate: Candidate, source: string): Candidate {
  if (!candidate.reason.startsWith('“')) return candidate
  const prefix = SOURCE_LABEL[source] ?? 'Text matches'
  return { ...candidate, reason: `${prefix} ${candidate.reason}` }
}

function sortCandidates(list: Candidate[]): Candidate[] {
  return [...list].sort((a, b) => b.specificity - a.specificity || b.confidence - a.confidence)
}

function resolvePool(list: Candidate[]): Candidate | null {
  if (!list.length) return null
  const sorted = sortCandidates(list)
  const best = sorted[0]
  if (!best) return null
  const second = sorted.find((candidate) => candidate.key !== best.key)
  if (
    second &&
    best.specificity < 5 &&
    best.specificity === second.specificity &&
    best.confidence >= 0.85 &&
    second.confidence >= 0.85 &&
    best.confidence - second.confidence < 0.1
  ) {
    return {
      ...best,
      confidence: Math.min(best.confidence, 0.84),
      reason: `${best.reason}. Also looked like ${FIELD_LABELS[second.key]}, so this needs review`,
    }
  }
  return best
}

function clamp(confidence: number): number {
  return Math.max(0, Math.min(0.99, confidence))
}

export function classify(input: ClassifyInput): Classification {
  const prepared = input.signals
    .map((signal) => ({
      source: signal.source,
      raw: signal.text,
      text: normalize(signal.text),
      tokens: tokenize(signal.text),
    }))
    .filter((signal) => signal.text.length > 0)

  for (const signal of prepared) {
    if (signal.source === 'nearby') continue
    const hit = signal.source === 'options' ? detectSensitiveOptions(signal.raw) : detectSensitiveText(signal.raw)
    if (hit) {
      return { key: hit.key, confidence: hit.confidence, reason: hit.reason, sensitive: true }
    }
  }

  const identity = prepared.filter((signal) => signal.source === 'name' || signal.source === 'id' || signal.source === 'autocomplete')
  const primary = prepared.filter((signal) =>
    signal.source === 'label' || signal.source === 'placeholder' || signal.source === 'aria' || signal.source === 'legend',
  )
  const nearby = prepared.filter((signal) => signal.source === 'nearby')
  const section = input.section ?? 'unknown'
  const pool: Candidate[] = []

  if (input.adapterHint) {
    pool.push({
      key: input.adapterHint.key,
      confidence: input.adapterHint.confidence,
      reason: input.adapterHint.reason,
      specificity: 5,
    })
  }

  for (const signal of identity) {
    if (signal.source === 'autocomplete') {
      const auto = matchAutocomplete(signal.raw)
      if (auto) pool.push(auto)
      continue
    }
    pool.push(...matchTokenRules(signal.tokens, signal.text, 'strict').map((candidate) => tag(candidate, signal.source)))
  }

  for (const signal of primary) {
    const question = matchQuestion(signal.text)
    if (question) pool.push(question)
    const date = matchDate(signal.text, section)
    if (date) pool.push(date)
    pool.push(...matchTokenRules(signal.tokens, signal.text, 'strict').map((candidate) => tag(candidate, signal.source)))
  }

  const optionText = prepared
    .filter((signal) => signal.source === 'options')
    .map((signal) => signal.text)
    .join(' ')
  const optionHint = matchOptionHints(optionText)
  if (optionHint) pool.push(optionHint)

  let best = resolvePool(pool)
  if (!best) {
    const loose: Candidate[] = []
    for (const signal of nearby) {
      const question = matchQuestion(signal.text)
      if (question) loose.push({ ...question, confidence: Math.min(question.confidence, 0.8) })
      const date = matchDate(signal.text, section)
      if (date) loose.push({ ...date, confidence: Math.min(date.confidence, 0.8) })
      loose.push(...matchTokenRules(signal.tokens, signal.text, 'loose').map((candidate) => tag(candidate, signal.source)))
    }
    best = resolvePool(loose)
  }

  if (!best && input.controlType === 'email') {
    best = { key: 'email', confidence: 0.74, reason: 'Input type is email', specificity: 1 }
  } else if (!best && input.controlType === 'tel') {
    best = { key: 'phone', confidence: 0.74, reason: 'Input type is telephone', specificity: 1 }
  }

  if (!best) {
    return { key: 'unknown', confidence: 0, reason: 'No matching rule', sensitive: false }
  }

  const primaryText = primary.map((signal) => signal.text).join(' ')
  if (mixesAuthorizationAndSponsorship(primaryText) && isWorkQuestion(best.key)) {
    return {
      key: best.key,
      confidence: 0.7,
      reason: 'This question mixes work authorization and sponsorship, so it needs a manual answer.',
      sensitive: false,
    }
  }

  return {
    key: best.key,
    confidence: clamp(best.confidence),
    reason: best.reason,
    sensitive: isSensitiveKey(best.key),
  }
}

function isWorkQuestion(key: CanonicalField): boolean {
  return key === 'workAuthorization' || key === 'requiresSponsorship' || key === 'requiresFutureSponsorship'
}
