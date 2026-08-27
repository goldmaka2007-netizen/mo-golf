# Current Project State

Last reviewed: 2026-08-27

## Production baseline

- Repository: `goldmaka2007-netizen/mo-golf`
- Production: https://makka-central-accounting.web.app
- Firebase project: `makka-central-accounting`
- Latest deployed application commit: `a9e23b0c51adc0d0ff960dde8d333d2cc94ca194`
- Latest release: Home gold summary alignment with Financial Position + mobile readability correction.
- Deployment scope: Firebase Hosting only.
- Release status: COMPLETED / PRODUCTION DEPLOYED / OWNER MANUAL ACCEPTED / CROSS-SYSTEM VERIFIED.
- A stale-baseline Hosting deploy risk on 2026-08-27 was recovered by redeploying the approved Production baseline `a9e23b0c51adc0d0ff960dde8d333d2cc94ca194`; owner manual acceptance confirmed the recovered live Home screen.

## Current non-production implementation — Phase 3C Daily Journal Presentation Component Split

- Phase 3C Daily Journal presentation split is merged to `main` at application commit `cc1940a82b41f51067fa05e06977143bb4558c0d` via PR #11 after explicit owner approval and two independent acceptance reviews.
- It is **not deployed**. Production remains on application commit `a9e23b0c51adc0d0ff960dde8d333d2cc94ca194`.
- Scope: extract Daily Journal entry sections/rows, copy/edit presentation state, development diagnostics, Cash Closing presentation, Smart Daily Management Dashboard, SmartCard, DimensionSummary and Metric into focused presentation components while preserving `DailyJournalView` orchestration and all accounting/report calculations.
- `DailyJournalView` remains owner of Zustand/store reads, selectedDate state/effects, `buildDailyJournalReport`, `buildDailyJournalSmartDashboard`, `resolveDailyJournalMarketPrice`, the historical DOM effect, raw/canonical data, grouping, selected-date shortcut and CSV orchestration/export.
- Acceptance correction: the first PR revision introduced Arabic mojibake in `DailyJournalView`; independent review blocked merge, the exact canonical UTF-8 wording was restored from the verified base, and a focused encoding regression guard was added before the second acceptance review passed.
- Verification: focused Daily Journal tests `20/20 PASS`; encoding regression guard PASS; Typecheck PASS; Balance Contract Guard PASS; Build PASS; `git diff --check` PASS; changed-source mojibake scan clean.
- Protected Posting Matrix, WAC/COGS, Balance Engine, EntryForm/save-edit contract, store persistence, Firebase backend/data, Golden Baseline, dependencies and deployment configuration were unchanged.
- No Firebase deploy or Production write occurred.
- Primary implementation evidence: GitHub PR #11.

## Previous non-production implementation — Phase 3B Daily Journal Structural Cleanup

- Phase 3B Daily Journal structural cleanup is merged to `main` at application commit `4aa40d290807932b301e4123c8883524b7111864` via PR #10 after explicit owner approval.
- It is **not deployed**. Production remains on application commit `a9e23b0c51adc0d0ff960dde8d333d2cc94ca194`.
- Scope: extract Daily Journal date controls and pure presentation helpers for CSV rows and operation grouping while preserving `DailyJournalView` orchestration and all accounting/report calculations.
- `buildDailyJournalReport`, `buildDailyJournalSmartDashboard`, `resolveDailyJournalMarketPrice`, selected-date shortcut, `historical` DOM effect, CSV contract, and sale/purchase/expense/other grouping semantics remained unchanged.
- Verification: focused Daily Journal tests `3/3 PASS`; Typecheck PASS; Balance Contract Guard PASS; Build PASS; `git diff --check` PASS; full Vitest `556 passed / same 11 known pre-existing failures`, with no new failures.
- Protected Posting Matrix, WAC/COGS, Balance Engine, EntryForm/save-edit contract, store persistence, Firebase backend/data, Golden Baseline and dependencies were unchanged.
- Primary implementation evidence: GitHub PR #10.

## Previous non-production implementation — Phase 3A App Shell Cleanup

