import { useEffect, useRef, useState } from 'react'
import type { ApplicationRecord } from '@/applicationTracker/types'
import { listApplications, removeApplication, updateApplication } from '@/applicationTracker/storage'
import { createDefaultProfile, createSampleProfile } from '@/profile/defaults'
import { loadProfile, saveProfile } from '@/profile/storage'
import type { Profile } from '@/profile/types'
import { loadSettings, saveSettings } from '@/settings/storage'
import type { Settings } from '@/settings/types'
import { loadPageState, runPageCommand } from '@/ui/popup/api'
import type { PageState } from '@/ui/popup/api'
import { Overview } from '@/ui/popup/Overview'
import { ProfileForm } from '@/ui/popup/ProfileForm'
import { SettingsForm } from '@/ui/popup/SettingsForm'

type Tab = 'overview' | 'profile' | 'settings'

export function App() {
  const [tab, setTab] = useState<Tab>('overview')
  const [profile, setProfile] = useState<Profile | null>(null)
  const [settings, setSettings] = useState<Settings | null>(null)
  const [page, setPage] = useState<PageState | null>(null)
  const [applications, setApplications] = useState<ApplicationRecord[]>([])
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')

  useEffect(() => {
    void (async () => {
      const [nextProfile, nextSettings, nextApplications, nextPage] = await Promise.all([
        loadProfile(),
        loadSettings(),
        listApplications(),
        loadPageState(),
      ])
      setProfile(nextProfile)
      setSettings(nextSettings)
      setApplications(nextApplications)
      setPage(nextPage)
    })()
    const onChanged = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area !== 'local' || !changes.applications) return
      void listApplications().then(setApplications)
    }
    chrome.storage.onChanged.addListener(onChanged)
    return () => chrome.storage.onChanged.removeListener(onChanged)
  }, [])

  const profileReady = useRef(false)
  const settingsReady = useRef(false)

  useEffect(() => {
    if (!profile) return
    if (!profileReady.current) {
      profileReady.current = true
      return
    }
    const timer = window.setTimeout(() => {
      void saveProfile(profile).then(() => setNotice('Saved on this device'))
    }, 300)
    return () => window.clearTimeout(timer)
  }, [profile])

  useEffect(() => {
    if (!settings) return
    if (!settingsReady.current) {
      settingsReady.current = true
      return
    }
    const timer = window.setTimeout(() => {
      void saveSettings(settings)
    }, 200)
    return () => window.clearTimeout(timer)
  }, [settings])

  if (!profile || !settings) {
    return <main className="app loading">Loading your local profile…</main>
  }

  async function scan() {
    setBusy(true)
    setPage(await runPageCommand('al:scan'))
    setBusy(false)
  }

  async function autofill() {
    setBusy(true)
    setPage(await runPageCommand('al:autofill'))
    setBusy(false)
  }

  return (
    <main className="app">
      <header className="top">
        <div className="brand">
          <span className="mark" aria-hidden="true" />
          <div>
            <strong>ApplyLocal</strong>
            <em>On this device only</em>
          </div>
        </div>
        <p className="notice" aria-live="polite">{notice}</p>
      </header>
      <nav className="tabs" aria-label="Sections">
        {(['overview', 'profile', 'settings'] as Tab[]).map((item) => (
          <button key={item} type="button" aria-current={tab === item} onClick={() => setTab(item)}>
            {item}
          </button>
        ))}
      </nav>
      <section className="panel">
        {tab === 'overview' ? (
          <Overview
            page={page}
            applications={applications}
            busy={busy}
            enabled={settings.enabled}
            onScan={() => void scan()}
            onAutofill={() => void autofill()}
            onOpenSettings={() => setTab('settings')}
            onStatus={(id, status) => void updateApplication(id, { status })}
            onDelete={(id) => void removeApplication(id)}
          />
        ) : null}
        {tab === 'profile' ? (
          <ProfileForm
            profile={profile}
            sensitiveLocked={!settings.autofillSensitiveDemographics}
            onChange={setProfile}
            onSample={() => {
              if (profile.personal.firstName && !window.confirm('Replace the current profile with sample data?')) return
              setProfile(createSampleProfile())
            }}
            onClear={() => {
              if (!window.confirm('Clear the saved profile on this device?')) return
              setProfile(createDefaultProfile())
            }}
          />
        ) : null}
        {tab === 'settings' ? <SettingsForm settings={settings} onChange={setSettings} /> : null}
      </section>
    </main>
  )
}
