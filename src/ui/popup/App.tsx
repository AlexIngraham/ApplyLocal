import { useEffect, useRef, useState } from 'react'
import { BackupData } from '@/ui/popup/BackupData'
import { restoreBackup } from '@/backup/serialization'
import type { Backup } from '@/backup/serialization'
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
import { Tabs } from './components/Tabs'
import type { Tab } from './components/Tabs'
import { Icon } from './components/Icon'
import { Button, StatusMessage } from './components/ui'
import { useAutosave } from './useAutosave'

export function App() {
  const [tab, setTab] = useState<Tab>('overview')
  const [profile, setProfile] = useState<Profile | null>(null)
  const [settings, setSettings] = useState<Settings | null>(null)
  const [page, setPage] = useState<PageState | null>(null)
  const [applications, setApplications] = useState<ApplicationRecord[]>([])
  const [busy, setBusy] = useState<'scan' | 'autofill' | null>(null)
  const commandRunning = useRef(false)
  const [notice, setNotice] = useState('')
  const [actionError, setActionError] = useState('')
  const [loadError, setLoadError] = useState(false)
  const profileSave = useAutosave(profile, saveProfile, 300)
  const settingsSave = useAutosave(settings, saveSettings, 200)

  useEffect(() => {
    let active = true
    // A slow page connection should not hold up access to local profile/settings.
    void Promise.all([loadProfile(), loadSettings(), listApplications()]).then(([nextProfile, nextSettings, nextApplications]) => {
      if (!active) return
      setProfile(nextProfile); setSettings(nextSettings); setApplications(nextApplications)
    }).catch(() => { if (active) setLoadError(true) })
    void loadPageState().then(next => { if (active) setPage(next) }).catch(() => {
      if (active) setPage({ url: '', ats: 'generic', atsLabel: 'Current page', error: 'Could not connect to this page.' })
    })
    const onChanged = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area !== 'local' || !changes.applications) return
      void listApplications().then(next => { if (active) setApplications(next) }).catch(() => { if (active) setActionError('Could not refresh saved applications. Reopen the popup to try again.') })
    }
    chrome.storage.onChanged.addListener(onChanged)
    return () => { active = false; chrome.storage.onChanged.removeListener(onChanged) }
  }, [])

  if (!profile || !settings) return <main className="app loading stack">{loadError ? <StatusMessage tone="error">Could not load your local data. Close and reopen the popup to try again.</StatusMessage> : <><Icon name="spinner" className="spin" /><strong>Opening ApplyLocal</strong><p className="quiet">Loading your local profile…</p></>}</main>

  async function importData(backup: Backup) {
    profileSave.cancel(); settingsSave.cancel()
    try {
      const restored = await restoreBackup(backup)
      profileSave.markSaved(restored.profile); settingsSave.markSaved(restored.settings)
      setProfile(restored.profile); setSettings(restored.settings)
    } catch (error) {
      profileSave.retry(); settingsSave.retry()
      throw error
    }
  }

  async function command(action: 'scan' | 'autofill') {
    if (commandRunning.current) return
    commandRunning.current = true
    setBusy(action); setNotice(''); setActionError('')
    try {
      const result = await runPageCommand(action === 'scan' ? 'al:scan' : 'al:autofill')
      setPage(result)
      if (!result.error) {
        const filled = result.snapshot?.counts.autofilled ?? 0
        setNotice(action === 'autofill' ? `${filled} ${filled === 1 ? 'field' : 'fields'} filled on this page.` : 'Scan complete. Page details are up to date.')
      }
    } catch {
      setActionError('Could not connect to this page. Open a job application, refresh it, then scan again.')
    } finally { setBusy(null); commandRunning.current = false }
  }
  const saveError = profileSave.status === 'error' || settingsSave.status === 'error'
  const saving = profileSave.status === 'saving' || settingsSave.status === 'saving'
  return <main className="app">
    <header className="top"><div className="brand"><span className="mark"><Icon name="check" /></span><div><strong>ApplyLocal</strong><small>Your next application, simplified.</small></div></div>
      <span className="save-status" role="status" data-error={saveError}><Icon name={saveError ? 'warning' : saving ? 'spinner' : 'check'} className={saving ? 'spin' : ''} />{saveError ? 'Not saved' : saving ? 'Saving…' : 'Saved locally'}</span>
    </header>
    {saveError && <div className="save-error"><StatusMessage tone="error">Changes could not be saved. Keep this popup open and retry.<br /><Button onClick={() => { profileSave.retry(); settingsSave.retry() }}>Retry save</Button></StatusMessage></div>}
    <Tabs value={tab} onChange={setTab} panels={{
      overview: <Overview page={page} applications={applications} busy={busy} enabled={settings.enabled} notice={notice} actionError={actionError} onScan={() => void command('scan')} onAutofill={() => void command('autofill')} onOpenSettings={() => setTab('settings')} onStatus={(id, status) => void updateApplication(id, { status }).catch(() => setActionError('Could not update the application. Please try again.'))} onDelete={id => void removeApplication(id).catch(() => setActionError('Could not remove the application. Please try again.'))} />,
      profile: <ProfileForm profile={profile} sensitiveLocked={!settings.autofillSensitiveDemographics} onChange={setProfile} onSample={() => {
        if (profile.personal.firstName && !window.confirm('Replace the current profile with sample data?')) return
        setProfile(createSampleProfile())
      }} onClear={() => {
        if (!window.confirm('Clear the saved profile on this device?')) return
        setProfile(createDefaultProfile())
      }} />,
      settings: <div className="stack"><SettingsForm settings={settings} onChange={setSettings} /><BackupData profile={profile} settings={settings} onRestore={importData} /></div>,
    }} />
  </main>
}
