import { afterEach, describe, expect, it, vi } from 'vitest'
import { backupFilename, parseBackup, restoreBackup, serializeBackup } from '@/backup/serialization'
import { testProfile, testSettings } from './helpers'

const raw = () => ({ version: 1, profile: testProfile(), settings: testSettings(), exportedAt: '2026-09-21T12:00:00.000Z' })
afterEach(() => vi.unstubAllGlobals())
describe('local backup', () => {
  it('exports only the versioned profile/settings payload with a nonpersonal filename', () => {
    const now = new Date('2026-09-21T12:00:00.000Z')
    expect(JSON.parse(serializeBackup(testProfile(), testSettings(), now))).toEqual(raw())
    expect(backupFilename(now)).toBe('job-autofill-backup-2026-09-21.json')
  })
  it('round trips all saved data without reordering entries', () => {
    const profile = testProfile()
    profile.employment.push({ ...profile.employment[0]!, id: 'older', company: 'Earlier job' })
    expect(parseBackup(serializeBackup(profile, testSettings()))).toMatchObject({ profile, settings: testSettings() })
  })
  it('rejects malformed JSON', () => expect(() => parseBackup('{oops')).toThrow('valid JSON'))
  it.each([{}, { ...raw(), version: 2 }, { ...raw(), version: '1' }])('rejects unsupported or absent version', (value) => {
    expect(() => parseBackup(JSON.stringify(value))).toThrow('version')
  })
  it.each([undefined, null, [], 'profile', {}])('rejects absent or incompatible profile: %s', (profile) => {
    expect(() => parseBackup(JSON.stringify({ ...raw(), profile }))).toThrow(/Profile/)
  })
  it.each([undefined, null, [], 'settings'])('rejects absent or incompatible settings: %s', (settings) => {
    expect(() => parseBackup(JSON.stringify({ ...raw(), settings }))).toThrow(/Settings/)
  })
  it('normalizes optional older fields, legacy sensitive flag and settings thresholds', () => {
    const parsed = parseBackup(JSON.stringify({ version: 1, profile: { personal: { firstName: 'Saved' } }, settings: { neverAutofillSensitive: false, reviewThreshold: 0.99, autofillThreshold: 0.2 } }))
    expect(parsed.profile.personal.phoneExtension).toBe('')
    expect(parsed.profile.employment).toEqual([])
    expect(parsed.settings.autofillSensitiveDemographics).toBe(true)
    expect(parsed.settings.reviewThreshold).toBeLessThan(parsed.settings.autofillThreshold)
    expect(parsed.settings.enabled).toBe(true)
  })
  it('ignores unknown keys at every level and filters unknown disabled field types', () => {
    const value = raw()
    const result = parseBackup(JSON.stringify({ ...value, currentPage: 'private', profile: { ...value.profile, extra: 3, personal: { ...value.profile.personal, unknown: 'ignore' } }, settings: { ...value.settings, extra: true, disabledFields: ['email', 'unknown-type'] } }))
    expect(result).not.toHaveProperty('currentPage')
    expect(result.profile).not.toHaveProperty('extra')
    expect(result.profile.personal).not.toHaveProperty('unknown')
    expect(result.settings.disabledFields).toEqual(['email'])
  })
  it.each([
    { personal: { email: 4 } }, { skills: ['ok', 2] }, { employment: [null] },
    { employment: [{ current: 'true' }] }, { education: 'bad' }, { version: 2 },
    { sensitive: { gender: { autofillEnabled: 'true' } } }, { defaults: { workAuthorization: 'maybe' } },
  ])('rejects invalid known profile fields', (patch) => {
    const value = raw()
    expect(() => parseBackup(JSON.stringify({ ...value, profile: { ...value.profile, ...patch } }))).toThrow()
  })
  it('rejects malformed settings instead of coercing safety flags', () => {
    expect(() => parseBackup(JSON.stringify({ ...raw(), settings: { autofillSensitiveDemographics: 'true' } }))).toThrow()
  })
  it('validates before any storage write and commits both objects in one write', async () => {
    const set = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('chrome', { storage: { local: { set } } })
    await expect(restoreBackup({ version: 1, profile: [] })).rejects.toThrow()
    expect(set).not.toHaveBeenCalled()
    await restoreBackup(raw())
    expect(set).toHaveBeenCalledExactlyOnceWith({ profile: raw().profile, settings: raw().settings })
    await restoreBackup(parseBackup(JSON.stringify({ version: 1, profile: { personal: {} }, settings: {} })))
    expect(set).toHaveBeenCalledTimes(2)
  })
})
