/** Collapse labels, ids, and names into comparable tokens. */
export function normalize(raw: string): string {
  const camel = raw.replace(/([a-z0-9])([A-Z])/g, '$1 $2')
  const emailish = camel.replace(/e-?mail/gi, 'email')
  return emailish
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

export function tokenize(raw: string): string[] {
  const text = normalize(raw)
  return text ? text.split(' ') : []
}

export function hasSequence(tokens: string[], sequence: string[]): boolean {
  if (!sequence.length || sequence.length > tokens.length) return false
  for (let i = 0; i <= tokens.length - sequence.length; i += 1) {
    let matched = true
    for (let j = 0; j < sequence.length; j += 1) {
      if (tokens[i + j] !== sequence[j]) {
        matched = false
        break
      }
    }
    if (matched) return true
  }
  return false
}
