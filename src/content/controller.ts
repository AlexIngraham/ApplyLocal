import type { CanonicalField } from '@/classifier/types'
import type { DetectedField } from '@/adapters/types'
import type { AtsId } from '@/platform/detect'
import { ATS_LABELS } from '@/platform/detect'
import { selectAdapter } from '@/adapters/registry'
import { scanDocument } from '@/content/scanner'
import { applyDetectedFields, fillOne, undoField } from '@/content/apply'
import { observeAdditions } from '@/content/mutationObserver'
import { summarize } from '@/content/summary'
import { isSyntheticFill } from '@/utils/events'
import { devLog } from '@/utils/logging'
import { loadProfile } from '@/profile/storage'
import { createId } from '@/profile/defaults'
import type { Profile } from '@/profile/types'
import { loadSettings, saveSettings } from '@/settings/storage'
import type { Settings } from '@/settings/types'
import { addApplication } from '@/applicationTracker/storage'
import { detectSuccess, readSuccessSignals } from '@/applicationTracker/detect'
import { createOverlay } from '@/ui/fieldIndicator/overlay'
import type { IndicatorModel } from '@/ui/fieldIndicator/overlay'
import { showSuccessBanner, successDraftFrom } from '@/content/successBanner'
import type { ContentRequest, ContentResponse, ScanSnapshot } from '@/shared/messages'

type Overlay = ReturnType<typeof createOverlay>

