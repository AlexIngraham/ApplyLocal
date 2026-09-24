import { FIELD_LABELS, isCanonicalField } from '@/classifier/types'
import type { Settings } from '@/settings/types'
import { Button, SectionCard, Toggle } from './components/ui'

export function SettingsForm({ settings, onChange }: { settings: Settings; onChange: (settings: Settings) => void }) {
  function patch(partial: Partial<Settings>) { onChange({ ...settings, ...partial }) }
  return <>
    <div className="page-heading"><div><h1>Settings</h1><p>Make ApplyLocal work your way.</p></div></div>
    <SectionCard title="Autofill" icon="settings">
      <Toggle label="Enable extension" description="Scanning, indicators and autofill on this device." checked={settings.enabled} onChange={enabled => patch({ enabled })} />
      <Toggle label="Autofill high-confidence fields" description="Fill empty fields that meet your threshold. You review and submit." checked={settings.autoFillHighConfidence} onChange={autoFillHighConfidence => patch({ autoFillHighConfidence })} />
      <label className="slider"><span>Autofill confidence <strong>{Math.round(settings.autofillThreshold * 100)}%</strong></span><input aria-label="Autofill confidence" aria-valuetext={`${Math.round(settings.autofillThreshold * 100)} percent confidence`} type="range" min={70} max={99} value={Math.round(settings.autofillThreshold * 100)} onChange={e => patch({ autofillThreshold: Number(e.target.value) / 100 })} /></label>
      <label className="slider"><span>Review confidence <strong>{Math.round(settings.reviewThreshold * 100)}%</strong></span><input aria-label="Review confidence" aria-valuetext={`${Math.round(settings.reviewThreshold * 100)} percent confidence`} type="range" min={50} max={90} value={Math.round(settings.reviewThreshold * 100)} onChange={e => patch({ reviewThreshold: Number(e.target.value) / 100 })} /></label>
      <p className="quiet">Below review confidence, fields are left alone. Between thresholds, values are suggested for review.</p>
    </SectionCard>
    <SectionCard title="Sites & indicators" icon="globe">
      <Toggle label="Use site adapters" description="Tailored rules for Greenhouse, Lever and Workday. Generic detection stays available." checked={settings.enableSiteAdapters} onChange={enableSiteAdapters => patch({ enableSiteAdapters })} />
      <Toggle label="Show field indicators" description="Small dots beside recognized fields. Select one to see why it matched." checked={settings.showFieldIndicators} onChange={showFieldIndicators => patch({ showFieldIndicators })} />
    </SectionCard>
    <SectionCard title="Privacy & sensitive fields" icon="shield">
      <p className="quiet">Your profile stays on this device. Nothing is submitted for you.</p>
      <Toggle label="Autofill saved demographic answers" description="Only answers you explicitly save are used. Demographic information is never inferred." checked={settings.autofillSensitiveDemographics} onChange={autofillSensitiveDemographics => patch({ autofillSensitiveDemographics, neverAutofillSensitive: !autofillSensitiveDemographics })} />
      {settings.disabledFields.length > 0 && <><h2>Never autofill</h2><p className="quiet">Remove a restriction to allow that field again.</p><div className="chips">{settings.disabledFields.map(key => <Button key={key} icon="close" aria-label={`Allow autofill for ${isCanonicalField(key) ? FIELD_LABELS[key] : key}`} onClick={() => patch({ disabledFields: settings.disabledFields.filter(item => item !== key) })}>{isCanonicalField(key) ? FIELD_LABELS[key] : key}</Button>)}</div></>}
    </SectionCard>
  </>
}