- Phase 3A App Shell cleanup is merged to `main` at application commit `5395cef910dd2a8dd6aa402a928423f39f59c52d` via PR #9 after explicit owner approval.
- It is **not deployed**. Production remains on application commit `a9e23b0c51adc0d0ff960dde8d333d2cc94ca194`.
- Scope: extract pure navigation metadata/page-title logic, App header presentation, and view-content routing into focused App Shell components while preserving the existing lazy/Suspense mapping.
- `App.tsx` reduced from 410 to 299 lines. `refreshData`, `handleDelete`, `handleUpdate`, Firestore/audit writes, operation-write locking, cost logic, EntryForm/save-edit contracts, auth/data sync and cost recalculation behavior remained owned by `App.tsx` and behaviorally unchanged.
- Verification: focused App Shell/navigation tests `7/7 PASS`; Typecheck PASS; Balance Contract Guard PASS; Build PASS; `git diff --check` PASS; full Vitest `555 passed / same 11 known pre-existing failures`, with no new failures.
- Protected Posting Matrix, WAC/COGS, Balance Engine, Entry save/edit contract, store persistence, Firebase backend/data, Golden Baseline and dependencies were unchanged.
- Primary implementation evidence: GitHub PR #9.

## Previous non-production implementation — Phase 2 Settings UI Refactor

- Phase 2 Settings UI-only refactor is merged to `main` at application commit `41f02379e445deaaf0c29e263f8f91085a9f5db6` via PR #8.
- It is **not deployed**. Production remains on application commit `a9e23b0c51adc0d0ff960dde8d333d2cc94ca194`.
- Scope: extract Settings presentation into focused components for tab bar, rules, accounts, cost, import/export and system info while keeping state, effects, validation, Firestore persistence, import/export operations, delete-all, invoice numbering, WAC generation and operation-write locking in `SettingsView`.
- Migration-only hidden duplicate markup and wrapper-only `children` extraction were removed.
- The inventory navigation callback regression found during independent review was fixed and covered by a focused source-contract regression test.
- Verification: focused Settings suite `15/15 PASS`; typecheck PASS; Balance Contract Guard PASS; production build PASS; `git diff --check` PASS; full Vitest `551 passed / same 11 known pre-existing failures`, with no new failures.
- Protected Posting Matrix, WAC/COGS, Balance Engine, EntryForm/save contract, store persistence, Firebase backend/data, Golden Baseline and dependencies were unchanged.
- Primary implementation evidence: GitHub PR #8.

## Previous non-production implementation — Phase 1 Safe Cleanup

- Approved Phase 1 implementation is merged to `main` at application commit `6f628b99bcca37df9c5892dd1d03aef9319f6bde` via PR #7.
- It is **not deployed**. Production remains on application commit `a9e23b0c51adc0d0ff960dde8d333d2cc94ca194`.
- Scope was limited to lazy-loading `SettingsView`, `StoryBuilderView`, and `InventoryCheckView`; reusing one loading fallback; moving page-title mapping to a pure helper; and removing the unused `refreshData` prop from `MainDashboard`.
- No dead-code files were deleted because the available reference evidence was not strong enough to prove deletion safety.
- Protected accounting, save/edit, persistence, Firestore, and Golden Baseline surfaces were not changed.
- Verification matched the unchanged-app baseline: typecheck PASS; Balance Engine contract + production build PASS; tests remained exactly `550 passed / 11 pre-existing failures` with no new failures.
- Main JavaScript bundle decreased from `1,433,712` to `1,339,297` bytes (`-94,415`, about `6.6%`). The pre-existing `>500 KB` chunk warning remains open and was not a Phase 1 acceptance target.
- Primary implementation evidence: GitHub PR #7.

## Latest production change — Home Gold Summary Alignment

The Operational Home gold card no longer maintains an independent gold-ownership calculation.

Current approved behavior:

- Home gold summary consumes the same Financial Position ownership projection used for the official supporting E21 quantities.
- Home displays only Gold Assets, Gold Liabilities, and Gold Equity/Net Ownership as E21 weights.
- Gold Assets - Gold Liabilities = Gold Equity.
- Home rounds the three displayed values to two decimal places for mobile readability; the underlying projection remains unchanged.
- Treasury remains a lightweight operational cash read.
- If the Financial Position gold projection cannot be built, Home shows `—` plus a diagnostic rather than inventing a value.

Owner live Production acceptance on 2026-08-27:

- Gold Assets: `2,209.75 g E21`.
- Gold Liabilities: `100.06 g E21`.
- Gold Equity / Net Ownership: `2,109.69 g E21`.
- The values were visible on iPhone without clipping or overlap.
- These displayed values match the reviewed 2026-08-26 Financial Position quantities after display rounding from `2209.750 / 100.060 / 2109.690`.

