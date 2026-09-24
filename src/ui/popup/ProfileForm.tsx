import { Accordion } from './components/Accordion'
import { Badge, Button, EmptyState, TextInput as Text, Toggle } from './components/ui'
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
      <div className="page-heading"><div><h1>Your profile</h1><p>Reusable details for every application.</p></div><Badge>Local only</Badge></div>
      <Accordion title="Personal information" icon="user" summary={[profile.personal.firstName, profile.personal.lastName].filter(Boolean).join(' ') || 'Your name and preferred name'} defaultOpen>
        <div className="grid">
          <Text label="First name" value={profile.personal.firstName} onChange={(firstName) => patch({ personal: { ...profile.personal, firstName } })} />
          <Text label="Middle name" value={profile.personal.middleName} onChange={(middleName) => patch({ personal: { ...profile.personal, middleName } })} />
          <Text label="Last name" value={profile.personal.lastName} onChange={(lastName) => patch({ personal: { ...profile.personal, lastName } })} />
          <Text label="Preferred name" value={profile.personal.preferredName} onChange={(preferredName) => patch({ personal: { ...profile.personal, preferredName } })} />
        </div>
      </Accordion>
      <Accordion title="Contact & address" icon="contact" summary={profile.personal.email || 'Email, phone and location'}>
        <div className="grid">
          <Text label="Email" type="email" value={profile.personal.email} onChange={(email) => patch({ personal: { ...profile.personal, email } })} />
          <Text label="Phone" type="tel" value={profile.personal.phone} onChange={(phone) => patch({ personal: { ...profile.personal, phone } })} />
          <Text label="Phone extension" value={profile.personal.phoneExtension} onChange={(phoneExtension) => patch({ personal: { ...profile.personal, phoneExtension } })} />
          <Text label="Address line 1" value={profile.personal.address} onChange={(address) => patch({ personal: { ...profile.personal, address } })} />
          <Text label="Address line 2" value={profile.personal.addressLine2} onChange={(addressLine2) => patch({ personal: { ...profile.personal, addressLine2 } })} />
          <Text label="City" value={profile.personal.city} onChange={(city) => patch({ personal: { ...profile.personal, city } })} />
          <Text label="County" value={profile.personal.county} onChange={(county) => patch({ personal: { ...profile.personal, county } })} />
          <Text label="State" value={profile.personal.state} onChange={(state) => patch({ personal: { ...profile.personal, state } })} />
          <Text label="ZIP" value={profile.personal.zip} onChange={(zip) => patch({ personal: { ...profile.personal, zip } })} />
          <Text label="Country" value={profile.personal.country} onChange={(country) => patch({ personal: { ...profile.personal, country } })} />
        </div>
      </Accordion>
      <Accordion title="Links" icon="link" summary="LinkedIn, GitHub and your work">
        <div className="grid">
          <Text label="LinkedIn" value={profile.links.linkedin} onChange={(linkedin) => patch({ links: { ...profile.links, linkedin } })} />
          <Text label="GitHub" value={profile.links.github} onChange={(github) => patch({ links: { ...profile.links, github } })} />
          <Text label="Portfolio" value={profile.links.portfolio} onChange={(portfolio) => patch({ links: { ...profile.links, portfolio } })} />
          <Text label="Website" value={profile.links.website} onChange={(website) => patch({ links: { ...profile.links, website } })} />
          <Text label="Project website" value={profile.links.projectWebsite} onChange={(projectWebsite) => patch({ links: { ...profile.links, projectWebsite } })} />
        </div>
      </Accordion>
      <Accordion title="Education" icon="education" summary={profile.education.length ? `${profile.education.length} saved ${profile.education.length === 1 ? 'entry' : 'entries'}` : 'Schools, degrees and dates'} badge={<Badge>{profile.education.length}</Badge>}>
        {!profile.education.length && <EmptyState>No education added yet. Add a school to fill education sections.</EmptyState>}
        {profile.education.map((entry, index) => (
          <EducationCard
            key={entry.id}
            entry={entry}
            onChange={(next) => patch({ education: profile.education.map((item) => (item.id === entry.id ? next : item)) })}
            onRemove={() => patch({ education: profile.education.filter((item) => item.id !== entry.id) })}
            index={index}
          />
        ))}
        <Button className="add-entry" icon="plus" onClick={() => patch({ education: [...profile.education, emptyEducation()] })}>Add education</Button>
      </Accordion>
      <Accordion title="Work experience" icon="work" summary={profile.employment.length ? `${profile.employment.length} saved ${profile.employment.length === 1 ? 'role' : 'roles'} · Most recent first` : 'Roles, companies and dates'} badge={<Badge>{profile.employment.length}</Badge>}>
        {!profile.employment.length && <EmptyState>No work experience added yet. Add an experience to fill employment sections.</EmptyState>}
        {profile.employment.map((entry, index) => (
          <EmploymentCard
            key={entry.id}
            entry={entry}
            index={index}
            onChange={(next) => patch({ employment: profile.employment.map((item) => (item.id === entry.id ? next : item)) })}
            onRemove={() => patch({ employment: profile.employment.filter((item) => item.id !== entry.id) })}
          />
        ))}
        <Button className="add-entry" icon="plus" onClick={() => patch({ employment: [...profile.employment, emptyEmployment()] })}>Add experience</Button>
      </Accordion>
      <Accordion title="Skills & resume" icon="skills" summary={profile.skills.filter(skill => skill.trim()).length ? `${profile.skills.filter(skill => skill.trim()).length} skills saved` : 'Technical skills and resume reminder'}>
        {!profile.skills.some(skill => skill.trim()) && <EmptyState>No skills saved. Add your technical skills for skill selectors.</EmptyState>}
        <label>
          <span>Skills <small>· One per line</small></span>
          <textarea
            value={profile.skills.join('\n')}
            onChange={(event) => patch({ skills: event.target.value.split('\n') })}
          />
        </label>
        <Text label="Preferred resume filename" value={profile.resumeFileName} onChange={(resumeFileName) => patch({ resumeFileName })} />
        <p className="quiet">The filename is a reminder only. ApplyLocal does not upload files.</p>
      </Accordion>
      <Accordion title="Work authorization" icon="shield" summary="Sponsorship, preferences and application defaults">
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
      </Accordion>
      <Accordion title="Demographics" icon="shield" summary="Optional · Only answers you choose to save" badge={<Badge>{sensitiveLocked ? 'Autofill off' : 'Autofill on'}</Badge>}>
        <p className="quiet">
          These answers are stored locally and never inferred. Autofill requires an exact saved answer and the global sensitive-demographics setting.
          {sensitiveLocked ? ' The global setting currently blocks all of them.' : ''}
        </p>
        {SENSITIVE_CATEGORIES.map((category) => (
          <div className="sensitive" key={category}>
            <Text
              label={SENSITIVE_LABELS[category]}
              value={profile.sensitive[category].value}
              onChange={(value) => patch({ sensitive: { ...profile.sensitive, [category]: { ...profile.sensitive[category], value } } })}
            />
          </div>
        ))}
      </Accordion>
      <div className="actions profile-tools">
        <Button variant="ghost" onClick={onSample}>Load sample profile</Button>
        <Button variant="danger" onClick={onClear}>Clear profile</Button>
      </div>
    </div>
  )
}

