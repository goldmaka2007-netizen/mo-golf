# Makka Application — Account Management Production Release — 2026-08-29

## Status

`COMPLETED / PRODUCTION DEPLOYED / OWNER MANUAL ACCEPTED`

Cross-system closure is completed only after direct GitHub + Notion + Google Drive verification.

## Production identity

- Production: `https://makka-central-accounting.web.app`
- Firebase project: `makka-central-accounting`
- Repository: `goldmaka2007-netizen/mo-golf`
- Deployed application commit: `318b2d1bc26256b29bb91fc918c6bddfebb2b95e`
- Deployment scope: Firebase Hosting only.

## Accepted scope

- Settings → Accounts now opens the real Chart of Accounts; Rules continues to open the accounting guide/rules screen.
- Account creation remains clone-only through “إنشاء حساب مشابه”, inheriting only the already approved safe account characteristics/rules.
- “إدارة استخدامات الحساب” shows current operational uses for an account.
- Protected/system/inventory/merchant-sensitive accounts remain read-only for Add Use.
- Add Use is derived only from one unambiguous existing operational rule pattern; there is no free debit/credit editor.
- Persistence independently re-resolves the effective canonical account and re-derives the candidate before writing.
- New uses are written as independent deterministic-ID `transactionRules`; existing rules are not mutated.
- Effective duplicate persistence is rejected.
- Clone modal mobile layering/viewport/safe-area behavior was fixed.
- Account-row mobile layout was changed so account identity and actions no longer overlap.
- When there are zero safe candidate operation types, the UI shows a clear empty-state instead of a list of disabled operations.

## Verification

- Focused tests: `5 files / 21 tests PASS`.
- TypeScript: PASS.
- Balance Contract Guard: PASS.
- `git diff --check`: PASS.
- Production build: PASS.
- Firebase Hosting deploy: PASS.
- Production root HTTP: `200`.
- Main deployed asset HTTP: `200`; deployed asset matched the generated build.
- Owner live iPhone acceptance: mobile account-row layout PASS; clone modal/keyboard layering PASS; protected-account guard PASS; normal account-use modal PASS.

## Safety

Unchanged:

- Posting Matrix.
- WAC / COGS.
- Balance Engine semantics.
- Entry save contract.
- Golden Baseline.
- Firestore Rules / Indexes / Functions / Storage / Auth backend.
- Existing Production accounting records.

Hosting deploy did not deploy Firestore Rules, Indexes, Functions, Storage, or Auth and made no Production data write.

## Known accepted UX limitation

During final Production owner acceptance, an account with existing uses such as “دفع لعميل” and “قيد افتتاحي” could still show those same operation labels in the Add Use select because availability is based on a safe derived pattern, while the UI does not yet filter operation types already represented in the account’s current uses.

The persistence layer still performs independent safe-candidate re-derivation and `hasEffectiveDuplicate(...)` rejection before writing. No evidence of a duplicate accounting write was found in this acceptance pass.

Owner decision on 2026-08-29: **accept and close with this known UX limitation; do not implement the additional UI filtering now.** Treat any future cleanup as a separate task requiring normal Makka Change Workflow review.

## Primary runtime evidence

- Application commit: `318b2d1bc26256b29bb91fc918c6bddfebb2b95e`.
- Key safety files: `src/lib/accountUses.ts`, `src/lib/accountUseService.ts`.
- Main UI: `src/components/views/CanonicalAccountsView.tsx`.
