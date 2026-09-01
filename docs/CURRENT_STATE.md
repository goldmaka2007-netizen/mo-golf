# Current Project State

Last reviewed: 2026-09-01

## Production baseline

- Repository: `goldmaka2007-netizen/mo-golf`.
- Production: `https://makka-central-accounting.web.app`.
- Firebase project: `makka-central-accounting`.
- Current deployed application commit: `5241d44d3251a515a81ec6004fb6ae8447a64956`.
- Latest Production release family remains Smart Sale Product Groups + Bullion/Coin Price Board.
- Central Registry / Shadow / Output Evidence / Runtime Wiring work is **not deployed** and does not change current Production runtime behavior.

## Central Accounting architecture — current checkpoint

### Phase 1 — Central Accounting Registry

- Status: `IMPLEMENTATION COMPLETE / VERIFIED / MERGED / NOT DEPLOYED`.
- Merge commit: `3b0980bac87931abbdbf5419dc329bd1199aa87b`.
- Decision: D-021 / ADR-010.
- Adds the read-only Central Accounting Registry, canonical operation catalog, and fail-closed Coverage/Readiness gates.
- It does not connect the new registry to EntryForm save/edit or activate a new posting writer.

### Phase 2 — Central Accounting Shadow

- Status: `IMPLEMENTATION COMPLETE / VERIFIED / MERGED / NOT DEPLOYED`.
- Merge commit: `cdb33afd776abd65c00faa7bf36a223182d97b1c`.
- Decision: D-022 / ADR-011.
- Approved read-only flow: `Central Accounting Registry → Shadow readiness gate → operation-identity consistency gate → Registry-normalized temporary parity copies → existing parity engine`.
- Unknown, blank, whitespace-only, or contradictory operation identity fails closed before parity.
- Covered historical rows with missing `operationKind` remain unchanged; only temporary parity copies receive Registry identity.
- Final focused verification: `34/34 PASS`; full catalog audit: `33` labels/aliases, `0` identity mismatches.

### Phase 3 — Central Read-Only Output Evidence

- Owner approved Phase 3 implementation on 2026-09-01.
- Original Draft PR: `#18`; replacement merge PR: `#19` because the GitHub connector could not transition the verified draft to Ready for Review.
- Verified PR head: `e3c825ea8aed299e67442215e1f083fd978e5e2f`.
- Merged to `main` as squash commit `4f8f7c00bdaa36d36fe1b9236744f3e55eaf8b4a`.
- Status: `IMPLEMENTATION COMPLETE / VERIFIED / MERGED / NOT DEPLOYED`.
- Decision: D-023 / ADR-012.
- Approved evidence flow: `Central Registry → exact Central Shadow → complete Shadow parity identity → temporary in-memory normalized Entry copies → existing Ledger/financial projection → existing Unified Trial Balance → existing EGP Financial Statements`.
- Registry-approved operation identity comes exclusively from complete Shadow parity. Missing parity, row-count mismatch, or missing parity identity fails closed with `shadow_parity_incomplete`; `Entry.operationKind` is never a fallback authority.
- Final independent acceptance: focused `44/44 PASS` across 6 files; TypeScript, Balance Contract, build and `git diff --check` PASS; full suite `602 PASS / 13 FAIL` with the same pre-existing failure set; Architecture review PASS; no Firebase/Firestore writes.

### Phase 4A — Unified Trial Balance Central read-only runtime wiring

- Owner approved Phase 4 implementation on 2026-09-01; the first focused runtime consumer is the Unified Trial Balance.
- Original Draft PR: `#20`.
- The first independent review on head `9fe90e1847cad311019443db4dd777012b1b43d9` passed all repository/test gates except historical inactive-account compatibility.
- Historical compatibility correction was independently verified on head `6e367f0dc057383fe72a5d20458d0cb6db6dfe4e`.
- Because the GitHub connector could not transition Draft PR `#20` to Ready for Review, verified replacement PR `#21` was created from that exact head and merged to `main` as squash commit `85a08e6f2756d39134fba199ba0c6c5267828227`.
- Status: `IMPLEMENTATION COMPLETE / VERIFIED / MERGED / NOT DEPLOYED`.
- Decision: D-024 / ADR-013.
- Approved runtime flow: `Trial Balance UI → Central read-only runtime adapter → historical Shadow compatibility copies for referenced inactive accounts → Central Registry-gated exact Shadow + complete parity identity → temporary Registry-normalized Entries → existing buildUnifiedTrialBalance`.
- Final independent acceptance: historical inactive-account compatibility PASS; Shadow exact parity PASS; source Account/Entry immutability PASS; final Trial Balance equals pre-PR semantics PASS; no inactive presentation leakage; focused `52/52 PASS` across 8 files; TypeScript, Balance Contract, build and `git diff --check` PASS; full suite `608 PASS / 13 FAIL` with the same pre-existing failure set.
- No protected accounting/data surface changed. No Firebase/Firestore write occurred. No Production runtime activation or deployment occurred.

