import { emptyEducation, emptyEmployment } from '@/profile/defaults'
import { SENSITIVE_CATEGORIES } from '@/profile/types'
import type { EducationEntry, EmploymentEntry, Profile, SensitiveCategory, WorkPreference, YesNo } from '@/profile/types'

const SENSITIVE_LABELS: Record<SensitiveCategory, string> = {
  race: 'Race',
  ethnicity: 'Ethnicity',
  gender: 'Gender',
  disability: 'Disability',
  veteran: 'Veteran status',
  religion: 'Religion',
  sexualOrientation: 'Sexual orientation',
}

interface ProfileFormProps {
  profile: Profile
  sensitiveLocked: boolean
  onChange: (profile: Profile) => void
  onSample: () => void
  onClear: () => void
}

export function ProfileForm({ profile, sensitiveLocked, onChange, onSample, onClear }: ProfileFormProps) {
  function patch(partial: Partial<Profile>) {
    onChange({ ...profile, ...partial })
  }

  return (
    <div className="stack">
      <details open>
        <summary>Personal</summary>
        <div className="grid">
          <Text label="First name" value={profile.personal.firstName} onChange={(firstName) => patch({ personal: { ...profile.personal, firstName } })} />
          <Text label="Middle name" value={profile.personal.middleName} onChange={(middleName) => patch({ personal: { ...profile.personal, middleName } })} />
          <Text label="Last name" value={profile.personal.lastName} onChange={(lastName) => patch({ personal: { ...profile.personal, lastName } })} />
          <Text label="Preferred name" value={profile.personal.preferredName} onChange={(preferredName) => patch({ personal: { ...profile.personal, preferredName } })} />
          <Text label="Email" type="email" value={profile.personal.email} onChange={(email) => patch({ personal: { ...profile.personal, email } })} />
          <Text label="Phone" type="tel" value={profile.personal.phone} onChange={(phone) => patch({ personal: { ...profile.personal, phone } })} />
          <Text label="Street address" value={profile.personal.address} onChange={(address) => patch({ personal: { ...profile.personal, address } })} />
          <Text label="City" value={profile.personal.city} onChange={(city) => patch({ personal: { ...profile.personal, city } })} />
          <Text label="State" value={profile.personal.state} onChange={(state) => patch({ personal: { ...profile.personal, state } })} />
          <Text label="ZIP" value={profile.personal.zip} onChange={(zip) => patch({ personal: { ...profile.personal, zip } })} />
          <Text label="Country" value={profile.personal.country} onChange={(country) => patch({ personal: { ...profile.personal, country } })} />
        </div>
      </details>
      <details>
        <summary>Links</summary>
        <div className="grid">
          <Text label="LinkedIn" value={profile.links.linkedin} onChange={(linkedin) => patch({ links: { ...profile.links, linkedin } })} />
          <Text label="GitHub" value={profile.links.github} onChange={(github) => patch({ links: { ...profile.links, github } })} />
          <Text label="Portfolio" value={profile.links.portfolio} onChange={(portfolio) => patch({ links: { ...profile.links, portfolio } })} />
        </div>
      </details>
      <details>
        <summary>Education</summary>
        {profile.education.map((entry, index) => (
          <EducationCard
            key={entry.id}
            entry={entry}
            onChange={(next) => patch({ education: profile.education.map((item) => (item.id === entry.id ? next : item)) })}
            onRemove={() => patch({ education: profile.education.filter((item) => item.id !== entry.id) })}
            index={index}
          />
        ))}
        <button type="button" onClick={() => patch({ education: [...profile.education, emptyEducation()] })}>Add education</button>
      </details>
      <details>
        <summary>Employment</summary>
        {profile.employment.map((entry, index) => (
          <EmploymentCard
            key={entry.id}
            entry={entry}
            index={index}
            onChange={(next) => patch({ employment: profile.employment.map((item) => (item.id === entry.id ? next : item)) })}
            onRemove={() => patch({ employment: profile.employment.filter((item) => item.id !== entry.id) })}
          />
        ))}
        <button type="button" onClick={() => patch({ employment: [...profile.employment, emptyEmployment()] })}>Add employment</button>
      </details>
      <details>
        <summary>Application defaults</summary>
        <div className="grid">
          <YesNoField label="Authorized to work in the United States" value={profile.defaults.workAuthorization} onChange={(workAuthorization) => patch({ defaults: { ...profile.defaults, workAuthorization } })} />
          <YesNoField label="Require sponsorship now" value={profile.defaults.requiresSponsorship} onChange={(requiresSponsorship) => patch({ defaults: { ...profile.defaults, requiresSponsorship } })} />
          <YesNoField label="Require sponsorship in the future" value={profile.defaults.requiresFutureSponsorship} onChange={(requiresFutureSponsorship) => patch({ defaults: { ...profile.defaults, requiresFutureSponsorship } })} />
          <YesNoField label="Willing to relocate" value={profile.defaults.willingToRelocate} onChange={(willingToRelocate) => patch({ defaults: { ...profile.defaults, willingToRelocate } })} />
          <label>
            <span>Work preference</span>
            <select
              value={profile.defaults.workPreference}
              onChange={(event) => patch({ defaults: { ...profile.defaults, workPreference: event.target.value as WorkPreference } })}
            >
              <option value="">Blank</option>
              <option value="remote">Remote</option>
              <option value="hybrid">Hybrid</option>
              <option value="onsite">Onsite</option>
            </select>
          </label>
          <Text label="Desired salary" value={profile.defaults.desiredSalary} onChange={(desiredSalary) => patch({ defaults: { ...profile.defaults, desiredSalary } })} />
          <Text label="Notice period" value={profile.defaults.noticePeriod} onChange={(noticePeriod) => patch({ defaults: { ...profile.defaults, noticePeriod } })} />
          <Text label="Graduation year" value={profile.defaults.graduationYear} onChange={(graduationYear) => patch({ defaults: { ...profile.defaults, graduationYear } })} />
          <Text label="Years of experience" value={profile.defaults.yearsOfExperience} onChange={(yearsOfExperience) => patch({ defaults: { ...profile.defaults, yearsOfExperience } })} />
        </div>
      </details>
      <details>
        <summary>Sensitive questions</summary>
        <p className="quiet">
          These are never inferred. Autofill stays off unless you save an answer for that exact category and turn on its checkbox.
          {sensitiveLocked ? ' The safety switch in Settings currently blocks all of them.' : ''}
        </p>
        {SENSITIVE_CATEGORIES.map((category) => (
          <div className="sensitive" key={category}>
            <Text
              label={SENSITIVE_LABELS[category]}
              value={profile.sensitive[category].value}
              onChange={(value) => patch({ sensitive: { ...profile.sensitive, [category]: { ...profile.sensitive[category], value } } })}
            />
            <label className="check">
              <input
                type="checkbox"
                checked={profile.sensitive[category].autofillEnabled}
                disabled={sensitiveLocked}
                onChange={(event) =>
                  patch({
                    sensitive: {
                      ...profile.sensitive,
                      [category]: { ...profile.sensitive[category], autofillEnabled: event.target.checked },
                    },
                  })
                }
              />
              Allow autofill for this category
            </label>
          </div>
        ))}
      </details>
      <details>
        <summary>Skills and resume</summary>
        <label>
          <span>Skills</span>
          <textarea
            value={profile.skills.join('\n')}
            onChange={(event) => patch({ skills: event.target.value.split('\n') })}
          />
        </label>
        <Text label="Preferred resume filename" value={profile.resumeFileName} onChange={(resumeFileName) => patch({ resumeFileName })} />
        <p className="quiet">The filename is a reminder only. ApplyLocal does not upload files.</p>
      </details>
      <div className="actions">
        <button type="button" onClick={onSample}>Load sample profile</button>
        <button type="button" onClick={onClear}>Clear profile</button>
      </div>
    </div>
  )
}

