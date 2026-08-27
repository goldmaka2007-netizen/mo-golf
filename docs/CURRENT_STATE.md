# Current Project State

Last reviewed: 2026-08-27

## Production baseline

- Repository: `goldmaka2007-netizen/mo-golf`
- Production: https://makka-central-accounting.web.app
- Firebase project: `makka-central-accounting`
- Latest deployed application commit: `40649506a3f3181ee2f421412f1d08a1f6734c3e`
- Latest release: Phase 4A Reports Internal Lazy Loading, including the previously merged Phase 1–3C cleanup sequence.
- Deployment scope: Firebase Hosting only.
- Current release status: `COMPLETED / PRODUCTION DEPLOYED / OWNER MANUAL ACCEPTED / CROSS-SYSTEM SYNC IN PROGRESS`.
- Initial Phase 4A Hosting deploy built with incorrect `deploy-test` Firebase client placeholders and owner live login failed with `auth/api-key-not-valid`.
- Recovery rebuilt the same tracked application code with the verified existing Production Firebase Web App configuration from the trusted ignored local environment. No tracked source file changed.
- Corrected Production main asset: `index-72h3Vki6.js`; local and Production SHA-256 matched exactly: `0e35aef0ce1c1e523779fab54cc9d1fcc16845d7a0d58d28cb77e9a9649e959d`.
- Corrected deployed Auth API-key validity check returned `INVALID_LOGIN_CREDENTIALS` for a deliberately nonexistent test login, proving the key was accepted rather than `API_KEY_INVALID`.
- Owner live iPhone acceptance passed: login succeeded, Reports menu opened, lazy-loaded General Ledger opened, return navigation worked, and Monthly Report opened with live data.
- No Firestore data, Rules, Indexes, Functions, Storage, Auth backend/config, accounting rule, Golden Baseline, or backend resource changed during Phase 4A or its recovery.

## Current production implementation — Phase 4A Reports Internal Lazy Loading

- Phase 4A was merged through GitHub PR #12 at application commit `40649506a3f3181ee2f421412f1d08a1f6734c3e` after explicit owner approval and two independent acceptance reviews.
- Root cause: `ReportsView` was already a lazy top-level screen, but it statically imported all report implementations, creating a `526.75 KB` ReportsView chunk.
- Accepted implementation: 10 report implementations are now loaded on demand from `ReportsView` using `React.lazy` + `Suspense`.
- Historical PWA compatibility preserved: `MonthlyReportView` remains a static import inside `ReportsView`. The first PR revision attempted to lazy-load it, but independent review blocked merge after tracing the historical regression guard from commit `915b448394ed58687e52f4d0097aa8815117a965` (`fix(pwa): recover monthly report chunk failures`). The original Monthly Report protection was restored before acceptance.
- Routing semantics preserved: ReportId values, report menu/order/labels, report aliases, `openLedger`, ledger account routing, browser history/back behavior, date filters, `MonthlyReportView.onNavigate`, RTL and report calculations remain unchanged.
- Focused acceptance: `14/14 PASS`; report UI integration PASS; Typecheck PASS; Balance Contract Guard PASS; Build PASS; `git diff --check` PASS; UTF-8/mojibake check PASS.
- Corrected Production build: initial/main `~1,340.20 KB`; ReportsView including MonthlyReportView `432.45 KB`. Only the initial/main chunk remains above 500 KB.
- ReportsView improvement versus the original Phase 4A baseline: `526.75 KB → 432.45 KB`, a reduction of about `94.30 KB` / `17.89%`, while retaining the historical Monthly Report chunk-safety rule.
- Owner Production smoke on 2026-08-27: authenticated login PASS; Reports menu PASS; lazy General Ledger PASS; report return navigation PASS; Monthly Report PASS.
- Protected Posting Matrix, WAC/COGS, Balance Engine, EntryForm/save-edit contract, report/accounting engines, store persistence, Firebase backend/data, Golden Baseline, dependencies and Vite configuration were unchanged.
- Primary implementation evidence: GitHub PR #12.

## Cleanup sequence now included in Production

The following previously merged cleanup phases are now included in Production because the deployment was built from current `main` application code at `40649506a3f3181ee2f421412f1d08a1f6734c3e`:

### Phase 3C — Daily Journal Presentation Component Split
- Application commit: `cc1940a82b41f51067fa05e06977143bb4558c0d`, PR #11.
- Extracted Daily Journal presentation components while preserving orchestration and all report/accounting calculations.
- First review caught Arabic mojibake; canonical UTF-8 wording and a regression guard were restored before acceptance.
- Verification at acceptance: focused Daily Journal `20/20 PASS`; Typecheck, Balance Contract, Build and `git diff --check` PASS.

### Phase 3B — Daily Journal Structural Cleanup
- Application commit: `4aa40d290807932b301e4123c8883524b7111864`, PR #10.
- Extracted date controls and pure presentation helpers for CSV/grouping while preserving Daily Journal accounting/report behavior.
- Verification at acceptance: focused `3/3 PASS`; Typecheck, Balance Contract, Build and `git diff --check` PASS; full Vitest `556 passed / same 11 known pre-existing failures`.

