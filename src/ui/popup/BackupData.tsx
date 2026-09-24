import { Button, SectionCard, StatusMessage } from './components/ui'
import { useRef, useState } from 'react'
import { backupFilename, parseBackup, serializeBackup } from '@/backup/serialization'
import type { Backup } from '@/backup/serialization'
import type { Profile } from '@/profile/types'
import type { Settings } from '@/settings/types'

export function BackupData({ profile, settings, onRestore }: {
  profile: Profile
  settings: Settings
  onRestore: (backup: Backup) => Promise<void>
}) {
  const fileInput = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<Backup | null>(null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)

  function exportFile() {
    setError(false)
    try {
      const now = new Date()
      const blob = new Blob([serializeBackup(profile, settings, now)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url; link.download = backupFilename(now)
      document.body.append(link); link.click(); link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
      setMessage('Backup download started.')
    } catch { setError(true); setMessage('Could not export the backup. Please try again.') }
  }
  async function readFile(file?: File) {
    if (!file) return
    setPending(null); setMessage(''); setError(false); setBusy(true)
    try {
      if (file.size > 10 * 1024 * 1024) throw new Error('Backup files must be under 10 MB.')
      setPending(parseBackup(await file.text()))
    } catch (error) { setError(true); setMessage(error instanceof Error ? error.message : 'Could not read this file.') }
    finally { setBusy(false) }
  }
  async function restore() {
    if (!pending) return
    setBusy(true); setError(false)
    try {
      await onRestore(pending)
      setPending(null); setMessage('Profile and settings restored on this device.')
    } catch { setError(true); setMessage('Could not save the backup. Please try again.') }
    finally { setBusy(false) }
  }
  return <SectionCard title="Data & backup" icon="download"><div className="stack">
    <p className="quiet">Backups contain personal information. Store them securely. Saved applications are not included.</p>
    <div className="actions">
      <Button icon="download" disabled={busy} onClick={exportFile}>Export backup</Button>
      <Button icon={busy ? "spinner" : "upload"} disabled={busy} onClick={() => fileInput.current?.click()}>{busy ? 'Working…' : 'Import backup'}</Button>
    </div>
    <input ref={fileInput} type="file" accept=".json,application/json" hidden onChange={(event) => {
      const file = event.target.files?.[0]; event.target.value = ''; void readFile(file)
    }} />
    {pending ? <div className="stack backup-confirm">
      <p>Import profile and settings: {pending.profile.employment.length} employment entries, {pending.profile.education.length} education entries, and {pending.profile.skills.length} skills.</p>
      <p>This will replace your current saved profile and settings, including autofill preferences.</p>
      <div className="actions">
        <Button variant="primary" disabled={busy} onClick={() => void restore()}>Replace profile and settings</Button>
        <Button disabled={busy} onClick={() => setPending(null)}>Cancel</Button>
      </div>
    </div> : null}
    {message && <StatusMessage tone={error ? 'error' : 'success'}>{message}</StatusMessage>}
  </div></SectionCard>
}
