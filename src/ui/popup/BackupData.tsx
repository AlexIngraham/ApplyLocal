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

  function exportFile() {
    try {
      const now = new Date()
      const blob = new Blob([serializeBackup(profile, settings, now)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url; link.download = backupFilename(now)
      document.body.append(link); link.click(); link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
      setMessage('Backup download started.')
    } catch { setMessage('Could not export the backup. Please try again.') }
  }
  async function readFile(file?: File) {
    if (!file) return
    setPending(null); setMessage(''); setBusy(true)
    try {
      if (file.size > 10 * 1024 * 1024) throw new Error('Backup files must be under 10 MB.')
      setPending(parseBackup(await file.text()))
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not read this file.') }
    finally { setBusy(false) }
  }
  async function restore() {
    if (!pending) return
    setBusy(true)
    try {
      await onRestore(pending)
      setPending(null); setMessage('Profile and settings restored on this device.')
    } catch { setMessage('Could not save the backup. Please try again.') }
    finally { setBusy(false) }
  }
  return <section className="stack" aria-label="Data backup">
    <h2>Data</h2>
    <p className="quiet">Back up your profile and settings locally. JSON backups may contain sensitive personal information. Store them securely. Saved applications are not included.</p>
    <div className="actions">
      <button type="button" disabled={busy} onClick={exportFile}>Export backup</button>
      <button type="button" disabled={busy} onClick={() => fileInput.current?.click()}>Import backup</button>
    </div>
    <input ref={fileInput} type="file" accept=".json,application/json" hidden onChange={(event) => {
      const file = event.target.files?.[0]; event.target.value = ''; void readFile(file)
    }} />
    {pending ? <div className="stack">
      <p>Import profile and settings: {pending.profile.employment.length} employment entries, {pending.profile.education.length} education entries, and {pending.profile.skills.length} skills.</p>
      <p>This will replace your current saved profile and settings, including autofill preferences.</p>
      <div className="actions">
        <button type="button" disabled={busy} onClick={() => void restore()}>Replace profile and settings</button>
        <button type="button" disabled={busy} onClick={() => setPending(null)}>Cancel</button>
      </div>
    </div> : null}
    <p role="status">{message}</p>
  </section>
}
