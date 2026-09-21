import type { DetectedField } from '@/adapters/types'
import type { CanonicalField } from '@/classifier/types'
import { normalize } from '@/classifier/normalize'
import { parseDateParts } from '@/content/matchers'
import { ariaText, labelForControl } from '@/utils/dom'

const DATE_FIELDS = new Set<CanonicalField>([
  'educationStart',
  'graduationDate',
  'employmentStart',
  'employmentEnd',
])

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

/** Returns ordered values appropriate for this specific date control. */
export function dateCandidatesForControl(field: DetectedField, value: string): string[] | null {
  if (!DATE_FIELDS.has(field.canonical)) return null
  const parts = parseDateParts(value)
  if (!parts) return []
  const element = field.control.elements[0]
  const raw = controlDescription(element)
  const description = normalize(raw)
  const inputType = field.control.inputType

  if (inputType === 'date' || hasDayFormat(raw, description)) {
    if (/mm\s*[/.-]\s*dd\s*[/.-]\s*yyyy/i.test(raw) || /\bmm dd yyyy\b/.test(description)) {
      return [`${parts.month}/${parts.day ?? '01'}/${parts.year}`]
    }
    return [`${parts.year}-${parts.month}-${parts.day ?? '01'}`]
  }
  if (inputType === 'month') return [`${parts.year}-${parts.month}`]
  if (hasMonthYearFormat(raw, description)) return [`${parts.month}/${parts.year}`]

  const separateYear = /\b(year|yyyy)\b/.test(description)
  const separateMonth = /\b(month|mm)\b/.test(description)
  if (separateYear && !separateMonth) return [parts.year]
  if (separateMonth && !separateYear) {
    const monthIndex = Number(parts.month) - 1
    const monthName = MONTH_NAMES[monthIndex]
    const numeric = String(Number(parts.month))
    if (field.control.kind === 'select' || field.control.kind === 'combobox') {
      return monthName ? [monthName, monthName.slice(0, 3), parts.month, numeric] : [parts.month, numeric]
    }
    return [parts.month]
  }

  if (field.adapterId === 'workday' && field.control.kind === 'text') {
    return [`${parts.month}/${parts.year}`]
  }
  return [value]
}

function controlDescription(element: HTMLElement | undefined): string {
  if (!element) return ''
  return [
    element.getAttribute('placeholder'),
    element.getAttribute('name'),
    element.getAttribute('id'),
    element.getAttribute('data-automation-id'),
    element.getAttribute('aria-label'),
    ariaText(element),
    labelForControl(element),
  ]
    .filter(Boolean)
    .join(' ')
}

function hasDayFormat(raw: string, description: string): boolean {
  return (
    /(?:mm|month)\s*[/.-]\s*(?:dd|day)\s*[/.-]\s*(?:yyyy|year)/i.test(raw) ||
    /(?:yyyy|year)\s*[/.-]\s*(?:mm|month)\s*[/.-]\s*(?:dd|day)/i.test(raw) ||
    /\b(mm dd yyyy|yyyy mm dd|month day year|year month day)\b/.test(description)
  )
}

function hasMonthYearFormat(raw: string, description: string): boolean {
  return (
    /(?:mm|month)\s*[/.-]\s*(?:yyyy|year)/i.test(raw) ||
    /(?:yyyy|year)\s*[/.-]\s*(?:mm|month)/i.test(raw) ||
    /\b(mm yyyy|yyyy mm|month year|year month)\b/.test(description)
  )
}