function EducationCard({ entry, index, onChange, onRemove }: { entry: EducationEntry; index: number; onChange: (entry: EducationEntry) => void; onRemove: () => void }) {
  return (
    <fieldset>
      <legend>Education {index + 1}</legend>
      <div className="grid">
        <Text label="School" value={entry.school} onChange={(school) => onChange({ ...entry, school })} />
        <Text label="Degree" value={entry.degree} onChange={(degree) => onChange({ ...entry, degree })} />
        <Text label="Major" value={entry.major} onChange={(major) => onChange({ ...entry, major })} />
        <Text label="Minor" value={entry.minor} onChange={(minor) => onChange({ ...entry, minor })} />
        <Text label="Start" type="month" value={entry.startDate} onChange={(startDate) => onChange({ ...entry, startDate })} />
        <Text label="Graduation" type="month" value={entry.graduationDate} onChange={(graduationDate) => onChange({ ...entry, graduationDate })} />
        <Text label="GPA" value={entry.gpa} onChange={(gpa) => onChange({ ...entry, gpa })} />
      </div>
      <button type="button" onClick={onRemove}>Remove</button>
    </fieldset>
  )
}

function EmploymentCard({ entry, index, onChange, onRemove }: { entry: EmploymentEntry; index: number; onChange: (entry: EmploymentEntry) => void; onRemove: () => void }) {
  return (
    <fieldset>
      <legend>Job {index + 1}</legend>
      <div className="grid">
        <Text label="Company" value={entry.company} onChange={(company) => onChange({ ...entry, company })} />
        <Text label="Job title" value={entry.jobTitle} onChange={(jobTitle) => onChange({ ...entry, jobTitle })} />
        <Text label="Start" type="month" value={entry.startDate} onChange={(startDate) => onChange({ ...entry, startDate })} />
        <Text label="End" type="month" value={entry.endDate} onChange={(endDate) => onChange({ ...entry, endDate })} />
        <Text label="Location" value={entry.location} onChange={(location) => onChange({ ...entry, location })} />
        <label className="wide">
          <span>Description</span>
          <textarea value={entry.description} onChange={(event) => onChange({ ...entry, description: event.target.value })} />
        </label>
        <label className="check">
          <input type="checkbox" checked={entry.current} onChange={(event) => onChange({ ...entry, current: event.target.checked })} />
          Current position
        </label>
      </div>
      <button type="button" onClick={onRemove}>Remove</button>
    </fieldset>
  )
}

function Text({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return (
    <label>
      <span>{label}</span>
      <input type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  )
}

function YesNoField({ label, value, onChange }: { label: string; value: YesNo; onChange: (value: YesNo) => void }) {
  return (
    <label>
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value as YesNo)}>
        <option value="">Blank</option>
        <option value="yes">Yes</option>
        <option value="no">No</option>
      </select>
    </label>
  )
}
