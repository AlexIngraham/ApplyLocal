# ApplyLocal

Privacy-first Chrome extension that helps you fill job applications from a profile stored on this device. It scans a form, decides what each field is asking, and fills only the ones it is confident about. You review the page and click Submit yourself.

ApplyLocal does not submit applications, and it is not a mass-apply bot.

## Features

- Generic HTML application forms
- Greenhouse (`boards.greenhouse.io`, `job-boards.greenhouse.io`, and other `*.greenhouse.io` hosts, plus Greenhouse-shaped DOM)
- Lever (`jobs.lever.co` and other `*.lever.co` hosts, plus Lever-shaped DOM)
- Workday (`*.myworkdayjobs.com` and common Workday DOM markers)
- Local JSON backup export/import for profile and settings
- Confidence-based field detection
- Local profile: contact info, links, education, employment, and reusable application answers
- Field indicators: green when filled, yellow when a suggestion needs review, gray when a field was recognized and skipped
- Dynamic forms via a debounced `MutationObserver`
- Optional local application tracker that asks before saving

## Privacy

- Profile, settings, and saved applications stay in `chrome.storage.local` on this device.
- No server, account, or network API is required.
- This version does not collect analytics.
- It does not add affiliate or referral parameters, and it does not rewrite job URLs.
- It never clicks Submit for you.
- Questions about race, ethnicity, gender, disability, veteran status, religion, or sexual orientation are not inferred. They stay manual unless you save an answer for that exact category and turn autofill on for it. A settings switch blocks all of them by default.
- Production builds do not log profile values.

## Permissions

| Permission | Why |
| --- | --- |
| `storage` | Save the profile, settings, and application notes locally. Frame bookkeeping uses `chrome.storage.session`, which is covered by the same permission. |
| `activeTab` | Read the current tab when you open the popup, so generic job sites are not granted standing access. |
| `scripting` | Inject the content script into the active tab when it is not Greenhouse, Lever, or Workday. |

Content scripts are declared only for `https://*.greenhouse.io/*`, `https://*.lever.co/*`, and `https://*.myworkdayjobs.com/*`, including iframes. Other sites run the scanner only after you open the popup. The extension does not request `<all_urls>`.

## Install the unpacked build

```bash
npm install
npm run build
```

The loadable extension is the `dist/` directory.

1. Open `chrome://extensions`.
2. Turn on Developer mode.
3. Choose **Load unpacked**.
4. Select the `dist` folder in this project.

Open a job form, or run `npm run demo` and visit `http://localhost:4173`. Then open the ApplyLocal popup. On the demo site, click **Scan again** or **Autofill page**. Load a sample profile from the Profile tab if you have not entered your own yet.

After source changes, run `npm run build`, click Reload on ApplyLocal in `chrome://extensions`, and refresh the application tab to replace its old content script. Keep loading `dist/`, not the repository root.

## Scripts

```bash
npm test
npm run typecheck
npm run build
npm run watch
npm run demo
```

`npm run watch` rebuilds the popup, content script, and service worker. Run `npm run build` once before watching so `dist/` exists. `npm run demo` serves the static forms in `demo/`.

The npm scripts call the local `tsc`, Vite, and Vitest binaries through `node`. That still works when a parent folder name contains a colon. A colon would otherwise split `node_modules/.bin` out of `PATH`.

## How a field gets filled

```text
scanner
  ↓
classifier
  ↓
confidence scoring
  ↓
ATS adapter
  ↓
filler
  ↓
visual indicator
```

The scanner reads each control’s name, id, label, placeholder, accessible name, fieldset legend, nearby text, and options. The classifier maps that text to a canonical field with a reason and a score from 0 to 1. Scoring then decides:

- **0.90 and above:** fill when automatic fill is on and the field is empty
- **0.65–0.89:** show a suggestion and leave the field for you
- **below 0.65:** leave it alone

Thresholds are adjustable in Settings.

Adapters exist so site-specific field names stay out of the shared scanner. `GenericAdapter` handles ordinary HTML. `GreenhouseAdapter` and `LeverAdapter` add a few known `name` attributes (for example Lever’s single `name` field is the full name, and its `location` field is the candidate’s city). Detection uses the hostname first and DOM markers such as `#application_form` or `form.application-form` as a fallback. Work authorization and sponsorship are separate fields, including “now” versus “in the future.”

Text, email, phone, number, textarea, select, radio, and checkbox controls are supported. React- and Vue-style inputs are updated through the native value setter, then `input`, `change`, and `blur` are dispatched. File inputs, including resumes, are never uploaded. A field you have already typed in is not overwritten. After you edit a filled field, later scans leave it alone.

## Supported platforms

Current:

- Generic HTML forms
- Greenhouse
- Lever
- Workday, including its semantic comboboxes and repeated employment/education cards

Not in this version:

- Ashby
- iCIMS
- Taleo

## Limitations

- Unknown custom widgets and closed shadow roots are left for review. Supported Workday comboboxes are filled only when one option matches unambiguously.
- Resume parsing is not implemented. You can store a resume filename as a reminder; the file is not uploaded.
- Complex salary, state, and country dropdowns are filled only when an option clearly matches.
- Demographic answers are never inferred. Exact saved answers require the global sensitive-answer setting, which defaults off.
- Confirmation detection only suggests “Looks like you submitted an application. Save it?” It does not record an application until you confirm.
- Embedded forms on a company domain are scanned when you open the popup on that tab. Greenhouse, Lever, and Workday iframes are also covered by the host content scripts.

