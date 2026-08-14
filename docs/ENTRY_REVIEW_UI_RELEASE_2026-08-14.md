# Makka Application — Entry Review UI Production Release — 2026-08-14

## Status
Completed, visually accepted on iPhone, pushed to `origin/main`, and deployed to Firebase Hosting production.

## Production
- URL: https://makka-central-accounting.web.app
- Deployed asset: `assets/index-CpG2uGc2.js`
- Root HTTP: 200
- Asset HTTP: 200

## Commits
- Review redesign: `7ef2eec72698a609c0fbb58edf4f44f5fb922104` — `feat(entry): redesign invoice review screen`
- Dark Entry shell: `0fe96679d5092d030ad30e6d18328261922dc99e` — `fix(entry): align entry shell with dark review design`

## UI Changes
- Redesigned Step 3 invoice review as a compact dark mobile-first review surface.
- Invoice number and date are shown together in the review header.
- Cash, weight, karat, official gold price, and conditional count are presented as compact summary cards.
- Count visibility uses the existing canonical account registry and `tracksQuantity` metadata; weight-only products hide count, while quantity-capable products show it.
- Debit and credit accounts remain visible in the accounting statement section.
- Customer name, phone number, and notes remain editable optional invoice fields before final save.
- Entry shell/background is dark across the full operations flow so the review card and app shell are visually consistent.
- Bottom safe-area spacing and mobile scrolling remain preserved.

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
- Focused EntryForm/count tests: 2 files / 7 tests Passed
- `npm run typecheck`: Passed
- `npm run check:balance-contract`: Passed
- `npm run build`: Passed
- `git diff --check`: Passed

## Browser Smoke
Passed on production:
- Firebase initialization
- React mount
- session/login flow
- operations screen
- new dark review shell
- no startup/runtime console errors

Conditional count checks:
- `كسر افرنجي` (weight-only): count hidden
- `سيليكون` (count-capable accessory): count shown
- weight + quantity behavior covered by focused regression tests

A non-fatal Firestore multi-tab persistence warning was observed; the app fell back to memory cache and continued without runtime errors.

## Firebase Safety
Hosting-only deployment. No Preview deployment. No Firestore Data/Rules/Indexes, Functions, Storage, or Authentication changes.
