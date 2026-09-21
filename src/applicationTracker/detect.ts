import { normalize } from '@/classifier/normalize'
import { cleanText } from '@/utils/dom'
import { isGreenhouseUrl, isLeverUrl } from '@/platform/detect'

const SUCCESS_PHRASES = [
  /thank you for applying/,
  /thanks for applying/,
  /application (?:has been |was )?submitted/,
  /we (?:have )?received your application/,
  /your application has been (?:received|submitted)/,
  /successfully applied/,
  /successfully submitted your application/,
]

export interface SuccessSignals {
  title: string
  h1: string
  alert: string
  url: string
}

export function detectSuccess(input: SuccessSignals): boolean {
  const blob = normalize(`${input.title}\n${input.h1}\n${input.alert}`)
  return SUCCESS_PHRASES.some((phrase) => phrase.test(blob))
}

export function guessJobTitle(h1: string): string {
  const title = cleanText(h1)
  if (!title) return ''
  if (detectSuccess({ title: '', h1: title, alert: '', url: '' })) return ''
  return title.slice(0, 140)
}

export function guessCompanyFromUrl(url: string): string {
  try {
    const parsed = new URL(url)
    if (isGreenhouseUrl(url) || isLeverUrl(url)) {
      const slug = parsed.pathname
        .split('/')
        .filter(Boolean)
        .find((part) => part !== 'jobs' && part !== 'job' && part !== 'apply' && !/^\d+$/.test(part) && part.length < 80)
      if (slug) return prettify(slug)
    }
    const host = parsed.hostname.replace(/^www\./, '').split('.')[0]
    return host ? prettify(host) : ''
  } catch {
    return ''
  }
}

function prettify(value: string): string {
  return value
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b[a-z]/g, (letter) => letter.toUpperCase())
}

export function readSuccessSignals(doc: Document, url: string): SuccessSignals {
  const alert = doc.querySelector('[role="alert"], .confirmation, .thank-you, .thankyou')
  return {
    title: doc.title,
    h1: doc.querySelector('h1')?.textContent || '',
    alert: alert?.textContent || '',
    url,
  }
}
