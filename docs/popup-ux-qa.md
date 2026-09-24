# Popup UX verification

The redesign changes only popup presentation and UI state. Autofill, classification, ATS adapters, content scripts, profile/settings schemas, backup serialization, and application tracking storage are unchanged.

## Automated checks

```sh
npm run typecheck
npm test
npm run build
node scripts/smoke-popup.mjs
```

Result: typecheck and production build passed; 191 tests in 13 files passed, including 11 new UI tests. The built bundle also passed the DOM smoke check.

For real Chrome layout/interaction checks, launch an isolated browser (macOS example):

```sh
'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' --headless=new --disable-gpu --no-first-run --no-default-browser-check --user-data-dir=/tmp/applylocal-ui-chrome --remote-debugging-port=9333 about:blank
```

Then, in a second terminal:

```sh
node scripts/qa-popup.mjs
```

This serves the actual `dist/` popup from a temporary localhost server, injects deterministic Chrome API fixtures, exercises keyboard/navigation/loading/save failures, and captures screenshots in `/tmp/applylocal-ui-qa`. It does not access your real profile or external job sites. The QA script closes its page/server; close the isolated Chrome process when finished.

Chrome checks passed at 380, 410 and 430px, including horizontal and vertical overflow, persistent panel scroll, keyboard tab/switch controls, reduced motion, entry removal, loading feedback, and save retry. Screenshots of Overview, Profile, education, experience, Settings, backup and save failure were visually inspected.

## Exact manual QA checklist

Load `dist/` as an unpacked extension in Chrome and open a job application. Use a disposable profile when testing replacement or deletion.

1. Open the popup: header appears promptly; local profile/settings remain available while page connection is pending.
2. Switch Overview → Profile → Settings: the active pill glides to each tab in roughly 180ms.
3. Switch back and rapidly alternate tabs: content moves in the matching direction without flashing or blocking clicks.
4. Open and close each profile section: height expands/collapses smoothly in roughly 220ms.
5. Watch section and entry chevrons: each rotates with the same timing and reflects its expanded state.
6. Add several education/employment entries: collapsed cards show school/role, company/degree and dates; the popup has one content scrollbar.
7. Add and remove an entry: new editor opens, entrance is subtle, removal fades/collapses, and focus returns to the Add action.
8. Select Autofill page: Filling… appears, both page actions disable, repeated clicks do not send duplicate commands, and completion restores the controls.
9. Edit profile and settings: Saving… changes quietly to Saved locally after the existing debounce. Navigate between tabs before saving and confirm edits remain.
10. Test a restricted page and a failed storage write: inline error text gives a next step; successful save retry retains the input.
11. Inspect at 380, 410 and 430px, including long URLs/names and open editors: no clipped controls or horizontal/page overflow.
12. Navigate with Tab, Shift+Tab, arrows, Home, End, Enter and Space: one navigation tab is in the tab order, closed content is skipped, and focus remains visible.
13. Enable the OS reduced-motion preference: tab, accordion, switch, spinner and entry animations stop; controls remain usable.
14. Edit values, switch tabs, reopen sections and scroll: input/section state survives navigation; reopen the popup after Saved locally to confirm persistence. Export/import a backup through the native Chrome dialogs and confirm data is restored only after confirmation.
15. On an actual application, verify scan/autofill and saved-application actions still behave as before. Never submit as part of UI QA.

The browser harness and unit tests cover these interactions with fixtures. Native toolbar-popup lifecycle, OS file-picker/download dialogs, external ATS pages and subjective motion feel remain manual release checks; no live ATS end-to-end test was performed in this session.

## Remaining UI limitations

- Full dark mode, profile search and profile completion are intentionally deferred.
- Large expanded field lists still require scrolling; collapsed sections reduce the default information load.
- The existing API does not supply incremental fill progress, so the button uses a spinner and completion count rather than a fabricated percentage.
- The existing autosave debounce remains 300ms for profile and 200ms for settings. Wait for Saved locally before closing the popup.
