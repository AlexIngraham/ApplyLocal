import { useEffect, useRef, useState } from 'react'

// Preserve the existing debounce intervals and avoid writes on mount/navigation.
export function useAutosave<T>(value: T | null, save: (value: T) => Promise<void>, delay: number) {
  const saved = useRef<T | null>(null)
  const timer = useRef(0)
  const [status, setStatus] = useState<'saved' | 'saving' | 'error'>('saved')
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    if (value === null) return
    if (saved.current === null) { saved.current = value; return }
    if (saved.current === value) { setStatus('saved'); return }
    let current = true
    setStatus('saving')
    timer.current = window.setTimeout(() => {
      void save(value).then(() => {
        if (current) { saved.current = value; setStatus('saved') }
      }).catch(() => { if (current) setStatus('error') })
    }, delay)
    return () => { current = false; window.clearTimeout(timer.current) }
  }, [value, save, delay, retry])
  return {
    status,
    retry: () => setRetry(count => count + 1),
    cancel: () => window.clearTimeout(timer.current),
    markSaved: (next: T) => { saved.current = next; setStatus('saved') },
  }
}
