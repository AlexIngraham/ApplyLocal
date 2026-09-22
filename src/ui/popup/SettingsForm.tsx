import { FIELD_LABELS, isCanonicalField } from '@/classifier/types'
import type { Settings } from '@/settings/types'

interface SettingsFormProps {
  settings: Settings
  onChange: (settings: Settings) => void
}

export function SettingsForm({ settings, onChange }: SettingsFormProps) {
  function patch(partial: Partial<Settings>) {
    onChange({ ...settings, ...partial })
  }

  return (
    <div className="stack">
      <Toggle
        label="Enable extension"
        description="Pause scanning, indicators, and autofill."
        checked={settings.enabled}
        onChange={(enabled) => patch({ enabled })}
      />
      <Toggle
        label="Autofill high-confidence fields"
        description="Fill empty fields at or above the threshold. You still submit the application."
        checked={settings.autoFillHighConfidence}
        onChange={(autoFillHighConfidence) => patch({ autoFillHighConfidence })}
      />
      <Toggle
        label="Use site adapters"
        description="Greenhouse, Lever, and Workday get site-specific field rules. Generic detection stays on either way."
        checked={settings.enableSiteAdapters}
        onChange={(enableSiteAdapters) => patch({ enableSiteAdapters })}
      />
      <Toggle
        label="Show field indicators"
        description="Dots beside recognized fields. Click one to see why it matched."
        checked={settings.showFieldIndicators}
        onChange={(showFieldIndicators) => patch({ showFieldIndicators })}
      />
      <Toggle
        label="Autofill saved demographic/self-identification answers"
        description="Off by default. Only answers you explicitly save are used; ApplyLocal never infers demographic information."
        checked={settings.autofillSensitiveDemographics}
        onChange={(autofillSensitiveDemographics) =>
          patch({ autofillSensitiveDemographics, neverAutofillSensitive: !autofillSensitiveDemographics })
        }
      />
      <label className="slider">
        <span>Autofill threshold <strong>{Math.round(settings.autofillThreshold * 100)}%</strong></span>
        <input
          type="range"
          min={70}
          max={99}
          value={Math.round(settings.autofillThreshold * 100)}
          onChange={(event) => patch({ autofillThreshold: Number(event.target.value) / 100 })}
        />
      </label>
      <label className="slider">
        <span>Review threshold <strong>{Math.round(settings.reviewThreshold * 100)}%</strong></span>
        <input
          type="range"
          min={50}
          max={90}
          value={Math.round(settings.reviewThreshold * 100)}
          onChange={(event) => patch({ reviewThreshold: Number(event.target.value) / 100 })}
        />
      </label>
      <p className="quiet">Fields under the review threshold are left alone. Between the two thresholds, ApplyLocal only suggests a value.</p>
      {settings.disabledFields.length ? (
        <div className="chips">
          <h2>Never autofill</h2>
          {settings.disabledFields.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => patch({ disabledFields: settings.disabledFields.filter((item) => item !== key) })}
            >
              {isCanonicalField(key) ? FIELD_LABELS[key] : key} ×
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function Toggle({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="toggle">
      <span>
        <strong>{label}</strong>
        <small>{description}</small>
      </span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    </label>
  )
}
