import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Accordion } from './Accordion'
import { Button } from './ui'

export function EntryCard({ title, summary, defaultOpen, children, onRemove }: { title: string; summary: string; defaultOpen: boolean; children: ReactNode; onRemove: () => void }) {
  const [removing, setRemoving] = useState(false)
  const container = useRef<HTMLDivElement>(null)
  const latestRemove = useRef(onRemove)
  latestRemove.current = onRemove
  useEffect(() => {
    if (!removing) return
    const timer = window.setTimeout(() => {
      // Return keyboard focus to the section's Add action after this card leaves.
      const section = container.current?.parentElement
      latestRemove.current()
      section?.querySelector<HTMLButtonElement>('.add-entry')?.focus({ preventScroll: true })
    }, window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 0 : 180)
    return () => window.clearTimeout(timer)
  }, [removing])
  return <div ref={container} className="entry-presence" data-removing={removing} inert={removing}>
    <div className="entry-clip"><Accordion className="entry-card" title={title} summary={summary} defaultOpen={defaultOpen}>
      {children}
      <Button variant="danger" icon="trash" className="entry-remove" disabled={removing} onClick={() => setRemoving(true)}>Remove entry</Button>
    </Accordion></div>
  </div>
}
