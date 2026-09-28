# Popup UX verification

This release pass changes popup copy, spacing and opening size. Autofill logic, ATS adapters, profile/settings schemas, backup serialization and application storage are unchanged.

## Automated checks

```sh
npm run typecheck
npm test
npm run build
node scripts/smoke-popup.mjs
```

Typecheck, all 191 tests in 13 files (including 11 popup UI tests), the production build and the built-popup DOM smoke check pass.

For Chrome layout/interaction checks, launch an isolated browser (macOS example; Chrome for Testing also works):

```sh
'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' --headless=new --disable-gpu --no-first-run --no-default-browser-check --user-data-dir=/tmp/applylocal-ui-chrome --remote-debugging-port=9333 about:blank
```

Then run:

```sh
node scripts/qa-popup.mjs
```

The harness serves `dist/` on localhost with deterministic Chrome API fixtures and writes screenshots to `/tmp/applylocal-ui-qa`. It does not access real profiles or live job sites. It closes its page/server; close the isolated browser when finished.

The opening regression starts at 220 × 160 and asserts a 410 × 580 document, independent of the initial viewport. At a capped 498px height, every tab must retain at least 320px of content and backup actions must remain reachable by internal scrolling. The active panel fills the shell without page overflow. Alternate widths of 380px and 430px are applied explicitly by the harness; the native popup requests 410px.

Chrome for Testing 154 passed the opening, capped-height, width, keyboard, tab/accordion persistence, loading, save-retry, entry-removal and emulated reduced-motion checks. Completion feedback is awaited by state, avoiding a fixed-delay race. Screenshots of all tabs, open editors, backup controls and save errors were visually inspected.

## Manual release checks

Load `dist/` as an unpacked extension. Use a disposable profile for replacement/deletion checks.

1. Open from Chrome's toolbar, close and reopen: the popup requests approximately 410 × 580, never a tiny initial viewport. On a shorter display, all three tabs retain usable content and internal scrolling.
2. Check Overview hierarchy: ApplyLocal → current site/ATS and fill counts → Autofill → Scan again. No promotional intro, redundant subtitle or submission reassurance. Check all tabs for clipped controls, horizontal scrolling and awkward gaps.
3. Switch Overview → Profile → Settings and rapidly switch back: transitions stay smooth, content remains clickable, and profile input, accordion state and scroll position survive navigation.
4. Open/close profile sections, add several entries, then remove one: height and chevrons animate together, new editors open, removed entries stop receiving focus, and focus returns to the Add action. Only the active panel scrolls.
5. Use Tab, Shift+Tab, arrows, Home, End, Enter and Space: focus is visible, inactive panels/closed sections are skipped, and switches work. Enable OS reduced motion: tab, accordion, switch, spinner and entry animations stop. Check motion feel with both preferences.
6. Select Autofill: Filling… appears, page actions disable until completion, and repeated clicks do not duplicate commands. Check unsupported-page errors and save failures for useful next steps; retry a failed save without losing edits.
7. Edit profile/settings, wait for Saved locally, close and reopen: values persist. Export backup through the native download flow and verify the file. Import backup: the OS file chooser opens, a preview appears, Cancel preserves data, and replacement occurs only after confirmation. Backups contain personal data and exclude saved applications.
8. Spot-check live Greenhouse, Lever and Workday applications: scan/autofill, review counts, field details and saved-application actions behave as before. Do not submit applications as part of UI QA.

The toolbar lifecycle, OS download/file-picker dialogs, live ATS pages and subjective motion feel require human release sign-off. Fixture checks and emulated reduced motion do not replace those checks.
