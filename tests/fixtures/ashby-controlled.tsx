import { useState } from 'react'

// Models Ashby's public text/textarea handlers: React onChange updates a draft,
// while onBlur flushes it to the application's saved answers. No private React
// properties, keyboard simulation, beforeinput handler, or artificial delay.
export const ashbyFields = [
  { id: 'firstName', label: 'First Name', type: 'text', autocomplete: 'given-name' },
  { id: 'lastName', label: 'Last Name', type: 'text', autocomplete: 'family-name' },
  { id: 'email', label: 'Email', type: 'email', autocomplete: 'email' },
  { id: 'phone', label: 'Phone', type: 'tel', autocomplete: 'tel' },
  { id: 'skills', label: 'Skills', type: 'textarea', autocomplete: undefined },
] as const

export function AshbyControlledFixture() {
  const [saved, setSaved] = useState<Record<string, string>>({})
  const [revision, setRevision] = useState(0)
  return <div className="ashby-application-form-container">
    <form onSubmit={event => event.preventDefault()}>
      {ashbyFields.map(field => <DraftField key={field.id} field={field} onCommit={value => setSaved(previous => ({ ...previous, [field.id]: value }))} />)}
      <button type="button" onClick={() => setRevision(value => value + 1)}>Render again</button>
      <output data-saved>{JSON.stringify(saved)}</output>
      <output data-revision>{revision}</output>
    </form>
  </div>
}

function DraftField({ field, onCommit }: { field: typeof ashbyFields[number]; onCommit: (value: string) => void }) {
  const [draft, setDraft] = useState('')
  const props = {
    id: field.id,
    name: field.id,
    value: draft,
    required: true,
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setDraft(event.target.value),
    onBlur: () => onCommit(draft),
  }
  return <div className="ashby-application-form-field-entry">
    <label htmlFor={field.id}>{field.label}</label>
    {field.type === 'textarea' ? <textarea {...props} /> : <input {...props} type={field.type} autoComplete={field.autocomplete} />}
    <output data-draft={field.id}>{draft}</output>
  </div>
}
