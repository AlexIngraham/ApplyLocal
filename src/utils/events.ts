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

export function dispatchValueEvents(el: HTMLElement, text?: string): void {
  const win = el.ownerDocument.defaultView ?? window
  const input = text !== undefined && typeof win.InputEvent === 'function'
    ? new win.InputEvent('input', { bubbles: true, composed: true, inputType: 'insertText', data: text })
    : new win.Event('input', { bubbles: true, composed: true })
  el.dispatchEvent(input)
  el.dispatchEvent(new win.Event('change', { bubbles: true, composed: true }))
}