### Phase 4B — General Ledger Central read-only runtime wiring

- Owner approved continuation to the General Ledger runtime consumer on 2026-09-01.
- Original Draft PR: `#22`; verified head: `c8f17ea37df1358de11508a7ed0e43b9c735bc64`.
- The first independent review passed every functional/architecture gate except one new UI routing guard that required a literal spelling. The correction changed only `src/components/views/__tests__/GeneralLedgerView.test.ts`; runtime/accounting behavior did not change.
- Final independent re-verification on the same runtime code: focused `83/83 PASS` across 10 files; TypeScript, Balance Contract, build and `git diff --check` PASS; full suite `614 PASS / 13 FAIL` with the same accepted pre-existing failure set; new Phase 4B regression NO.
- Because the GitHub connector could not transition Draft PR `#22` to Ready for Review, verified replacement PR `#23` was created from the exact verified head and merged to `main` as squash commit `82e1f372589be86e5b578f87d680ecfd3891f29c`.
- Status: `IMPLEMENTATION COMPLETE / VERIFIED / MERGED / NOT DEPLOYED`.
- Decision: D-025 / ADR-014.
- Approved runtime flow: `General Ledger UI → Central read-only runtime adapter → referenced inactive-account Shadow compatibility copies → exact Registry-gated Shadow → complete Registry-approved temporary Entry identity → existing dimension discovery + Balance Engine period balances + existing buildLedgerReport`.
- General Ledger account selection remains the existing read-only registry-driven presentation; Phase 4B changes the Ledger details calculation path only.
- One exact Shadow run supplies identity to all Ledger dimensions and the all-time summary. The UI no longer directly invokes `getAvailableDimensions`, `computePeriodAccountBalances`, or `buildLedgerReport`.
- Existing Ledger engines remain unchanged. The selected dimension is read from the already-built period bundle, removing the previous duplicate selected-dimension report build.
- Historical inactive source accounts referenced by report Entries remain temporary Shadow-only compatibility copies. Original accounts stay inactive and unchanged; final Ledger presentation uses the existing report-account set.
- Entries after the later of the selected report end date and the existing summary cutoff are excluded before Central Shadow so irrelevant later rows cannot block an earlier report.
- Contradictory, unknown, blank, whitespace, non-exact Shadow, or incomplete parity identity fails closed with no Ledger bundle and no direct UI fallback.
- Semantic parity vs origin/main, dimensions/order, period balances/rows, summary behavior, date cutoff, account selection, historical inactive compatibility, source immutability and Phase 4A Trial Balance regression all passed independent review.
- No protected accounting/data surface changed. No Firebase/Firestore write occurred. No Production runtime activation or deployment occurred.

### Phase 4C — EGP Financial Reporting Central read-only runtime wiring