Implementation commits:

- `04b39a40c3c845a07bb3085d8be16170efa604d5` — align Home gold card with Financial Position.
- `a9e23b0c51adc0d0ff960dde8d333d2cc94ca194` — improve Home gold card readability.

Final Production asset: `/assets/index-D4l93UvJ.js`.

Detailed record:
- `docs/HOME_GOLD_SUMMARY_ALIGNMENT_PRODUCTION_RELEASE_2026-08-27.md`
- Decision: `docs/DECISIONS.md` D-020.

## Validation and safety

Gold-source alignment validation:

- Focused Home / Financial Position / UI tests: `11/11 PASS`.
- Typecheck: PASS.
- Balance Engine contract guard: PASS.
- Production build: PASS.
- `git diff --check`: PASS.
- The known `financialPositionCentralBalances.test.ts` sign failure remained pre-existing and unchanged.

Readability follow-up validation:

- Focused Home/UI: `3/3 PASS`.
- Typecheck: PASS.
- Balance Engine contract guard: PASS.
- Production build: PASS.
- `git diff --check`: PASS.

Deployment evidence:

- Firebase Hosting only.
- Production root: HTTP 200.
- Final Production asset: HTTP 200.
- Local / Production asset SHA-256 matched.

This release did **not** change:

- Posting Matrix.
- Inventory WAC semantics / legacy precedence.
- COGS semantics.
- Balance Engine semantics.
- Entry save contract/schema.
- Firestore Production data or historical entries.
- Historical overlay directives or approved economic values.
- Firestore Rules / Indexes / Functions / Storage / Auth configuration.
- Golden Baseline.

## Manual / visual acceptance rule

Codex may perform code work, automated tests, build and technical deployment verification. Final Visual / UX / operational acceptance on Firebase Production belongs to the owner. ChatGPT may guide and verify screenshots/exports. A task is not Closed until owner acceptance when applicable and GitHub + Notion + Google Drive are synchronized and directly verified by ChatGPT.

## Protected accounting/data invariants

Do not change these without a separate explicit owner decision and approval:

- Posting Matrix.
- WAC / COGS.
- Balance Engine semantics.
- Entry save contract/schema outside an explicitly approved scope.
- Historical Firestore records.
- Firestore Rules / Indexes / Functions / Storage / Auth.
- Golden Baseline.

## Recent production sequence

Detailed history belongs in individual release records. Important recent releases include:

- Financial Position + Equity correction — application commit `1a97d66da6d4475f704e025cfcb1ef940e0cf48e`.
- E21 / WAC / Al-Safi consistency — application commit `f66cc5678df8b54a00809705a9ff54b2b030f061`.
- Story Compact Fit + Story-only Buy Spread — application commit `1be587d3aa22196e9d1d544459693e5a69ddfd5b`.
- Financial Position baseline release — application commit `b304f1205fe92fea49f1de209b9a180233761a73`.
- Operational Home original release — application commit `5086600f740b86277f635fa2f4113470ee4b7669`; its original independent Home gold calculation was superseded by the 2026-08-27 Home Gold Summary Alignment release.

## Known open items

- Pre-existing accounting/Golden test failures remain separate follow-up work. Do not regenerate or alter the Golden Baseline merely to clear them.
- Completion of the full historical 2116-row migration/reconciliation is not proven by current documentation.
- Historical `arabicWeight` migration/backfill remains **not approved** and requires a separate Critical migration safety review, dry run, rollback design and explicit owner approval.
- Legacy Planning/Grill trackers are not evidence of current Production state.
- Further performance/dead-code cleanup beyond Phase 1 remains separate work; Phase 1 deleted no files because dead-code evidence was insufficient.
- JavaScript chunk-size warnings above 500KB remain a separate performance item and were not cleared by Phase 1.

## Source roles and closure

- GitHub: execution truth for code, tests, deployment implementation and technical state.
- Notion: workflow, approved decisions, task status and change history.
- Google Drive: accounting, operational, architecture and reviewer-facing references.
- `Makka — Current Reviewer Context` must stay short and point to detailed records.
- Uploaded copies are snapshots only; live GitHub/Notion/Drive sources win when they differ.
- Production release closure requires the accepted Production state and the affected GitHub + Notion + Google Drive references to be directly re-read and found consistent.
