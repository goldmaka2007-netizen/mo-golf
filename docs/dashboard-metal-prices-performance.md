# Dashboard metal prices and return performance

- Date: 2026-08-04
- Commit: final fix(dashboard) commit (exact hash in the delivery report)
- Production: https://makka-central-accounting.web.app

## Problem and root cause

Commit bb56e8c replaced the legacy HomeView with DashboardView, which hid the existing daily gold and silver price controls. Route navigation also unmounted Dashboard; returning recreated it and synchronously rebuilt the financial statements, monthly report, and operational projection even when all inputs were unchanged. Firestore listeners are owned by App through useDataSync, so navigation did not duplicate them.

## Changes

- Added a compact Arabic/RTL, iPhone-safe editor for the current 21K gold gram and silver gram sell prices.
- Reused the existing settings/{userId} document and existing fields. Saving uses merge semantics, keeps spreads, derives buy prices with the existing behavior, and updates the Zustand display immediately after success.
- Added local validation, saving state, disabled save button, and Arabic success/error feedback.
- Added a single-entry in-memory Dashboard result cache keyed by the existing store references, timeline, prices, and date. Route return reuses the last result; changed entries/accounts/timeline/prices trigger a fresh calculation.
- Firestore listeners remain 7 before and after; no listener or query was added for navigation, and existing cleanup remains unchanged.

## Verification

- Focused regression tests: 6 passed.
- TypeScript/Lint: passed (tsc --noEmit).
- Balance contract guard: passed.
- Production build: passed.
- Firebase Hosting deploy: passed.
- Production root and main JavaScript asset: HTTP 200.
- Main asset contains the new metal price editor; browser console errors: none.
- Authenticated visual Dashboard verification was unavailable because the verification browser had no signed-in session.

## Safety

- Firestore Data unchanged by implementation/deployment; only normal user-triggered price saves can update the existing settings document.
- Firestore Rules unchanged.
- Firestore Indexes, Functions, Storage, Authentication, Posting Engine, WAC, and historical documents unchanged.
- Deployment scope: Firebase Hosting only.