export function startController(doc: Document, win: Window): void {
  let profile: Profile | null = null
  let settings: Settings | null = null
  let fields: DetectedField[] = []
  const byElement = new WeakMap<HTMLElement, DetectedField>()
  const manuallyEdited = new Set<string>()
  let fieldSequence = 0
  let overlay: Overlay | null = null
  let stopObserver: (() => void) | null = null
  let ats: AtsId = 'generic'
  let started = false
  const currentUrl = () => win.location.href

  const ready = (async () => {
    profile = await loadProfile()
    settings = await loadSettings()
    hello()
    if (settings.enabled) activate()
  })()

  chrome.runtime.onMessage.addListener((message: ContentRequest, _sender, sendResponse) => {
    void ready
      .then(() => handle(message))
      .then(sendResponse)
      .catch(() => sendResponse({ ok: false, error: 'ApplyLocal could not read this page.' }))
    return true
  })

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || (!changes.profile && !changes.settings)) return
    void ready.then(async () => {
      profile = await loadProfile()
      settings = await loadSettings()
      if (!settings.enabled) {
        deactivate()
        return
      }
      if (!started) activate()
      else refresh()
    })
  })

  doc.addEventListener('input', onUserEdit, true)
  doc.addEventListener('change', onUserEdit, true)

  function hello() {
    try {
      chrome.runtime.sendMessage({ type: 'al:hello', href: currentUrl() }, () => {
      void chrome.runtime.lastError
    })
    } catch {
      devLog('frame registration failed')
    }
  }

  function activate() {
    if (!profile || !settings || started) return
    started = true
    overlay = createOverlay(doc, {
      onFill: (id) => {
        const field = fields.find((item) => item.id === id)
        if (!field) return
        const result = fillOne(field)
        if (result instanceof Promise) void result.then(paint)
        else paint()
      },
      onUndo: (id) => {
        const field = fields.find((item) => item.id === id)
        if (!field) return
        undoField(field)
        paint()
      },
      onNever: (canonical) => {
        void neverAutofill(canonical)
      },
    })
    rescan(doc)
    if (settings.autoFillHighConfidence) void applyDetectedFields(fields, 'auto').then(paint)
    paint()
    stopObserver = observeAdditions(doc, (nodes) => {
      for (const node of nodes) rescan(node)
      if (settings?.autoFillHighConfidence) void applyDetectedFields(fields, 'auto').then(paint)
      paint()
    })
    maybeOfferToSave()
    devLog('scan ready', { fields: fields.length, ats })
  }

  function deactivate() {
    stopObserver?.()
    stopObserver = null
    overlay?.destroy()
    overlay = null
    started = false
    fields = []
  }

  function refresh() {
    rescan(doc)
    if (settings?.autoFillHighConfidence) void applyDetectedFields(fields, 'auto').then(paint)
    paint()
  }

  function rescan(root: ParentNode) {
    if (!profile || !settings) return
    if (root === doc) {
      const adapter = selectAdapter(currentUrl(), doc, settings)
      ats = adapter.id === 'greenhouse' || adapter.id === 'lever' || adapter.id === 'workday' ? adapter.id : 'generic'
    }
    const result = scanDocument(root, { url: currentUrl(), profile, settings })
    merge(result.fields)
  }

  function merge(detected: DetectedField[]) {
    for (const field of detected) {
      let existing = field.control.elements.map((el) => byElement.get(el)).find((item) => item !== undefined)
      if (!existing) {
        const key = fieldKey(field)
        existing = fields.find(
          (item) => fieldKey(item) === key && !item.control.elements.some((element) => element.isConnected),
        )
      }
      if (existing) {
        existing.canonical = field.canonical
        existing.confidence = field.confidence
        existing.reason = field.reason
        existing.proposedValue = field.proposedValue
        existing.plan = field.plan
        existing.fillBand = field.fillBand
        existing.label = field.label
        existing.repeatIndex = field.repeatIndex
        existing.repeatedSection = field.repeatedSection
        existing.sensitive = field.sensitive
        existing.adapterId = field.adapterId
        existing.control = field.control
        if (!existing.fillError && !existing.locked) existing.planReason = field.planReason
        for (const el of field.control.elements) byElement.set(el, existing)
        if (!existing.locked && existing.status !== 'autofilled' && existing.status !== 'manual') existing.status = field.status
        continue
      }
      field.id = `f${++fieldSequence}`
      if (manuallyEdited.has(fieldKey(field))) {
        field.locked = true
        field.status = 'manual'
        field.planReason = 'You edited this field, so ApplyLocal will leave it alone.'
      }
      fields.push(field)
      for (const el of field.control.elements) byElement.set(el, field)
    }
    fields = fields.filter((field) => field.control.elements.some((el) => el.isConnected))
  }

  function paint() {
    if (!settings?.showFieldIndicators) {
      overlay?.sync([])
      return
    }
    overlay?.sync(
      fields
        .filter((field) => field.fillBand !== 'none' && field.control.elements[0])
        .map(toModel),
    )
  }

  function onUserEdit(event: Event) {
    if (isSyntheticFill()) return
    const target = event.target
    if (!(target instanceof HTMLElement)) return
    const field = byElement.get(target)
    if (!field || field.locked) return
    field.locked = true
    field.status = 'manual'
    field.planReason = 'You edited this field, so ApplyLocal will leave it alone.'
    manuallyEdited.add(fieldKey(field))
    paint()
  }

  async function neverAutofill(canonical: CanonicalField) {
    const next = await loadSettings()
    if (!next.disabledFields.includes(canonical)) {
      next.disabledFields = [...next.disabledFields, canonical]
      await saveSettings(next)
    }
  }

  function maybeOfferToSave() {
    const signals = readSuccessSignals(doc, currentUrl())
    if (!detectSuccess(signals)) return
    const h1 = doc.querySelector('h1')?.textContent || ''
    showSuccessBanner(doc, successDraftFrom(currentUrl(), h1), async (draft) => {
      try {
        await addApplication({
          id: createId('app'),
          company: draft.company,
          jobTitle: draft.jobTitle,
          url: currentUrl(),
          ats: ATS_LABELS[ats],
          dateApplied: new Date().toISOString(),
          status: 'applied',
          notes: draft.notes,
        })
        return true
      } catch {
        return false
      }
    })
  }

  async function handle(message: ContentRequest): Promise<ContentResponse> {
    if (!message || typeof message !== 'object' || !('type' in message)) {
      return { ok: false, error: 'Unknown request.' }
    }
    if (message.type === 'al:hello') return snapshot()
    if (!settings?.enabled) return snapshot()
    if (!started) activate()
    if (message.type === 'al:scan') refresh()
    if (message.type === 'al:autofill') {
      await applyDetectedFields(fields, 'page')
      paint()
    }
    return snapshot()
  }

  function snapshot(): ScanSnapshot {
    return summarize(fields, {
      href: currentUrl(),
      ats,
      atsLabel: ATS_LABELS[ats],
      enabled: settings?.enabled ?? false,
    })
  }

  function toModel(field: DetectedField): IndicatorModel {
    const anchor = field.control.elements[0] as HTMLElement
    return {
      id: field.id,
      status: field.status,
      fillBand: field.fillBand,
      canonical: field.canonical,
      confidence: field.confidence,
      reason: field.reason,
      planReason: field.planReason,
      proposedValue: field.sensitive && field.fillBand === 'blocked' ? null : displayValue(field.proposedValue),
      label: field.label,
      canFill:
        (field.fillBand === 'high' || field.fillBand === 'review') &&
        (Array.isArray(field.proposedValue) ? field.proposedValue.length > 0 : Boolean(field.proposedValue)),
      canUndo: field.previousValue != null,
      fillError: field.fillError,
      anchor,
    }
  }

  function fieldKey(field: DetectedField): string {
    const el = field.control.elements[0]
    const identity =
      el?.getAttribute('data-automation-id') ||
      el?.getAttribute('name') ||
      el?.getAttribute('id') ||
      el?.getAttribute('aria-label') ||
      field.label
    const section = field.repeatedSection?.sectionKey ?? field.repeatIndex
    return `${field.adapterId}|${field.canonical}|${identity}|${section}`
  }

  function displayValue(value: DetectedField['proposedValue']): string | null {
    if (!value) return null
    return Array.isArray(value) ? value.join(', ') : value
  }
}
