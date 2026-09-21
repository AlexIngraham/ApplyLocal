export function observeAdditions(doc: Document, onAdded: (nodes: ParentNode[]) => void): () => void {
  let pending: ParentNode[] = []
  let timer = 0
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      mutation.addedNodes.forEach((node) => {
        if (!(node instanceof HTMLElement)) return
        if (node.id.startsWith('applylocal')) return
        if (node.closest('[id^="applylocal"]')) return
        pending.push(node)
      })
    }
    if (!pending.length) return
    window.clearTimeout(timer)
    timer = window.setTimeout(() => {
      const batch = pending
      pending = []
      onAdded(batch)
    }, 200)
  })
  observer.observe(doc.documentElement, { childList: true, subtree: true })
  return () => {
    window.clearTimeout(timer)
    observer.disconnect()
  }
}
