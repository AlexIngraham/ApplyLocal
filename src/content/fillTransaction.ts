const active = new WeakMap<Document, number>()
export const FILL_SETTLED_EVENT = 'applylocal-fill-settled'
export function fillInProgress(doc: Document): boolean { return (active.get(doc) ?? 0) > 0 }

/** Synthetic event tracking stays synchronous so real user edits still cancel async fills. */
export function beginFill(doc: Document): () => void {
  active.set(doc, (active.get(doc) ?? 0) + 1)
  let ended = false
  return () => {
    if (ended) return
    ended = true
    const remaining = (active.get(doc) ?? 1) - 1
    active.set(doc, remaining)
    if (!remaining) doc.dispatchEvent(new Event(FILL_SETTLED_EVENT))
  }
}
