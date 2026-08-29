# Makka Application — Account Management Production Release — 2026-08-29

## Status

`COMPLETED / PRODUCTION DEPLOYED / OWNER MANUAL ACCEPTED / CROSS-SYSTEM VERIFIED`

Direct GitHub + Notion + Google Drive closure verification completed on 2026-08-29. A same-day Production follow-up for Firestore read-quota pressure was then implemented, deployed, owner-accepted, and re-synchronized.

## Production identity

- Production: `https://makka-central-accounting.web.app`
- Firebase project: `makka-central-accounting`
- Repository: `goldmaka2007-netizen/mo-golf`
- Original account-management application commit: `318b2d1bc26256b29bb91fc918c6bddfebb2b95e`
- Current deployed application commit after read-quota follow-up: `1fa1da6bc8be0f0dd8b6583cd9edb944a5567e82`
- Deployment scope: Firebase Hosting only.

## Accepted account-management scope

- Settings → Accounts opens the real Chart of Accounts; Rules continues to open the accounting guide/rules screen.
- Account creation remains clone-only through “إنشاء حساب مشابه”, inheriting only the already approved safe account characteristics/rules.
- “إدارة استخدامات الحساب” shows current operational uses for an account.
- Protected/system/inventory/merchant-sensitive accounts remain read-only for Add Use.
- Add Use is derived only from one unambiguous existing operational rule pattern; there is no free debit/credit editor.
- Persistence independently re-resolves the effective canonical account and re-derives the candidate before writing.
- New uses are written as independent deterministic-ID `transactionRules`; existing rules are not mutated.
- Effective duplicate persistence is rejected.
- Clone modal mobile layering/viewport/safe-area behavior was fixed.
- Account-row mobile layout separates account identity from actions so they no longer overlap.
- When there are zero safe candidate operation types, the UI shows a clear empty-state instead of a list of disabled operations.

## Production follow-up — Firestore read-quota pressure

### Observed Production failure

Clone creation failed with Firestore `Quota exceeded`. Firebase usage evidence showed read pressure (`~38k` current reads versus `4` writes), while the application already maintained realtime listeners.

### Proven amplification path

`App.tsx` also exposed a global manual refresh action that called `getDocsFromServer(...)` for the full `entries` history. This duplicated the existing realtime entries listener and could consume thousands of extra reads per refresh on the current historical dataset.

### Accepted correction

- Removed the redundant full-history `getDocsFromServer` refresh path from `App.tsx`.
- The header control is now a passive automatic-sync indicator and has no click handler or Firestore read action.
- The underlying `useDataSync` realtime/history behavior was intentionally not redesigned in this limited-risk fix.
- Clone failures now remain visible inside the active clone modal via `role="alert"`.
- Firestore quota/resource-exhaustion errors map to clear Arabic copy: `تم تجاوز حد استخدام قاعدة البيانات حاليًا. لم يتم إنشاء الحساب. حاول مرة أخرى لاحقًا.`
- No automatic retry and no Production test account creation were introduced.

## Verification

### Original account-management release

- Focused tests: `5 files / 21 tests PASS`.
- TypeScript: PASS.
- Balance Contract Guard: PASS.
- `git diff --check`: PASS.
- Production build: PASS.
- Firebase Hosting deploy: PASS.
- Production root HTTP: `200`.
- Main deployed asset HTTP: `200`; deployed asset matched the generated build.
- Owner live iPhone acceptance: mobile account-row layout PASS; clone modal/keyboard layering PASS; protected-account guard PASS; normal account-use modal PASS.

### Read-quota follow-up

- Focused tests: `3 files / 12 tests PASS`.
- TypeScript: PASS.
- Balance Contract Guard: PASS.
- `git diff --check`: PASS.
- Production build: PASS.
- Firebase Hosting deploy: PASS.
- Production root HTTP: `200`.
- Main asset HTTP: `200`; deployed asset matched the generated build.
- Owner Production acceptance: quota error rendered correctly inside the clone modal; account was not created while quota was exhausted.
- Owner accepted the mobile header presentation where the passive sync icon is visible while the text label is hidden on the narrowest layout.

## Safety

Unchanged throughout both releases:

- Posting Matrix.
- WAC / COGS.
- Balance Engine semantics.
- Entry save contract.
- Golden Baseline.
- Firestore Rules / Indexes / Functions / Storage / Auth backend.
- Existing Production accounting records.

Hosting deploys did not deploy Firestore Rules, Indexes, Functions, Storage, or Auth and made no Production data write.

## Known accepted UX limitations

1. During final Production account-use acceptance, an account with existing uses such as “دفع لعميل” and “قيد افتتاحي” could still show those same operation labels in the Add Use select because availability is based on a safe derived pattern, while the UI does not yet filter operation types already represented in current uses. Persistence still performs independent safe-candidate re-derivation and rejects effective duplicates before writing. Owner decision: accept and defer UI filtering.
2. On the narrowest mobile layout, the passive automatic-sync header control currently shows the refresh-style icon while the text label “المزامنة تلقائية” is hidden. The control has no `onClick` and cannot trigger a Firestore read. Owner decision: accept current presentation and close; any label-visibility polish is a separate future task.

## Primary runtime evidence

- Current deployed application commit: `1fa1da6bc8be0f0dd8b6583cd9edb944a5567e82`.
- Account-use safety files: `src/lib/accountUses.ts`, `src/lib/accountUseService.ts`.
- Account clone persistence: `src/lib/accountCloneService.ts`.
- Realtime sync baseline: `src/hooks/useDataSync.ts`.
- App/header read-quota correction: `src/App.tsx`, `src/components/app/AppHeader.tsx`.
- Main account UI: `src/components/views/CanonicalAccountsView.tsx`.
