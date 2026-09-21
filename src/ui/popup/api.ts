import type { ContentRequest, ContentResponse, FrameRecord, ScanSnapshot } from '@/shared/messages'
import { ATS_LABELS, detectAtsFromUrl } from '@/platform/detect'
import type { AtsId } from '@/platform/detect'

export interface PageState {
  url: string
  ats: AtsId
  atsLabel: string
  error?: string
  snapshot?: ScanSnapshot
}

export async function loadPageState(): Promise<PageState> {
  const tab = await activeTab()
  if (!tab?.id) return { url: '', ats: 'generic', atsLabel: ATS_LABELS.generic, error: 'No active tab.' }
  const url = tab.url || ''
  const ats = detectAtsFromUrl(url)
  if (isRestricted(url)) {
    return { url, ats, atsLabel: ATS_LABELS[ats], error: 'Chrome blocks extensions on this page.' }
  }
  try {
    await ensureFrames(tab.id)
    const frames = await readFrames(tab.id)
    const snapshots: ScanSnapshot[] = []
    for (const frame of frames) {
      try {
        const response = await send(tab.id, frame.frameId, { type: 'al:get-state' })
        if (response.ok) snapshots.push(response)
      } catch {
        await chrome.storage.session.remove(`al-frame:${tab.id}:${frame.frameId}`)
      }
    }
    if (!snapshots.length) {
      try {
        const response = await send(tab.id, undefined, { type: 'al:get-state' })
        if (response.ok) snapshots.push(response)
      } catch {
        return {
          url,
          ats,
          atsLabel: ATS_LABELS[ats],
          error: 'Open a job application, then try again.',
        }
      }
    }
    return { url, ...combine(snapshots, url) }
  } catch {
    return { url, ats, atsLabel: ATS_LABELS[ats], error: 'ApplyLocal could not scan this page.' }
  }
}

export async function runPageCommand(type: 'al:scan' | 'al:autofill'): Promise<PageState> {
  const tab = await activeTab()
  if (!tab?.id) return { url: '', ats: 'generic', atsLabel: ATS_LABELS.generic, error: 'No active tab.' }
  const frames = await readFrames(tab.id)
  const snapshots: ScanSnapshot[] = []
  const targets = frames.length ? frames : [{ tabId: tab.id, frameId: 0, href: tab.url || '', at: 0 }]
  for (const frame of targets) {
    try {
      const response = await send(tab.id, frames.length ? frame.frameId : undefined, { type })
      if (response.ok) snapshots.push(response)
    } catch {
      /* that frame may have closed */
    }
  }
  return { url: tab.url || '', ...combine(snapshots, tab.url || '') }
}

async function ensureFrames(tabId: number): Promise<void> {
  let frames = await readFrames(tabId)
  if (frames.length) return
  try {
    await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] })
  } catch {
    return
  }
  frames = await waitForFrames(tabId)
  if (!frames.length) {
    try {
      await send(tabId, undefined, { type: 'al:get-state' })
    } catch {
      /* caller reports the empty state */
    }
  }
}

async function waitForFrames(tabId: number): Promise<FrameRecord[]> {
  const start = Date.now()
  while (Date.now() - start < 1600) {
    const frames = await readFrames(tabId)
    if (frames.length) return frames
    await new Promise((resolve) => window.setTimeout(resolve, 100))
  }
  return []
}

async function readFrames(tabId: number): Promise<FrameRecord[]> {
  const all = await chrome.storage.session.get(null)
  return Object.entries(all)
    .filter(([key]) => key.startsWith(`al-frame:${tabId}:`))
    .map(([, value]) => value as FrameRecord)
    .filter((frame) => frame && typeof frame.frameId === 'number')
}

function send(tabId: number, frameId: number | undefined, message: ContentRequest): Promise<ContentResponse> {
  return new Promise((resolve, reject) => {
    const callback = (response: ContentResponse) => {
      const err = chrome.runtime.lastError
      if (err) reject(new Error(err.message))
      else resolve(response ?? { ok: false, error: 'Empty response.' })
    }
    if (frameId == null) chrome.tabs.sendMessage(tabId, message, callback)
    else chrome.tabs.sendMessage(tabId, message, { frameId }, callback)
  })
}

function combine(snapshots: ScanSnapshot[], url: string): Pick<PageState, 'ats' | 'atsLabel' | 'snapshot'> {
  const ats = snapshots.some((item) => item.ats === 'workday')
    ? 'workday'
    : snapshots.some((item) => item.ats === 'greenhouse')
      ? 'greenhouse'
      : snapshots.some((item) => item.ats === 'lever')
        ? 'lever'
        : detectAtsFromUrl(url)
  const fields = snapshots.flatMap((item, index) =>
    item.fields.map((field) => ({ ...field, id: `${index}-${field.id}` })),
  )
  const counts = snapshots.reduce(
    (sum, item) => ({
      detected: sum.detected + item.counts.detected,
      autofilled: sum.autofilled + item.counts.autofilled,
      review: sum.review + item.counts.review,
      skipped: sum.skipped + item.counts.skipped,
      unrecognized: sum.unrecognized + item.counts.unrecognized,
    }),
    { detected: 0, autofilled: 0, review: 0, skipped: 0, unrecognized: 0 },
  )
  const enabled = snapshots.length ? snapshots.every((item) => item.enabled) : true
  return {
    ats,
    atsLabel: ATS_LABELS[ats],
    snapshot: {
      ok: true,
      href: url,
      ats,
      atsLabel: ATS_LABELS[ats],
      counts,
      fields,
      enabled,
    },
  }
}

async function activeTab(): Promise<chrome.tabs.Tab | undefined> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  return tab
}

function isRestricted(url: string): boolean {
  return /^(chrome|chrome-extension|edge|about|view-source|devtools):/.test(url)
}