## Project layout

```text
src/classifier/          rules, normalization, confidence
src/content/             scanner, filler, observer, page controller
src/adapters/            generic, Greenhouse, Lever, Workday
src/profile/             local profile model
src/applicationTracker/  local “save this application?” flow
src/ui/popup/            extension popup
src/ui/fieldIndicator/   on-page dots
demo/                    static forms for manual checks
tests/                   classifier, fixtures, fill, tracker
```

## Workday behavior and order

Workday support includes common text inputs, custom comboboxes, repeated employment/education sections, multi-step rescanning, and skill-chip inputs. Workday implementations vary by employer, so some custom controls still require manual review.

- Enter employment and education **most recent first**. Entry 0 maps to the first logical card. Existing profiles retain their saved array order; the extension never sorts or reverses entries.
- Repeated cards use automation boundaries, ARIA/heading relationships, repeated structure, and editable field clusters. Generated class names and DOM IDs are not used for section identity. Numbered headings and stable instance IDs take precedence over visible order.
- Collapsed summary cards contribute to entry position. An editor linked from a summary with `aria-controls` uses that summary's position. In single-editor flows, the user's Add/“Add Another” action followed by a cleared or replaced editor advances to the next entry. The extension never clicks Add, Next, Save, or Submit.
- Relevant additions, removals, visibility changes, and route changes trigger debounced reconciliation. A lightweight URL check catches history changes without patching browser APIs.
- Semantic manual-edit locks and completed-fill state persist for this page session across ordinary DOM replacement and step changes. If Workday itself discards a manual value, the extension leaves the replacement alone rather than restoring the saved profile over it. It cannot recover text discarded by the site.
- Skills are deduplicated by case and whitespace with Unicode normalization. Punctuation stays meaningful: C, C++, and C# are distinct. Options must match exactly and unambiguously. Slow options are awaited; missing/ambiguous skills are skipped. An unconfirmed selection or a disabled/maxed-out picker stops the run with review required.

Limitations: unnumbered cards that are reordered/deleted without stable identity, editors with no useful labels/boundaries, localized Add labels, and ambiguous detached summary/editor associations may need manual selection/review. Session tracking does not survive a full page reload. Live employer-specific QA remains necessary; fixtures do not establish universal Workday compatibility.

`npm run demo` → `http://localhost:4173/workday.html` provides stacked cards, a reused editor, step replacement, and a delayed skills picker that replaces its input after each chip.

## Local backups

In **Settings → Data**, choose **Export backup** to download `job-autofill-backup-YYYY-MM-DD.json`. It contains `version: 1`, `exportedAt`, `profile`, and `settings`. It contains no tracker records, page/scan state, logs, or transient DOM data.

Choose **Import backup**, select a local JSON file, review the entry-count summary, then choose **Replace profile and settings**. Cancel leaves storage untouched. Import parses and validates the entire file before writing either object. Unsupported versions, missing profile/settings objects, and malformed known properties are rejected. Missing optional version-1 properties receive defaults; unknown extra keys are discarded. Legacy sensitive-answer settings are normalized using the existing compatibility rules. Both objects are written together; existing application-tracker records remain in storage.

Backups are plaintext and may include contact details, employment history, and demographic answers. Store them securely and avoid sharing them publicly. Export and import happen entirely on your device, with no server upload.

## Live Workday QA checklist

1. Rebuild, reload the unpacked extension, and refresh the application tab. Back up your profile; save two distinct employment and education entries, most recent first.
2. Open an actual Workday application. Check Company, Title, Location, From, and To against each employment entry even when field order differs. Check School, Degree, Major, From, and To for both education entries.
3. On a one-editor layout, verify entry 0, then click Add Another yourself. Verify the next cleared/replaced editor uses entry 1. Repeat for education. Opening or cancelling Add without creating an entry must not advance it.
4. Collapse/reopen an existing card. Verify its index and missing-field suggestions still belong to that card, including when only one editor is visible.
5. Edit Company, Title, Date, and Location after autofill. Click Scan again, navigate Next/Back yourself, and trigger any employer validation/rerender. Confirm saved profile values never overwrite those edits; check site-discarded values manually.
6. Navigate between personal information, experience, education, and skills. Confirm new fields appear, old indicators disappear, dots do not duplicate, and autofill does not repeat on completed fields.
7. Test skills with an existing chip, case/space duplicates, blanks, C/C++/C#, and one unavailable skill. Under a slow connection, verify each accepted skill becomes one chip, missing/ambiguous options are skipped, and subsequent safe skills continue. At the site's skill limit, verify the run stops and reports review needed.
8. Open repeated dropdowns with identical labels in different cards. Verify only the intended card's dropdown changes and each value is accepted by Workday after blur/validation.
9. Export, change a harmless profile value/settings switch, import the file, and confirm both are restored after closing/reopening the popup. Try Cancel, malformed JSON, and a version-2 file; current data must stay unchanged on rejection.
10. Keep demographic autofill off unless explicitly testing saved answers. Confirm the extension never clicks Add, Next, Save, or Submit. Review every entry before submitting manually.
