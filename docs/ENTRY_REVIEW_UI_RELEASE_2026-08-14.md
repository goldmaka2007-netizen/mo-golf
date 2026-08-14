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
- Operations shell isolation hotfix: `76c5eea` — restores the original light shell for Operations / Step 1 while preserving the current dark Step 2 and dark Step 3 review design.

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

Final approved shell behavior:
- Operations / Step 1: original light background and light header shell restored exactly.
- Step 2: current dark styling preserved.
- Step 3 final invoice review: approved dark review design preserved.

The hotfix is isolated to `src/App.tsx`. No `EntryForm` accounting, save, validation, or review logic was changed.

User manual visual acceptance passed on the local build, and post-deploy screenshots from production confirmed the three intended visual states together: Step 1 light, Step 2 dark, Step 3 review dark.

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

Shell isolation hotfix:
- Focused Vitest regression tests passed
- `npm run typecheck`: Passed
- `npm run build`: Passed
- `git diff --check`: Passed
- Manual local visual acceptance: Passed
- Production visual acceptance from user screenshots: Passed

## Browser / Production Acceptance
Original review release browser smoke passed for Firebase initialization, React mount, session/login flow, operations screen, review UI, and no startup/runtime console errors.

For the shell isolation hotfix, automated browser capture in the Codex environment was unavailable, but the user manually verified the local build and then supplied production screenshots confirming the intended Step 1 / Step 2 / Step 3 visual states after the Hosting deployment.

## Firebase Safety
Hosting-only deployment for the UI hotfix. No Firestore Data/Rules/Indexes, Functions, Storage, or Authentication changes.
