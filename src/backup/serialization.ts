import { createDefaultProfile, emptyEducation, emptyEmployment, mergeProfile, PROFILE_KEY } from '@/profile/defaults'
import type { Profile } from '@/profile/types'
import { createDefaultSettings, mergeSettings, SETTINGS_KEY } from '@/settings/defaults'
import type { Settings } from '@/settings/types'

export interface Backup {
  version: 1
  exportedAt: string
  profile: Profile
  settings: Settings
}

type RecordValue = Record<string, unknown>
function object(value: unknown, path: string): RecordValue {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${path} must be an object.`)
  return value as RecordValue
}

/** Reject malformed known properties; ignore unknown ones. Defaults supply older optional fields. */
function validateShape(value: RecordValue, template: object, path: string): void {
  for (const [key, fallback] of Object.entries(template)) {
    if (!Object.hasOwn(value, key)) continue
    const actual = value[key]
    const location = `${path}.${key}`
    if (Array.isArray(fallback)) {
      if (!Array.isArray(actual)) throw new Error(`${location} must be an array.`)
    } else if (fallback && typeof fallback === 'object') {
      validateShape(object(actual, location), fallback, location)
    } else if (typeof actual !== typeof fallback || (typeof actual === 'number' && !Number.isFinite(actual))) {
      throw new Error(`${location} has an invalid type.`)
    }
  }
}
function checkVersion(value: RecordValue, path: string): void {
  if (Object.hasOwn(value, 'version') && value.version !== 1) throw new Error(`Unsupported ${path} version.`)
}
function strings(value: unknown, path: string): void {
  if (value !== undefined && (!Array.isArray(value) || value.some((item) => typeof item !== 'string'))) {
    throw new Error(`${path} must contain strings.`)
  }
}

export function validateBackup(value: unknown): Backup {
  const raw = object(value, 'Backup')
  if (raw.version !== 1) throw new Error('Unsupported backup version. Expected version 1.')
  const profile = object(raw.profile, 'Profile')
  object(profile.personal, 'Profile.personal')
  const settings = object(raw.settings, 'Settings')
  checkVersion(profile, 'profile'); checkVersion(settings, 'settings')
  validateShape(profile, createDefaultProfile(), 'Profile')
  validateShape(settings, createDefaultSettings(), 'Settings')
  for (const [key, template] of [['education', emptyEducation()], ['employment', emptyEmployment()]] as const) {
    const entries = profile[key]
    if (entries === undefined) continue
    if (!Array.isArray(entries)) throw new Error(`Profile.${key} must be an array.`)
    entries.forEach((entry, index) => validateShape(object(entry, `Profile.${key}[${index}]`), template, `Profile.${key}[${index}]`))
  }
  strings(profile.skills, 'Profile.skills')
  strings(settings.disabledFields, 'Settings.disabledFields')
  if (profile.defaults) {
    const defaults = object(profile.defaults, 'Profile.defaults')
    for (const key of ['workAuthorization', 'requiresSponsorship', 'requiresFutureSponsorship', 'willingToRelocate']) {
      if (Object.hasOwn(defaults, key) && !['', 'yes', 'no'].includes(defaults[key] as string)) throw new Error(`Profile.defaults.${key} must be yes, no, or blank.`)
    }
    if (Object.hasOwn(defaults, 'workPreference') && !['', 'remote', 'hybrid', 'onsite'].includes(defaults.workPreference as string)) throw new Error('Invalid work preference.')
  }
  if (raw.exportedAt !== undefined && raw.exportedAt !== '' && (typeof raw.exportedAt !== 'string' || !Number.isFinite(Date.parse(raw.exportedAt)))) {
    throw new Error('Invalid backup export date.')
  }
  return {
    version: 1,
    // Early version-1 backups can omit the informational timestamp.
    exportedAt: typeof raw.exportedAt === 'string' ? raw.exportedAt : '',
    profile: mergeProfile(profile), settings: mergeSettings(settings),
  }
}

export function parseBackup(json: string): Backup {
  let raw: unknown
  try { raw = JSON.parse(json) } catch { throw new Error('This file is not valid JSON.') }
  return validateBackup(raw)
}
export function serializeBackup(profile: Profile, settings: Settings, now = new Date()): string {
  return JSON.stringify(validateBackup({ version: 1, exportedAt: now.toISOString(), profile, settings }), null, 2)
}
export function backupFilename(now = new Date()): string {
  return `job-autofill-backup-${now.toISOString().slice(0, 10)}.json`
}
export async function restoreBackup(backup: unknown): Promise<Backup> {
  const validated = validateBackup(backup)
  // A single write prevents listeners seeing a half-restored profile/settings pair.
  await chrome.storage.local.set({ [PROFILE_KEY]: validated.profile, [SETTINGS_KEY]: validated.settings })
  return validated
}
