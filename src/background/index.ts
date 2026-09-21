import { ensureStoredDefaults } from '@/profile/bootstrap'
import type { ContentRequest, FrameRecord } from '@/shared/messages'

void ensureStoredDefaults()

chrome.runtime.onInstalled.addListener(() => {
  void ensureStoredDefaults()
})

chrome.runtime.onMessage.addListener((message: ContentRequest, sender, sendResponse) => {
  if (message?.type !== 'al:hello' || sender.tab?.id == null || sender.frameId == null) return
  const key = `al-frame:${sender.tab.id}:${sender.frameId}`
  const record: FrameRecord = {
    tabId: sender.tab.id,
    frameId: sender.frameId,
    href: message.href,
    at: Date.now(),
  }
  void chrome.storage.session.set({ [key]: record }).then(() => sendResponse({ ok: true }))
  return true
})