- Owner approved the final read-only reporting consumers on 2026-09-01 and explicitly approved including the separate Statement of Changes in Equity in the same Phase 4C after a direct-React accounting bypass was identified during self-review.
- Working branch: `feature/central-read-only-runtime-financial-statements-phase4c`, created from `main` `45a524a73c677fdfd9e90a82cbc092c4f9f619bd`.
- Original Draft PR: `#24`; verified final head: `d0f3c4896aab2f81bb5ec632afc274b89972a046`.
- Because the GitHub connector could not transition Draft PR `#24` to Ready for Review, verified replacement PR `#25` was created from that exact head and merged to `main` as squash commit `713a86bd9f09bb61e0cdf89b669ea00d694a4c7e`.
- Status: `IMPLEMENTATION COMPLETE / VERIFIED / MERGED / NOT DEPLOYED`.
- Decision: D-026 / ADR-015.
- Scope covers the EGP Income Statement, monthly Financial Position, Financial Position CSV export, and Statement of Changes in Equity. `FinancialStatementsView` remains a presentation-only wrapper around the Income and Financial Position child views.
- Approved Income flow: `Income Statement UI → Central read-only runtime adapter → Entries on/before requested income end date → referenced inactive-account Shadow compatibility copies → exact Registry-gated Shadow → complete Registry-approved temporary Entry identity → existing buildFinancialStatementsEgp`.
- Approved Financial Position flow: `Financial Position UI/export → Central read-only runtime adapter → Entries on/before selected cutoff → referenced inactive-account Shadow compatibility copies → exact Registry-gated Shadow → complete Registry-approved temporary Entry identity → existing buildMonthlyFinancialPosition`.
- Approved Equity flow: `Equity Statement UI → Central read-only runtime adapter → Entries on/before selected cutoff → referenced inactive-account Shadow compatibility copies → exact Registry-gated Shadow → complete Registry-approved temporary Entry identity → existing buildEquityStatementEgp + existing Balance Engine diagnostic`.
- `buildFinancialStatementsEgp`, `buildMonthlyFinancialPosition`, `buildEquityStatementEgp`, Cost Timeline behavior, Balance Engine semantics, and financial-reporting accounting semantics remain unchanged.
- Financial Position CSV export uses the same Central monthly runtime boundary; React no longer directly calls the monthly Financial Position engine for export.
- Equity UI no longer directly calls `buildEquityStatementEgp` or `computeAccountBalances`; both execute behind the Central runtime boundary. The Balance Contract now verifies that routing and separately verifies that `computeAccountBalances` remains inside the Central Equity adapter.
- Existing Financial Position Cost Timeline unavailable states and Equity reconciliation diagnostics remain engine-level diagnostics after Central identity succeeds; they are not reclassified as Central identity blockers.
- Relevant later entries are excluded before Shadow so an unrelated future invalid operation cannot block an earlier Income period, Financial Position cutoff, or Equity cutoff.
- Source Account/Entry objects remain unchanged; inactive historical compatibility stays Shadow-only; no stored `Entry.operationKind` fallback was introduced.
- First independent acceptance on head `8515b5662bb5c1117a6e811f2579f3e4cfac7d1e` passed routing, identity safety, parity, cutoffs and tests, but blocked on a TypeScript union-narrowing gate and an outdated Balance Contract UI-location guard. Both were corrected without changing accounting/runtime semantics.
- Final independent re-verification on head `d0f3c4896aab2f81bb5ec632afc274b89972a046`: focused `103/103 PASS` across 13 files; TypeScript PASS; Balance Contract PASS; build PASS; `git diff --check` PASS; full suite `628 PASS / 13 FAIL` with the same accepted pre-existing failure set; new Phase 4C regression NO.
- No protected accounting/data surface changed. No Firebase/Firestore write occurred. No Golden Baseline change occurred. No Production runtime activation or deployment occurred.

## Protected accounting/data invariants

Do not change without a separate explicit owner decision and approval:

- Posting Matrix.
- Inventory WAC / COGS.
- Merchant Metal WAC.
- Balance Engine semantics.
- Entry save/edit contract or schema outside an explicitly approved scope.
- Historical Firestore records.
- Firestore Rules / Indexes / Functions / Storage / Auth.
- Golden Baseline.

Central Registry Phases 1–4C changed none of these protected surfaces and made no Production Firestore data write.

## Current next gate

- The approved read-only accounting migration is complete in repository source: Unified Trial Balance, General Ledger, Income Statement, Financial Position/CSV export, and Statement of Changes in Equity all pass through the Central Registry-gated runtime identity boundary.
- The next architectural stage is EntryForm/write-path Cutover.
- EntryForm/write-path Cutover is a protected write-path change and requires a separate explicit owner approval gate before implementation.
- Deployment remains separate from merge and has not been authorized.

## Other current notes

- Pre-existing accounting/Golden test failures remain separate follow-up work; never regenerate Golden merely to clear them.
- Historical `arabicWeight` migration/backfill remains not approved.
- Legacy planning/grill trackers marked Historical are not evidence of Production state.
- Current Production behavior remains on deployed application commit `5241d44d3251a515a81ec6004fb6ae8447a64956`.

## Primary references

- `docs/DECISIONS.md` — active decisions D-021 through D-026.
- `docs/adr/ADR-010-central-accounting-registry.md`.
- `docs/adr/ADR-011-central-accounting-shadow-orchestration.md`.
- `docs/adr/ADR-012-central-read-only-output-evidence.md`.
- `docs/adr/ADR-013-central-read-only-runtime-trial-balance.md`.
- `docs/adr/ADR-014-central-read-only-runtime-general-ledger.md`.
- `docs/adr/ADR-015-central-read-only-runtime-financial-statements.md`.

## Source roles and closure

- GitHub: current code, tests, implementation, and technical truth.
- Notion: mandatory workflow, approved decisions/status, and change history.
- Google Drive: accounting/operational/architecture references and `Makka — Current Reviewer Context`.
- A phase is not Closed until GitHub + Notion + Google Drive are synchronized and directly re-read by ChatGPT.
