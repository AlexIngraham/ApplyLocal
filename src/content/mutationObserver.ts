import { devLog } from '@/utils/logging'

/** Reconcile the document once per batch: removals and reused controls matter too. */
export function observeAdditions(doc: Document, onAdded: (nodes: ParentNode[]) => void, reconcile = false): () => void {
  const win = doc.defaultView ?? window
  let pending: ParentNode[] = []
  let timer = 0
  let url = win.location.href
  const relevant = 'input, select, textarea, [role="combobox"], [role="checkbox"], h1, h2, h3, h4, [role="heading"], legend'
  const own = (node: Node) => node instanceof Element && (node.id.startsWith('applylocal') || Boolean(node.closest('[id^="applylocal"]')))
  const containsControls = (node: Node) => node instanceof Element && !own(node) && (node.matches(relevant) || Boolean(node.querySelector(relevant)))
  function schedule() {
    win.clearTimeout(timer)
    timer = win.setTimeout(() => {
      const batch = reconcile ? [doc] : [...new Set(pending)]
      pending = []
      onAdded(batch.length ? batch : [doc])
    }, 200)
  }
  const onAddClick = (event: Event) => {
    const target = event.target instanceof Element ? event.target.closest('button, [role="button"]') : null
    if (target && /\badd\b/i.test(`${target.textContent} ${target.getAttribute('aria-label')}`)) schedule()
  }
  doc.addEventListener('click', onAddClick)
  const observer = new MutationObserver((mutations) => {
    if (!reconcile) {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) if (node instanceof HTMLElement && !own(node)) pending.push(node)
      }
      if (pending.length) schedule()
      return
    }
    if (mutations.some((mutation) => {
      if (own(mutation.target)) return false
      if (mutation.type === 'attributes') return containsControls(mutation.target)
      if (mutation.type === 'characterData') return Boolean(mutation.target.parentElement?.closest('h1,h2,h3,h4,[role="heading"],legend'))
      return [...mutation.addedNodes, ...mutation.removedNodes].some(containsControls)
    })) schedule()
  })
  observer.observe(doc.documentElement, {
    childList: true, subtree: true, characterData: true, attributes: true,
    attributeFilter: ['hidden', 'aria-hidden', 'inert', 'style', 'class', 'disabled', 'readonly', 'role', 'aria-label', 'aria-labelledby', 'name', 'id', 'data-automation-id', 'aria-controls'],
  })
  // Content scripts run in an isolated world. Checking location also sees main-world
  // pushState/replaceState without patching the site's history implementation.
  const routeTimer = win.setInterval(() => {
    if (url === win.location.href) return
    url = win.location.href
    devLog('Page route changed; rescanning controls')
    schedule()
  }, 500)
  return () => {
    win.clearTimeout(timer)
    win.clearInterval(routeTimer)
    doc.removeEventListener('click', onAddClick)
    observer.disconnect()
  }
}
