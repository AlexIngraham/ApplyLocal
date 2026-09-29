# ApplyLocal

Chrome extension (MV3, Chrome 111+) that autofills job applications from a local profile. High-confidence fields are filled; the rest stay for your review. You submit the application yourself.

## Platforms

| Platform | How |
| --- | --- |
| Greenhouse | `*.greenhouse.io` (content script, iframes) |
| Lever | `*.lever.co` (content script, iframes) |
| Workday | `*.myworkdayjobs.com` (employer-specific gaps) |
| Ashby | `*.ashbyhq.com` text fields/textareas (popup scan) |
| Generic HTML | Popup on that tab (`activeTab` + `scripting`) |

No `<all_urls>`. Permissions: `storage`, `activeTab`, `scripting`.

## Privacy

Data stays in `chrome.storage.local`. No account, backend, or analytics. No Submit clicks or URL rewriting. Demographic questions are skipped unless you enable that category. Backups are plaintext JSON—store them securely.

## Install

```bash
npm install && npm run build
```

Load unpacked from `dist/` at `chrome://extensions` (Developer mode). Open a job form or `npm run demo`, then the popup. On generic pages: **Scan again** or **Autofill**.

## Development

```bash
npm run typecheck && npm test && npm run build
npm run watch    # rebuild on edit (run build once first)
npm run demo     # http://localhost:4173
```

Reload the extension and refresh the application tab after changes. Always load `dist/`, not the repo root.

## Behavior

```text
scanner → classifier → ATS adapter → profile resolver → autofill → review
```

The classifier scores each field 0–1. **≥0.90** fills empty fields (when enabled); **0.65–0.89** suggests only; below that, skip. Thresholds in Settings.

Supports text, email, phone, number, textarea, select, radio, checkbox, and custom comboboxes (including React/Vue inputs). Never fills file uploads or overwrites your edits.

**Workday:** comboboxes, repeated employment/education cards, multi-step re-renders, skill chips (one unambiguous match at a time). Profile entries **most recent first** map to cards in order. Does not click Add/Next/Save/Submit.

**Ashby:** controlled text fields via popup scan. Custom dropdowns and uploads stay manual. Details: [docs/ashby-qa.md](docs/ashby-qa.md).

**Backup:** Settings → Data exports/imports profile and settings (not saved applications). Invalid or cancelled import leaves storage unchanged.

## Limitations

Employer-specific widgets, closed shadow roots, and ambiguous dropdowns may need manual entry. No resume parse/upload (filename reminder only). No auto-submit.

## Roadmap

- More ATS adapters
- resume parsing
- deeper Workday coverage
- careerpuck compatability

## Layout

```text
src/adapters/     generic, Greenhouse, Lever, Workday, Ashby
src/classifier/   rules and confidence
src/content/      scan, fill, dynamic forms
src/profile/      storage and resolution
src/ui/popup/     popup UI
demo/             static forms
tests/            fixtures and fill tests
```