### Phase 3A — App Shell Cleanup
- Application commit: `5395cef910dd2a8dd6aa402a928423f39f59c52d`, PR #9.
- Extracted App header, routing presentation and pure navigation metadata while preserving lazy/Suspense behavior and write/accounting handlers.
- Verification at acceptance: focused `7/7 PASS`; Typecheck, Balance Contract, Build and `git diff --check` PASS; full Vitest `555 passed / same 11 known pre-existing failures`.

### Phase 2 — Settings UI Refactor
- Application commit: `41f02379e445deaaf0c29e263f8f91085a9f5db6`, PR #8.
- Split Settings presentation while keeping validation, Firestore persistence, import/export, WAC generation, operation locks and controller behavior in `SettingsView`.
- Independent review caught and fixed an inventory navigation callback regression before merge.
- Verification at acceptance: focused `15/15 PASS`; Typecheck, Balance Contract, Build and `git diff --check` PASS; full Vitest `551 passed / same 11 known pre-existing failures`.

### Phase 1 — Safe Cleanup
- Application commit: `6f628b99bcca37df9c5892dd1d03aef9319f6bde`, PR #7.
- Lazy-loaded Settings, Story Builder and Inventory Check; reused a loading fallback; extracted page-title mapping; removed one unused MainDashboard prop.
- Main JavaScript decreased from `1,433,712` to `1,339,297` bytes (`-94,415`, about `6.6%`).
- No dead-code files were deleted because deletion safety was not proven.

## Previous production release — Home Gold Summary Alignment

The Operational Home gold card consumes the same Financial Position ownership projection used for official supporting E21 quantities.

- Previous Production application commit: `a9e23b0c51adc0d0ff960dde8d333d2cc94ca194`.
- Home displays Gold Assets, Gold Liabilities and Gold Equity/Net Ownership as E21 weights.
- Owner live acceptance on 2026-08-27 showed `2,209.75 / 100.06 / 2,109.69 g E21` without clipping/overlap and matched the reviewed Financial Position quantities after display rounding.
- Detailed record: `docs/HOME_GOLD_SUMMARY_ALIGNMENT_PRODUCTION_RELEASE_2026-08-27.md`.
- Decision: `docs/DECISIONS.md` D-020.

## Production deployment/recovery lessons — 2026-08-27

- A stale-baseline Hosting deploy risk was previously detected and recovered by redeploying approved Production baseline `a9e23b0c51adc0d0ff960dde8d333d2cc94ca194`.
- Phase 4A then exposed a separate deployment-environment risk: a clean deployment workspace can build successfully while embedding wrong Firebase client environment values.
- Exact Git SHA + asset hash verification alone is therefore insufficient for authenticated releases; Production Firebase client configuration must also be verified before Hosting deploy.
- Real Production env values remain ignored and uncommitted. Do not commit Firebase client configuration or deployment credentials.

## Manual / visual acceptance rule

Codex may perform code work, automated tests, build and technical deployment verification. Final Visual / UX / operational acceptance on Firebase Production belongs to the owner. ChatGPT may guide and verify screenshots/exports. A task is not Closed until owner acceptance when applicable and GitHub + Notion + Google Drive are synchronized and directly re-read by ChatGPT.

## Protected accounting/data invariants

Do not change these without a separate explicit owner decision and approval:

- Posting Matrix.
- WAC / COGS.
- Balance Engine semantics.
- Entry save contract/schema outside an explicitly approved scope.
- Historical Firestore records.
- Firestore Rules / Indexes / Functions / Storage / Auth.
- Golden Baseline.

## Known open items

- Pre-existing accounting/Golden test failures remain separate follow-up work. Do not regenerate or alter the Golden Baseline merely to clear them.
- Completion of the full historical 2116-row migration/reconciliation is not proven by current documentation.
- Historical `arabicWeight` migration/backfill remains **not approved** and requires a separate Critical migration safety review, dry run, rollback design and explicit owner approval.
- The initial/main JavaScript chunk remains above 500 KB (`~1,340.20 KB`) and is a separate future performance item. Phase 4A removed the ReportsView chunk from the >500 KB list without changing Vite configuration.
- Legacy Planning/Grill trackers are not evidence of current Production state.

## Source roles and closure

- GitHub: execution truth for code, tests, deployment implementation and technical state.
- Notion: workflow, approved decisions, task status and change history.
- Google Drive: accounting, operational, architecture and reviewer-facing references.
- `Makka — Current Reviewer Context` must stay short and point to primary evidence.
- Uploaded copies are snapshots only; live GitHub/Notion/Drive sources win when they differ.
- Phase 4A implementation, recovery deployment, and Owner Manual Acceptance are complete. Hard closure still requires the final GitHub + Notion + Google Drive synchronization and direct re-read to be consistent.
