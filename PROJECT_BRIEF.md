# Handoff Brief: ApplyLocal

## Instructions for the assistant
Write resume content for this project. Use ONLY the facts below.
Do not invent metrics, user counts, time savings, or performance
numbers. If a claim isn't here, leave it out. Match the voice of the
existing resume: past-tense action verbs, concrete technical nouns,
no marketing adjectives.

## What it is
A Chrome extension (Manifest V3) that autofills job applications from
a profile stored entirely on the user's device. It scans a form,
classifies each field, fills only high-confidence matches, and leaves
everything else for the user to review. It never clicks Submit.

Author: undergrad solo project. Not published to the Chrome Web Store.
Loadable as an unpacked extension from `dist/`.

## Stack
TypeScript, React 19, Vite 6, Vitest 3, Chrome Extension MV3
(content scripts, service worker, chrome.storage.local/session).
No backend. No external APIs. No AI/LLM calls — classification is
fully deterministic and local.

## Architecture
Six stages: page scanner, field classifier, ATS adapter, profile
resolver, autofill engine, user review via on-page indicators.

- Scanner reads each control's label, name, id, placeholder,
  accessible name, fieldset legend, nearby text, and options.
- Classifier maps that text to one of 52 canonical fields using 178
  phrase rules plus reject predicates that prevent false positives
  (e.g. "emergency phone" must not match "phone").
- Confidence scoring: >= 0.90 autofills an empty field, 0.65-0.89
  shows a suggestion only, below 0.65 does nothing. Thresholds are
  user-configurable.
- Adapter pattern isolates site-specific logic: generic HTML,
  Greenhouse, Lever, Workday. Selection is by hostname first, then
  DOM markers.
- Autofill engine handles text, email, phone, number, textarea,
  select, radio, checkbox, and custom comboboxes. Controlled React
  and Vue inputs are updated through the native value setter, then
  input/change/blur events are dispatched.
- Debounced MutationObserver reconciles dynamic and multi-step forms
  without re-filling or overwriting user edits.

## Hardest technical problem (lead with this)
Workday. Its applications use custom ARIA comboboxes instead of
native selects, repeated employment/education cards with no stable
DOM ids, multi-step pages that destroy and rebuild the DOM, and
skill pickers that replace their own input after each selection.

Solutions built:
- Section identity derived from automation boundaries, ARIA/heading
  relationships, and repeated structure rather than generated class
  names or DOM ids, so card N stays card N across re-renders.
- Manual-edit locks that survive DOM replacement, so a value the user
  typed is never overwritten by a later scan.
- Skills entered one chip at a time with exact, unambiguous option
  matching, Unicode-normalized dedup that still treats C, C++, and C#
  as distinct, and await logic for slow-loading option lists.
- The extension never clicks Add, Next, Save, or Submit.

Honest limitation: Workday layouts vary by employer. Unrecognized
widgets and ambiguous dropdowns still require manual review. Do NOT
write a bullet claiming universal Workday compatibility.

## Privacy design (a deliberate feature, not an afterthought)
- Profile, settings, and application log live in chrome.storage.local.
  Nothing leaves the device.
- Permissions are only storage, activeTab, and scripting. No
  <all_urls>. Content scripts are declared only for greenhouse.io,
  lever.co, and myworkdayjobs.com; other sites are scanned only after
  the user opens the popup.
- Demographic questions (race, ethnicity, gender, disability, veteran
  status, religion, sexual orientation) are never inferred. They are
  detected and deliberately skipped unless the user enables that exact
  category. Default is off.
- File inputs, including resumes, are never touched.
- No analytics, no referral/affiliate URL rewriting, no auto-submit.

## Verified metrics
- 6,007 lines of TypeScript/TSX across 64 source files
- 13 test suites, 120 test blocks, 1,992 lines of test code
- 14 HTML test fixtures plus 6 local demo pages
- 178 classifier phrase rules, 8 demographic detection patterns
- 52 canonical field types
- 4 ATS adapters

## Metrics that do NOT exist — never claim these
- No user count, install count, or downloads
- No measured time savings or application-throughput numbers
- No test coverage percentage
- No benchmark or latency figures
- No CI pipeline

## Features that do NOT exist — never claim these
- Resume parsing (a filename can be stored as a reminder; the file is
  never parsed or uploaded)
- Automatic submission
- Ashby, iCIMS, Taleo, or Workable support
- Cloud sync or account system

## Resume context
The author is a CS undergrad (Lafayette College, BS 2027) with three
internships and one other listed project, Oxide Lab, a Rust/WASM
image-processing workbench. Oxide Lab signals performance and
correctness work. ApplyLocal should signal product shipping and
handling messy real-world DOM environments. Both should stay on the
resume; they demonstrate different things.

## Suggested framing
Three bullets maximum, matching the density of existing entries.
Lead with what it is and the privacy model, then the Workday work as
the technical depth bullet, then the classifier/testing bullet.