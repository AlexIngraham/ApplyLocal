import { mergeProfile, PROFILE_KEY } from '@/profile/defaults'
import type { Profile } from '@/profile/types'

export async function loadProfile(): Promise<Profile> {
  const data = await chrome.storage.local.get(PROFILE_KEY)
  return mergeProfile(data[PROFILE_KEY])
}

export async function saveProfile(profile: Profile): Promise<void> {
  await chrome.storage.local.set({ [PROFILE_KEY]: profile })
}
