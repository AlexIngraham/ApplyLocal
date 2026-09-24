import { useId } from 'react'
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react'
import { Icon } from './Icon'
import type { IconName } from './Icon'

export function Button({ children, icon, variant = 'secondary', className = '', type = 'button', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { icon?: IconName; variant?: 'primary' | 'secondary' | 'ghost' | 'danger' }) {
  return <button type={type} className={`button ${variant} ${className}`} {...props}>{icon && <Icon name={icon} className={icon === 'spinner' ? 'spin' : ''} />}{children}</button>
}
export function IconButton({ label, icon, ...props }: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & { label: string; icon: IconName }) {
  return <Button {...props} className={`icon-button ${props.className ?? ''}`} icon={icon} aria-label={label} title={label} />
}
export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'success' | 'warning' }) {
  return <span className={`badge ${tone}`}>{children}</span>
}
export function StatusMessage({ children, tone = 'info' }: { children: ReactNode; tone?: 'info' | 'success' | 'warning' | 'error' }) {
  return <div className={`status-message ${tone}`} role={tone === 'error' ? 'alert' : 'status'}><Icon name={tone === 'success' ? 'check' : tone === 'error' ? 'close' : tone === 'warning' ? 'warning' : 'info'} /><div>{children}</div></div>
}
export function TextInput({ label, value, onChange, helper, error, ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> & { label: string; value: string; onChange: (value: string) => void; helper?: string; error?: string }) {
  const id = useId()
  return <label className="field" htmlFor={id}><span>{label}</span><input {...props} id={id} value={value} onChange={e => onChange(e.target.value)} aria-invalid={error ? true : undefined} aria-describedby={helper || error ? `${id}-hint` : undefined} />{(helper || error) && <small id={`${id}-hint`} className={error ? 'error-text' : ''}>{error || helper}</small>}</label>
}
export function Toggle({ label, description, checked, onChange, disabled = false }: { label: string; description?: string; checked: boolean; onChange: (checked: boolean) => void; disabled?: boolean }) {
  const id = useId()
  return <div className="setting-row"><div className="setting-copy"><label id={`${id}-label`} htmlFor={id}>{label}</label>{description && <p id={`${id}-hint`}>{description}</p>}</div><button id={id} type="button" className="switch" role="switch" aria-checked={checked} aria-labelledby={`${id}-label`} aria-describedby={description ? `${id}-hint` : undefined} disabled={disabled} onClick={() => onChange(!checked)}><span /></button></div>
}
export function SectionCard({ title, icon, children }: { title: string; icon: IconName; children: ReactNode }) {
  return <section className="section-card" aria-label={title}><h2><Icon name={icon} />{title}</h2><div className="section-body">{children}</div></section>
}
export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="empty-state">{children}</p>
}
