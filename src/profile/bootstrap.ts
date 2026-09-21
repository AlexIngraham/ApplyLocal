import { createDefaultProfile, mergeProfile, PROFILE_KEY } from '@/profile/defaults'
import { createDefaultSettings, mergeSettings, SETTINGS_KEY } from '@/settings/defaults'
import { APPLICATIONS_KEY } from '@/applicationTracker/types'

export async function ensureStoredDefaults(): Promise<void> {
  const data = await chrome.storage.local.get([PROFILE_KEY, SETTINGS_KEY, APPLICATIONS_KEY])
  const next: Record<string, unknown> = {}
  if (!data[PROFILE_KEY]) next[PROFILE_KEY] = createDefaultProfile()
  if (!data[SETTINGS_KEY]) next[SETTINGS_KEY] = createDefaultSettings()
  if (!data[APPLICATIONS_KEY]) next[APPLICATIONS_KEY] = []
  if (Object.keys(next).length) await chrome.storage.local.set(next)
}

export { mergeProfile, mergeSettings }
