# Makka Application — Entry Review UI Production Release — 2026-08-14

## Status
Completed, visually accepted on iPhone, pushed to `origin/main`, and deployed to Firebase Hosting production.

## Production
- URL: https://makka-central-accounting.web.app
- Review release asset: `assets/index-CpG2uGc2.js`
- Root HTTP: 200
- Asset HTTP: 200

## Commits
- Review redesign: `7ef2eec72698a609c0fbb58edf4f44f5fb922104` — `feat(entry): redesign invoice review screen`
- Dark Entry shell: `0fe96679d5092d030ad30e6d18328261922dc99e` — `fix(entry): align entry shell with dark review design`
- Operations Step 1 light-shell restoration: `76c5eea`
- Final Step 3 dark-shell correction: `d6893403217054799529a909c8e8a18155519032` — `Fix entry shell for review step`
- Current merged `main` after the correction: `e9f5cf7efe86524534231206c466c71d8b1281ee`

## UI Changes
- Redesigned Step 3 invoice review as a compact dark mobile-first review surface.
- Invoice number and date are shown together in the review header.
- Cash, weight, karat, official gold price, and conditional count are presented as compact summary cards.
- Count visibility uses the existing canonical account registry and `tracksQuantity` metadata; weight-only products hide count, while quantity-capable products show it.
- Debit and credit accounts remain visible in the accounting statement section.
- Customer name, phone number, and notes remain editable optional invoice fields before final save.
- Bottom safe-area spacing and mobile scrolling remain preserved.

## Shell Isolation Hotfix — 2026-08-14
A follow-up UI regression was found after the dark-shell change: the Operations / Step 1 chooser unintentionally inherited the dark Entry shell.

The first correction restored Step 1 to the original light shell, but a production visual check then revealed that Step 3 was inheriting that light outer shell while its review card remained dark.

Final approved shell behavior:
- Operations / Step 1: original light background and light header shell restored exactly.
- Step 2: current dark styling preserved.
- Step 3 final invoice review: dark outer shell, dark header, and approved dark review design preserved.

The final fix is isolated to `src/App.tsx`. The shell condition is now `isEntryDarkShell = view === 'entry' && entryStep >= 2`, so only Step 1 remains light while Steps 2 and 3 use the dark shell.

No `EntryForm` accounting, save, validation, or review logic was changed.

User manual visual acceptance passed on the local build. Final post-deploy screenshots from production confirmed all three intended states together: Step 1 light, Step 2 dark, and Step 3 fully dark including the outer shell and header.

## Behavior Preserved
No change to:
- save payload
- Posting Matrix / accounting semantics
- WAC / inventory cost / COGS
- invoice or journal numbering
- Firestore schema or data
- Firestore Rules / Indexes
- Functions / Storage / Authentication
- reports

## Validation
Original review release:
- Focused EntryForm/count tests: 2 files / 7 tests Passed
- `npm run typecheck`: Passed
- `npm run check:balance-contract`: Passed
- `npm run build`: Passed
- `git diff --check`: Passed

Final shell correction:
- Focused EntryForm/UI regression tests: Passed
- `npm run typecheck`: Passed
- `npm run build`: Passed
- `git diff --check`: Passed
- Manual local visual acceptance: Passed
- Final production visual acceptance from user screenshots: Passed

## Browser / Production Acceptance
Original review release browser smoke passed for Firebase initialization, React mount, session/login flow, operations screen, review UI, and no startup/runtime console errors.

For the shell isolation correction, automated browser capture in the Codex environment was unavailable. The user manually verified the local build and then supplied final production screenshots confirming Step 1 light, Step 2 dark, and Step 3 fully dark after the Hosting deployment.

## Firebase Safety
Hosting-only deployment for the UI fixes. No Firestore Data/Rules/Indexes, Functions, Storage, or Authentication changes.
