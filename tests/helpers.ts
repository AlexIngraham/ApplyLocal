import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createDefaultSettings } from '@/settings/defaults'
import { createSampleProfile } from '@/profile/defaults'
import type { Profile } from '@/profile/types'
import type { Settings } from '@/settings/types'
import { scanDocument } from '@/content/scanner'
import type { DetectedField } from '@/adapters/types'

const here = dirname(fileURLToPath(import.meta.url))

export function loadFixture(name: string): string {
  return readFileSync(join(here, 'fixtures', name), 'utf8')
}

export function renderFixture(name: string): void {
  document.body.innerHTML = loadFixture(name)
}

export function testProfile(): Profile {
  return createSampleProfile()
}

export function testSettings(patch: Partial<Settings> = {}): Settings {
  return { ...createDefaultSettings(), ...patch }
}

export function fieldById(fields: DetectedField[], id: string): DetectedField | undefined {
  return fields.find((field) => field.control.elements.some((element) => element.id === id))
}

export function scanFixture(name: string, url: string, settings: Settings = testSettings()): ReturnType<typeof scanDocument> {
  renderFixture(name)
  return scanDocument(document, { url, profile: testProfile(), settings })
}
