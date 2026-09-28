export type AtsId = 'greenhouse' | 'lever' | 'workday' | 'ashby' | 'generic'

export const ATS_LABELS: Record<AtsId, string> = {
  greenhouse: 'Greenhouse',
  lever: 'Lever',
  workday: 'Workday',
  ashby: 'Ashby',
  generic: 'Generic form',
}

export function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase()
  } catch {
    return ''
  }
}

export function isGreenhouseUrl(url: string): boolean {
  const host = hostnameOf(url)
  return host === 'greenhouse.io' || host.endsWith('.greenhouse.io')
}

export function isLeverUrl(url: string): boolean {
  const host = hostnameOf(url)
  return host === 'lever.co' || host.endsWith('.lever.co')
}

export function isWorkdayUrl(url: string): boolean {
  const host = hostnameOf(url)
  return host === 'myworkdayjobs.com' || host.endsWith('.myworkdayjobs.com')
}

export function isAshbyUrl(url: string): boolean {
  const host = hostnameOf(url)
  return host === 'ashbyhq.com' || host.endsWith('.ashbyhq.com')
}

export function detectAtsFromUrl(url: string): AtsId {
  if (isGreenhouseUrl(url)) return 'greenhouse'
  if (isLeverUrl(url)) return 'lever'
  if (isWorkdayUrl(url)) return 'workday'
  if (isAshbyUrl(url)) return 'ashby'
  return 'generic'
}
