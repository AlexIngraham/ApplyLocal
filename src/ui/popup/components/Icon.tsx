import type { CSSProperties } from 'react'

const paths = {
  overview: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
  user: 'M20 21v-2a7 7 0 0 0-14 0v2 M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8',
  settings: 'M4 7h16 M4 17h16 M8 4v6 M16 14v6',
  chevron: 'm6 9 6 6 6-6',
  check: 'm5 12 4 4L19 6',
  shield: 'M12 3 3 7v5c0 5 9 9 9 9s9-4 9-9V7z m-4 9 3 3 5-6',
  link: 'm10 13 4-4 M8 16l-1 1a4 4 0 0 1-6-6l5-5a4 4 0 0 1 6 0 M16 8l1-1a4 4 0 0 1 6 6l-5 5a4 4 0 0 1-6 0',
  education: 'm2 9 10-5 10 5-10 5z M6 11v6q6 5 12 0v-6 M22 9v8',
  work: 'M8 7V4h8v3 M3 7h18v14H3z M3 12q9 5 18 0 M12 12v4',
  contact: 'M3 5h18v14H3z m0 0 9 7 9-7',
  skills: 'm8 5-6 7 6 7 M16 5l6 7-6 7 M14 3l-4 18',
  plus: 'M12 5v14 M5 12h14',
  trash: 'M3 6h18 M9 6V3h6v3 M5 6l1 15h12l1-15 M10 10v7 M14 10v7',
  globe: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0 M3 12h18 M12 3q-8 9 0 18 M12 3q8 9 0 18',
  refresh: 'M20 7v5h-5 M4 17v-5h5 M6 6a8 8 0 0 1 14 6 M18 18a8 8 0 0 1-14-6',
  arrow: 'M4 12h16 m-6-6 6 6-6 6',
  warning: 'm12 3 10 18H2z M12 9v5 M12 17v.1',
  info: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0 M12 11v6 M12 7v.1',
  close: 'm6 6 12 12 M6 18 18 6',
  download: 'M12 3v12 m-5-5 5 5 5-5 M4 16v5h16v-5',
  upload: 'M12 16V4 m-5 5 5-5 5 5 M4 16v5h16v-5',
  spinner: 'M21 12a9 9 0 1 1-9-9',
} as const
export type IconName = keyof typeof paths
export function Icon({ name, className = '', style }: { name: IconName; className?: string; style?: CSSProperties }) {
  return <svg className={`icon ${className}`} style={style} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>
}
