let depth = 0

export function isSyntheticFill(): boolean {
  return depth > 0
}

export function withSyntheticFill<T>(fn: () => T): T {
  depth += 1
  try {
    return fn()
  } finally {
    depth -= 1
  }
}

export function dispatchValueEvents(el: HTMLElement): void {
  el.dispatchEvent(new Event('input', { bubbles: true }))
  el.dispatchEvent(new Event('change', { bubbles: true }))
  el.dispatchEvent(new FocusEvent('blur', { bubbles: true }))
}