function EducationCard({ entry, index, onChange, onRemove }: { entry: EducationEntry; index: number; onChange: (entry: EducationEntry) => void; onRemove: () => void }) {
  return (
    <Accordion className="entry-card" title={entry.school || `Education ${index + 1}`} summary={[entry.degree || 'Add degree details', dateRange(entry.startDate, entry.graduationDate)].filter(Boolean).join('\n')} defaultOpen={!entry.school}>
      <div className="grid">
        <Text label="School" value={entry.school} onChange={(school) => onChange({ ...entry, school })} />
        <Text label="Degree" value={entry.degree} onChange={(degree) => onChange({ ...entry, degree })} />
        <Text label="Major" value={entry.major} onChange={(major) => onChange({ ...entry, major })} />
        <Text label="Minor" value={entry.minor} onChange={(minor) => onChange({ ...entry, minor })} />
        <Text label="Start" type="month" value={entry.startDate} onChange={(startDate) => onChange({ ...entry, startDate })} />
        <Text label="Graduation" type="month" value={entry.graduationDate} onChange={(graduationDate) => onChange({ ...entry, graduationDate })} />
        <Text label="GPA" value={entry.gpa} onChange={(gpa) => onChange({ ...entry, gpa })} />
      </div>
      <Button variant="danger" icon="trash" className="entry-remove" onClick={onRemove}>Remove entry</Button>
    </Accordion>
  )
}

function EmploymentCard({ entry, index, onChange, onRemove }: { entry: EmploymentEntry; index: number; onChange: (entry: EmploymentEntry) => void; onRemove: () => void }) {
  return (
    <Accordion className="entry-card" title={entry.jobTitle || `Experience ${index + 1}`} summary={[entry.company || 'Add company details', dateRange(entry.startDate, entry.current ? 'Present' : entry.endDate)].filter(Boolean).join('\n')} defaultOpen={!entry.company}>
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
        <div className="wide"><Toggle label="Current position" checked={entry.current} onChange={(current) => onChange({ ...entry, current })} /></div>
      </div>
      <Button variant="danger" icon="trash" className="entry-remove" onClick={onRemove}>Remove entry</Button>
    </Accordion>
  )
}

function dateRange(start: string, end: string) {
  const format = (value: string) => /^\d{4}-\d{2}$/.test(value) ? new Date(`${value}-01T12:00:00`).toLocaleDateString(undefined, { month: 'short', year: 'numeric' }) : value
  return [format(start), format(end)].filter(Boolean).join(' – ')
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
