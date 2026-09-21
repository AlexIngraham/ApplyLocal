import { mergeSettings, SETTINGS_KEY } from '@/settings/defaults'
import type { Settings } from '@/settings/types'

export async function loadSettings(): Promise<Settings> {
  const data = await chrome.storage.local.get(SETTINGS_KEY)
  return mergeSettings(data[SETTINGS_KEY])
}

export async function saveSettings(settings: Settings): Promise<void> {
  await chrome.storage.local.set({ [SETTINGS_KEY]: settings })
}
