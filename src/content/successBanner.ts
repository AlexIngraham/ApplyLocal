import { guessCompanyFromUrl, guessJobTitle } from '@/applicationTracker/detect'

export interface SuccessDraft {
  company: string
  jobTitle: string
  notes: string
}

export function showSuccessBanner(
  doc: Document,
  draft: SuccessDraft,
  onSave: (draft: SuccessDraft) => Promise<boolean>,
): void {
  const key = `applylocal-success:${location.href}`
  try {
    if (sessionStorage.getItem(key)) return
  } catch {
    return
  }

  const host = doc.createElement('div')
  host.id = 'applylocal-success'
  const shadow = host.attachShadow({ mode: 'open' })
  const style = doc.createElement('style')
  style.textContent = BANNER_CSS
  const card = doc.createElement('section')
  card.setAttribute('role', 'dialog')
  card.setAttribute('aria-label', 'Save application')

  const title = doc.createElement('h2')
  title.textContent = 'Looks like you submitted an application. Save it?'
  const copy = doc.createElement('p')
  copy.textContent = 'Nothing is saved until you confirm. This stays on your device.'

  const company = labeledInput(doc, 'Company', draft.company)
  const jobTitle = labeledInput(doc, 'Job title', draft.jobTitle)
  const notes = labeledInput(doc, 'Notes', draft.notes)

  const actions = doc.createElement('div')
  actions.className = 'actions'
  const save = doc.createElement('button')
  save.type = 'button'
  save.textContent = 'Save'
  const dismiss = doc.createElement('button')
  dismiss.type = 'button'
  dismiss.textContent = 'Dismiss'
  const error = doc.createElement('p')
  error.className = 'error'

  save.addEventListener('click', () => {
    const next = { company: company.input.value.trim(), jobTitle: jobTitle.input.value.trim(), notes: notes.input.value.trim() }
    if (!next.company) {
      error.textContent = 'Add a company name before saving.'
      return
    }
    void onSave(next).then((ok) => {
      if (!ok) {
        error.textContent = 'Could not save on this device.'
        return
      }
      remember(key)
      host.remove()
    })
  })
  dismiss.addEventListener('click', () => {
    remember(key)
    host.remove()
  })

  actions.append(save, dismiss)
  card.append(title, copy, company.label, jobTitle.label, notes.label, error, actions)
  shadow.append(style, card)
  doc.documentElement.append(host)
}

export function successDraftFrom(url: string, h1: string): SuccessDraft {
  return {
    company: guessCompanyFromUrl(url),
    jobTitle: guessJobTitle(h1),
    notes: '',
  }
}

function remember(key: string) {
  try {
    sessionStorage.setItem(key, '1')
  } catch {
    /* private mode can block storage; the banner can show again */
  }
}

function labeledInput(doc: Document, name: string, value: string): { label: HTMLLabelElement; input: HTMLInputElement } {
  const label = doc.createElement('label')
  const span = doc.createElement('span')
  span.textContent = name
  const input = doc.createElement('input')
  input.type = 'text'
  input.value = value
  label.append(span, input)
  return { label, input }
}

const BANNER_CSS = `
  section {
    position: fixed; right: 16px; bottom: 16px; z-index: 2147483646; width: min(360px, calc(100vw - 32px));
    background: #fffcf7; color: #1c1915; border: 1px solid #e4ddd2; border-radius: 10px;
    box-shadow: 0 12px 40px rgba(28, 25, 21, 0.18); padding: 14px; font: 13px/1.4 "Segoe UI", sans-serif;
  }
  h2 { margin: 0 0 6px; font-size: 15px; }
  p { margin: 0 0 10px; color: #5e584e; }
  label { display: block; margin-bottom: 8px; font-size: 11px; color: #6e675c; }
  input { display: block; width: 100%; margin-top: 3px; box-sizing: border-box; border: 1px solid #ddd6cb; border-radius: 4px; padding: 6px 8px; font: inherit; color: inherit; }
  .actions { display: flex; gap: 8px; }
  button { border-radius: 4px; padding: 6px 10px; cursor: pointer; border: 1px solid #d9d2c6; background: white; }
  button:first-child { background: #1d6b45; color: white; border-color: #1d6b45; }
  .error { color: #8d2f2f; min-height: 1em; }
`
