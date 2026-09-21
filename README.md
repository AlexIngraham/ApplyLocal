# ApplyLocal

Privacy-first Chrome extension that helps you fill job applications from a profile stored on this device. It scans a form, decides what each field is asking, and fills only the ones it is confident about. You review the page and click Submit yourself.

ApplyLocal does not submit applications, and it is not a mass-apply bot.

## Features

- Generic HTML application forms
- Greenhouse (`boards.greenhouse.io`, `job-boards.greenhouse.io`, and other `*.greenhouse.io` hosts, plus Greenhouse-shaped DOM)
- Lever (`jobs.lever.co` and other `*.lever.co` hosts, plus Lever-shaped DOM)
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
| `scripting` | Inject the content script into the active tab when it is not Greenhouse or Lever. |

Content scripts are declared only for `https://*.greenhouse.io/*` and `https://*.lever.co/*`, including iframes. Other sites run the scanner only after you open the popup. The extension does not request `<all_urls>`.

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

Reload the extension in `chrome://extensions` after each rebuild.

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

Not in this version:

- Workday
- Ashby
- iCIMS
- Taleo

## Limitations

- Custom widgets (div dropdowns, closed shadow roots, Workday-style controls) are not filled reliably. Recognized custom dropdowns are marked for review.
- Resume parsing is not implemented. You can store a resume filename as a reminder; the file is not uploaded.
- Complex salary, state, and country dropdowns are filled only when an option clearly matches.
- Confirmation detection only suggests “Looks like you submitted an application. Save it?” It does not record an application until you confirm.
- Embedded forms on a company domain are scanned when you open the popup on that tab. Greenhouse and Lever iframes are also covered by the host content scripts.

## Project layout

```text
src/classifier/          rules, normalization, confidence
src/content/             scanner, filler, observer, page controller
src/adapters/            generic, Greenhouse, Lever
src/profile/             local profile model
src/applicationTracker/  local “save this application?” flow
src/ui/popup/            extension popup
src/ui/fieldIndicator/   on-page dots
demo/                    static forms for manual checks
tests/                   classifier, fixtures, fill, tracker
```
