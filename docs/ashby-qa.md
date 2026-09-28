# Ashby controlled-input verification

## Diagnosis

The shared filler already used native prototype setters. Its remaining event defect was dispatching a synthetic `blur` without actually blurring the input. That leaves focus in place and omits `focusout`, which React uses for `onBlur`. It also emitted a plain input Event and immediately reported success without checking a rerender.

Inspection of [Ashby's public frontend bundle](https://cdn.ashbyprd.com/frontend_non_user/5269e76dfe5dd0838e841b91072ddf00f0a24db8/assets/index-BhN0ewc9.js), served by [Ashby's job board](https://jobs.ashbyhq.com/ashby), found text/textarea wrappers using React `onChange`, with draft values flushed by `onBlur` or a debounce. The stable `ashby-application-form-container` customization class is also present there. No generated selectors are used.

The local React fixture models separate draft and committed answers. Before the fix, all five commit assertions failed: First Name, Last Name, Email, Phone and textarea. Direct `.value` assignment also reproduces visible text with empty React state, which disappears on rerender. This confirms the event defect locally; the originally reported employer's page has not been tested end to end.

## Fix

The shared text helper now uses this sequence:

1. `focus({ preventScroll: true })` (native focus/focusin).
2. The owning document's native `HTMLInputElement.prototype.value` or `HTMLTextAreaElement.prototype.value` setter.
3. A bubbling, composed `InputEvent('input')` with `inputType: 'insertText'` and the entered text as `data`. A plain composed Event is the fallback if InputEvent is unavailable.
4. A bubbling, composed `change` event.
5. Real `blur()` (native blur/focusout).

`beforeinput` and keyboard events are unnecessary for the inspected text handlers and the fixture; none are added. The shared helper no longer reads or writes React internals. Searchable skills widgets opt out of blur so their option lists remain open. Workday's separate combobox implementation is unchanged.

Ashby is detected by the `ashbyhq.com` hostname boundary or its public form-container marker. Existing semantic scanning and confidence thresholds still apply. Injection remains through the popup's existing `activeTab` path; the manifest and permissions are unchanged.

After filling, the Ashby adapter yields to the next animation frame, reacquires a uniquely identified control inside the original form if replaced, and checks the expected formatted value, native validity, `aria-invalid`, and visible `aria-errormessage` content. Missing, ambiguous or reset controls fail; remaining validation errors require review. There are no retyping loops or retries. A 100ms fallback bounds verification when background tabs pause animation frames; it is not a typing delay or a wait for server acceptance.

## Automated checks

```sh
npm run typecheck
npm test
npm run build
node scripts/qa-ashby.mjs
```

The browser script expects disposable Chrome listening on `127.0.0.1:9333`, as described in [popup QA](popup-ux-qa.md). It loads a local React fixture into a blank page and injects the actual `dist/content.js` in a separate Chrome isolated world, with fixture storage/runtime APIs. It closes its test page; close the disposable browser afterward. No live application data is sent.

Results: typecheck and production build pass; all 214 tests in 15 files pass. The 23 added tests cover controlled state and commit events, textarea, native/Vue-style listeners, owning-document constructors, composed events, InputEvent fallback, search focus, Ashby detection, rendering/replacement/reset, validation errors, formatting and manual edit protection. Existing Workday, Greenhouse, Lever, generic, skills, combobox and repeated-section tests pass.

Chrome for Testing 154 also passed the production isolated-world test: all four contact fields committed, the review-band textarea committed after its Fill action, values survived rerender, and browser-generated manual input survived Scan again and Autofill.

## Live QA still required

1. Reload the unpacked extension from `dist/` at `chrome://extensions`.
2. Refresh/open the affected Ashby application and open ApplyLocal's popup.
3. Select Autofill with First Name, Last Name, Email and Phone saved in the profile.
4. Without editing those fields, trigger the form's next-step/required-field validation. Use a test/draft application; do not complete a real submission as part of QA.
5. Confirm all four fields are recognized by the form, not merely visible.
6. Confirm no required-field errors remain for populated contact fields. Check a supported textarea separately if present.
7. Change one populated field manually, then leave that field.
8. Select Scan again and Autofill; confirm the manual value remains unchanged.

DOM verification cannot prove server-side acceptance or detect validation that has no public DOM signal or arrives after the check. Employer-specific custom widgets, masked values and closed shadow roots may still require manual entry. No per-character typing, upload automation or submission was added.
