import { describe, expect, it } from 'vitest'
import { createDefaultProfile, mergeProfile } from '@/profile/defaults'
import { createDefaultSettings, mergeSettings } from '@/settings/defaults'

describe('safe settings and profile migration', () => {
  it('defaults sensitive demographic autofill to off and migrates the legacy inverse setting', () => {
    expect(createDefaultSettings()).toMatchObject({
      autofillSensitiveDemographics: false,
      neverAutofillSensitive: true,
    })
    expect(mergeSettings({ neverAutofillSensitive: false })).toMatchObject({
      autofillSensitiveDemographics: true,
      neverAutofillSensitive: false,
    })
    expect(mergeSettings({ autofillSensitiveDemographics: false, neverAutofillSensitive: false })).toMatchObject({
      autofillSensitiveDemographics: false,
      neverAutofillSensitive: true,
    })
  })

  it('adds new optional profile fields without losing legacy values', () => {
    const merged = mergeProfile({
      personal: { address: '1 Main St', country: 'United States' },
      links: { portfolio: 'https://portfolio.example' },
    })
    expect(merged.personal).toMatchObject({
      address: '1 Main St',
      addressLine2: '',
      county: '',
      country: 'United States',
      phoneExtension: '',
    })
    expect(merged.links).toMatchObject({
      portfolio: 'https://portfolio.example',
      website: '',
      projectWebsite: '',
    })
    expect(createDefaultProfile().personal.addressLine2).toBe('')
  })
})
