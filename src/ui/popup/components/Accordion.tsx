import { useId, useState } from 'react'
import type { ReactNode } from 'react'
import { Icon } from './Icon'
import type { IconName } from './Icon'

export function Accordion({ title, summary, icon, badge, defaultOpen = false, children, className = '' }: { title: string; summary?: string; icon?: IconName; badge?: ReactNode; defaultOpen?: boolean; children: ReactNode; className?: string }) {
  const [open, setOpen] = useState(defaultOpen)
  const id = useId()
  return <section className={`accordion ${className}`} data-open={open}>
    <h3 className="accordion-heading"><button type="button" id={`${id}-trigger`} className="accordion-trigger" aria-expanded={open} aria-controls={`${id}-content`} onClick={() => setOpen(!open)}>
      {icon && <span className="section-icon"><Icon name={icon} /></span>}
      <span className="accordion-copy"><strong>{title}</strong>{summary && <small>{summary}</small>}</span>
      {badge}<Icon name="chevron" className="chevron" />
    </button></h3>
    <div className="collapse" id={`${id}-content`} role="region" aria-labelledby={`${id}-trigger`} aria-hidden={!open} inert={!open}>
      <div className="collapse-clip"><div className="accordion-content">{children}</div></div>
    </div>
  </section>
}
