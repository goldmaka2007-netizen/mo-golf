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
- Phase 3 remains the offline acceptance proof that Registry-approved identity does not change Ledger, Unified Trial Balance, or EGP Financial Statement outputs; the interactive runtime does not recalculate that full evidence chain on every refresh.
- Approved runtime flow: `Trial Balance UI → Central read-only runtime adapter → historical Shadow compatibility copies for referenced inactive accounts → Central Registry-gated exact Shadow + complete parity identity → temporary Registry-normalized Entries → existing buildUnifiedTrialBalance`.
- The Trial Balance UI no longer directly invokes `buildUnifiedTrialBalance`; the existing engine remains the sole calculation engine behind the Central runtime adapter.
- Runtime execution requires Central Shadow `status=compared`, non-null parity, and `exactParity=true`. Missing or contradictory identity or incomplete parity fails closed.
- The independent review proved that passing all accounts directly to Shadow was insufficient because `buildAccountRegistry` excludes inactive source accounts from normal definitions while their IDs are still considered known.
- The accepted correction deliberately does **not** change the shared Registry contract. Only inactive accounts whose stable IDs are referenced by Entries inside the current report cutoff receive temporary in-memory Shadow-only copies with `isActive=true` so their stored historical metadata can be classified.
- Original account objects remain inactive and unchanged. The final Trial Balance calculation still receives only the original active accounts, preserving pre-PR visibility and balance semantics.
- Final independent acceptance: historical inactive-account compatibility PASS; Shadow exact parity PASS; source Account/Entry immutability PASS; final Trial Balance equals pre-PR semantics PASS; no inactive presentation leakage; focused `52/52 PASS` across 8 files; TypeScript, Balance Contract, build and `git diff --check` PASS; full suite `608 PASS / 13 FAIL` with the same pre-existing failure set.
- The runtime adapter calls Central Shadow and then the requested Unified Trial Balance only; it does not recalculate the full Phase 3 Ledger + Trial Balance + Financial Statements evidence chain on each refresh.
- General Ledger and EGP Financial Statements are not switched by Phase 4A; each requires focused runtime verification before widening the read-only migration.
- No protected accounting/data surface changed. No Firebase/Firestore write occurred. No Production runtime activation or deployment occurred.

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

Central Registry Phases 1–4A changed none of these protected surfaces and made no Production Firestore data write.

## Current next gate

- Phase 4A is merged and verified but not deployed.
- Remaining read-only runtime consumers are General Ledger and EGP Financial Statements before the final EntryForm/write-path Cutover.
- Each remaining consumer requires its own focused verification and owner-approved workflow gate.
- EntryForm/write-path Cutover remains last and requires a separate explicit approval gate.
- Deployment remains separate from merge and is not implied.

## Other current notes

- Pre-existing accounting/Golden test failures remain separate follow-up work; never regenerate Golden merely to clear them.
- Historical `arabicWeight` migration/backfill remains not approved.
- Legacy planning/grill trackers marked Historical are not evidence of Production state.
- Current Production behavior remains on deployed application commit `5241d44d3251a515a81ec6004fb6ae8447a64956`.

## Primary references

- `docs/DECISIONS.md` — active decisions D-021 through D-024.
- `docs/adr/ADR-010-central-accounting-registry.md`.
- `docs/adr/ADR-011-central-accounting-shadow-orchestration.md`.
- `docs/adr/ADR-012-central-read-only-output-evidence.md`.
- `docs/adr/ADR-013-central-read-only-runtime-trial-balance.md`.

## Source roles and closure

- GitHub: current code, tests, implementation, and technical truth.
- Notion: mandatory workflow, approved decisions/status, and change history.
- Google Drive: accounting/operational/architecture references and `Makka — Current Reviewer Context`.
- A phase is not Closed until GitHub + Notion + Google Drive are synchronized and directly re-read by ChatGPT.
