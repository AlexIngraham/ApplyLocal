# ApplyLocal

ApplyLocal is a Chrome extension that fills job applications from a profile stored on this device. It scans the form, fills fields it recognizes with high confidence, and leaves the rest for you to review. You submit the application yourself.

## Features

- Manifest V3 extension (Chrome 111+)
- Local profile: contact info, links, education, employment, skills, and reusable answers
- One-click autofill from the popup
- Generic HTML forms, Greenhouse, Lever, and Workday
- Custom dropdowns and comboboxes
- Repeated employment and education sections
- Multi-value skill selectors
- Confidence scoring, with on-page indicators for filled, suggested, and skipped fields
- Local JSON export and import of your profile and settings
- Optional local application log that asks before saving

## Supported platforms

| Platform | Support |
| --- | --- |
| Generic HTML | Supported when you open the popup on that tab |
| Greenhouse | Supported on `*.greenhouse.io`, including iframes |
| Lever | Supported on `*.lever.co`, including iframes |
| Workday | Supported on `*.myworkdayjobs.com`, with employer-specific gaps |

Greenhouse, Lever, and Workday get a content script automatically. Other sites are scanned only after you open the popup, using `activeTab` and `scripting`. There is no `<all_urls>` permission.

## Privacy

- Profile, settings, and saved applications stay in `chrome.storage.local` on this device.
- No account, backend, or analytics service is required.
- ApplyLocal does not click Submit.
- It does not rewrite job URLs or add referral parameters.
- Race, ethnicity, gender, disability, veteran status, religion, and sexual orientation are not inferred. Those questions stay manual unless you explicitly enable autofill for that category.
- Backup files are plaintext and can include contact details and demographic answers. Store them securely.

Permissions are `storage`, `activeTab`, and `scripting`.

## Installation

```bash
npm install
npm run build
```

The unpacked extension is the `dist/` directory.

1. Open `chrome://extensions`.
2. Turn on **Developer mode**.
3. Click **Load unpacked**.
4. Select the `dist` folder in this project.

Open a job form, or run the local demo below, then open the ApplyLocal popup. On a generic page, use **Scan again** or **Autofill page**.

## Development

```bash
npm run typecheck
npm test
npm run test:watch
npm run watch
npm run build
npm run demo
```

`npm run build` typechecks, bundles the popup, content script, and service worker, and checks that `dist/` is loadable. `npm run watch` rebuilds those bundles as you edit. Run `npm run build` once before watching so `dist/` already contains the manifest and icons.

After source changes, reload ApplyLocal on `chrome://extensions` and refresh the application tab so the page picks up the new content script. Keep loading `dist/`, not the repository root.

`npm run demo` serves the static forms in `demo/` at `http://localhost:4173`.

## How it works

```text
Page scanner
→ field classifier
→ ATS adapter
→ profile resolver
→ autofill
→ user review
```

The scanner reads each control’s label, name, placeholder, nearby text, and options. The classifier maps that text to a profile field and a score from 0 to 1. At **0.90** or above, an empty field is filled when automatic fill is on. From **0.65 to 0.89**, ApplyLocal shows a suggestion and leaves the field alone. Below **0.65**, it does nothing. Thresholds are adjustable in Settings.

Text, email, phone, number, textarea, select, radio, and checkbox controls are supported, including React- and Vue-style inputs. File uploads, including resumes, are never filled. A value you have already typed is not overwritten.

## Workday

Workday support covers common text fields, custom comboboxes, repeated employment and education cards, multi-step pages that re-render, and skill-chip inputs. Skills are entered one match at a time when the option is unambiguous.

Put employment and education in the profile **most recent first**. The first saved entry maps to the first card. ApplyLocal does not click Add, Next, Save, or Submit.

Workday layouts differ by employer. Unrecognized widgets, ambiguous dropdowns, and some reordered cards still need manual review.

## Backup

In **Settings → Data**, **Export backup** downloads `job-autofill-backup-YYYY-MM-DD.json` with your profile and settings. **Import backup** shows a short summary, then **Replace profile and settings** writes both together. Cancel, invalid JSON, and unsupported versions leave storage unchanged. Saved applications are not included in the file. Export and import stay on your device.

## Limitations

- Some employer-specific widgets and closed shadow roots still need manual entry.
- Resume files are not parsed or uploaded. You can store a filename as a reminder.
- Dropdowns are filled only when one option matches clearly.
- ApplyLocal never submits the application.
- Sites without a dedicated adapter use the generic scanner, and only after you open the popup.

## Roadmap

- More ATS adapters
- Resume parsing into the local profile
- Further Workday coverage for employer-specific controls

## Project structure

```text
src/adapters/     generic, Greenhouse, Lever, Workday
src/classifier/   field rules and confidence
src/content/      scanner, filler, dynamic forms
src/profile/      local profile
src/ui/popup/     extension popup
demo/             static forms
tests/            classifier, fixtures, and fill tests
```
