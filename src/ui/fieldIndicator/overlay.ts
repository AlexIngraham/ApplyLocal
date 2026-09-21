import { FIELD_LABELS } from '@/classifier/types'
import type { CanonicalField } from '@/classifier/types'
import type { FillBand } from '@/classifier/confidence'
import type { FieldStatus } from '@/adapters/types'

export interface IndicatorModel {
  id: string
  status: FieldStatus
  fillBand: FillBand
  canonical: CanonicalField
  confidence: number
  reason: string
  planReason: string
  proposedValue: string | null
  label: string
  canFill: boolean
  canUndo: boolean
  fillError?: string
  anchor: HTMLElement
}

interface OverlayHandlers {
  onFill: (id: string) => void
  onUndo: (id: string) => void
  onNever: (canonical: CanonicalField) => void
}

export function createOverlay(doc: Document, handlers: OverlayHandlers): { sync: (models: IndicatorModel[]) => void; destroy: () => void } {
  const host = doc.createElement('div')
  host.id = 'applylocal-root'
  const shadow = host.attachShadow({ mode: 'open' })
  const style = doc.createElement('style')
  style.textContent = OVERLAY_CSS
  const layer = doc.createElement('div')
  layer.className = 'layer'
  shadow.append(style, layer)
  doc.documentElement.append(host)

  const dots = new Map<string, { button: HTMLButtonElement; model: IndicatorModel }>()
  let openId: string | null = null
  let popover: HTMLDivElement | null = null
  let frame = 0

  const onScroll = () => schedule()
  const onKey = (event: KeyboardEvent) => {
    if (event.key === 'Escape') closePopover()
  }
  const onDown = (event: Event) => {
    if (!popover) return
    if (event.composedPath().includes(host)) return
    closePopover()
  }
  doc.addEventListener('scroll', onScroll, true)
  window.addEventListener('resize', onScroll)
  doc.addEventListener('keydown', onKey, true)
  doc.addEventListener('pointerdown', onDown, true)

  function schedule() {
    window.cancelAnimationFrame(frame)
    frame = window.requestAnimationFrame(positionAll)
  }

  function sync(models: IndicatorModel[]) {
    const next = new Set(models.map((model) => model.id))
    for (const [id, dot] of dots) {
      if (!next.has(id)) {
        dot.button.remove()
        dots.delete(id)
        if (openId === id) closePopover()
      }
    }
    for (const model of models) {
      const current = dots.get(model.id)
      const button = current?.button ?? createDot(model.id)
      button.dataset.tone = tone(model)
      button.setAttribute('aria-label', `${FIELD_LABELS[model.canonical]}, ${Math.round(model.confidence * 100)} percent`)
      if (!current) {
        layer.append(button)
        dots.set(model.id, { button, model })
      } else {
        current.model = model
      }
    }
    if (openId) renderPopover(openId)
    schedule()
  }

  function createDot(id: string): HTMLButtonElement {
    const button = doc.createElement('button')
    button.type = 'button'
    button.className = 'dot'
    button.addEventListener('mousedown', (event) => event.preventDefault())
    button.addEventListener('click', (event) => {
      event.preventDefault()
      event.stopPropagation()
      if (openId === id) closePopover()
      else {
        openId = id
        renderPopover(id)
      }
    })
    return button
  }

  function renderPopover(id: string) {
    const entry = dots.get(id)
    if (!entry) return
    if (!popover) {
      popover = doc.createElement('div')
      popover.className = 'card'
      layer.append(popover)
    }
    popover.replaceChildren()
    const model = entry.model
    popover.append(
      row('Field', model.label),
      row('Detected', FIELD_LABELS[model.canonical]),
      row('Confidence', `${Math.round(model.confidence * 100)}%`),
      row('Why', model.reason),
      row('Saved value', model.proposedValue ?? 'None saved'),
      row('Status', model.planReason),
    )
    if (model.fillError) popover.append(row('Fill', model.fillError))
    const actions = doc.createElement('div')
    actions.className = 'actions'
    const fill = doc.createElement('button')
    fill.type = 'button'
    fill.textContent = 'Fill'
    fill.disabled = !model.canFill
    fill.addEventListener('click', () => handlers.onFill(model.id))
    const undo = doc.createElement('button')
    undo.type = 'button'
    undo.textContent = 'Undo'
    undo.disabled = !model.canUndo
    undo.addEventListener('click', () => handlers.onUndo(model.id))
    const never = doc.createElement('button')
    never.type = 'button'
    never.textContent = 'Never autofill this type'
    never.addEventListener('click', () => handlers.onNever(model.canonical))
    actions.append(fill, undo, never)
    popover.append(actions)
    positionAll()
  }

  function closePopover() {
    openId = null
    popover?.remove()
    popover = null
  }

  function positionAll() {
    for (const { button, model } of dots.values()) {
      const rect = model.anchor.getBoundingClientRect()
      if (rect.width < 2 || rect.height < 2) {
        button.style.display = 'none'
        continue
      }
      button.style.display = 'block'
      const left = Math.min(rect.right + 6, window.innerWidth - 18)
      button.style.left = `${left}px`
      button.style.top = `${rect.top + rect.height / 2 - 5}px`
    }
    if (!popover || !openId) return
    const entry = dots.get(openId)
    if (!entry) return
    const rect = entry.model.anchor.getBoundingClientRect()
    popover.style.top = `${Math.min(rect.bottom + 8, window.innerHeight - 240)}px`
    popover.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - 288))}px`
  }

  return {
    sync,
    destroy() {
      window.cancelAnimationFrame(frame)
      doc.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onScroll)
      doc.removeEventListener('keydown', onKey, true)
      doc.removeEventListener('pointerdown', onDown, true)
      host.remove()
    },
  }
}

function row(label: string, value: string): HTMLParagraphElement {
  const p = document.createElement('p')
  const strong = document.createElement('strong')
  strong.textContent = label
  p.append(strong, document.createTextNode(` ${value}`))
  return p
}

function tone(model: IndicatorModel): string {
  if (model.status === 'autofilled') return 'green'
  if (model.status === 'suggested') return 'yellow'
  return 'gray'
}

const OVERLAY_CSS = `
  .layer { position: fixed; inset: 0; z-index: 2147483646; pointer-events: none; }
  .dot, .card button { pointer-events: auto; }
  .dot {
    position: fixed; width: 10px; height: 10px; border-radius: 99px; border: 2px solid #fff;
    padding: 0; box-shadow: 0 0 0 1px rgba(28, 25, 21, 0.25); cursor: pointer;
  }
  .dot[data-tone="green"] { background: #1d6b45; }
  .dot[data-tone="yellow"] { background: #c48a12; }
  .dot[data-tone="gray"] { background: #8a8478; }
  .card {
    position: fixed; width: 270px; max-height: 280px; overflow: auto; padding: 10px 12px;
    background: #fffcf7; color: #1c1915; border: 1px solid #e4ddd2; border-radius: 8px;
    box-shadow: 0 10px 30px rgba(28, 25, 21, 0.16); font: 12px/1.4 "Segoe UI", sans-serif;
    pointer-events: auto;
  }
  .card p { margin: 0 0 6px; }
  .card strong { display: block; font-size: 10px; letter-spacing: 0.04em; text-transform: uppercase; color: #6e675c; }
  .actions { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
  .actions button {
    border: 1px solid #d9d2c6; background: #fff; color: #1c1915; border-radius: 4px; padding: 4px 8px; cursor: pointer;
  }
  .actions button:first-child { background: #1d6b45; color: white; border-color: #1d6b45; }
  .actions button:disabled { opacity: 0.45; cursor: default; }
`
