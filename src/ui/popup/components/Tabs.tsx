import { useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { Icon } from './Icon'
import type { IconName } from './Icon'

export type Tab = 'overview' | 'profile' | 'settings'
const tabs: { id: Tab; label: string; icon: IconName }[] = [
  { id: 'overview', label: 'Overview', icon: 'overview' },
  { id: 'profile', label: 'Profile', icon: 'user' },
  { id: 'settings', label: 'Settings', icon: 'settings' },
]
export function Tabs({ value, onChange, panels }: { value: Tab; onChange: (tab: Tab) => void; panels: Record<Tab, ReactNode> }) {
  const buttons = useRef<(HTMLButtonElement | null)[]>([])
  const [previous, setPrevious] = useState(value)
  const [direction, setDirection] = useState(1)
  const index = tabs.findIndex(tab => tab.id === value)
  if (previous !== value) {
    setDirection(index > tabs.findIndex(tab => tab.id === previous) ? 1 : -1)
    setPrevious(value)
  }
  return <>
    <nav className="tabs" role="tablist" aria-label="Sections" style={{ '--tab-index': index } as CSSProperties}>
      <span className="tab-indicator" aria-hidden="true" />
      {tabs.map((tab, i) => <button key={tab.id} ref={node => { buttons.current[i] = node }} type="button" role="tab" id={`tab-${tab.id}`} aria-controls={`panel-${tab.id}`} aria-selected={value === tab.id} tabIndex={value === tab.id ? 0 : -1} onClick={() => onChange(tab.id)} onKeyDown={event => {
        const next = event.key === 'ArrowRight' ? (i + 1) % tabs.length : event.key === 'ArrowLeft' ? (i + tabs.length - 1) % tabs.length : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : -1
        if (next < 0) return
        event.preventDefault(); onChange(tabs[next].id); buttons.current[next]?.focus()
      }}><Icon name={tab.icon} />{tab.label}</button>)}
    </nav>
    <div className="panels" style={{ '--direction': direction } as CSSProperties}>
      {tabs.map(tab => <section key={tab.id} className="panel" id={`panel-${tab.id}`} role="tabpanel" aria-labelledby={`tab-${tab.id}`} tabIndex={0} data-active={value === tab.id} aria-hidden={value !== tab.id} inert={value !== tab.id}>{panels[tab.id]}</section>)}
    </div>
  </>
}
