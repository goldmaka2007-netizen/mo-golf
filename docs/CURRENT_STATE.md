# Current Project State

Last reviewed: 2026-09-01

## Production baseline

- Repository: `goldmaka2007-netizen/mo-golf`.
- Production: `https://makka-central-accounting.web.app`.
- Firebase project: `makka-central-accounting`.
- Current deployed application commit: `5241d44d3251a515a81ec6004fb6ae8447a64956`.
- Latest Production release family remains Smart Sale Product Groups + Bullion/Coin Price Board.
- Central Registry / Shadow / Output Evidence work is **not deployed** and does not change current Production runtime behavior.

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
- Phase 3 does not introduce another operation resolver, report accounting rule, writer, UI path, or Firebase persistence path.
- Registry-approved operation identity comes exclusively from complete Shadow parity. Missing parity, row-count mismatch, or missing parity identity fails closed with `shadow_parity_incomplete`; `Entry.operationKind` is never a fallback authority.
- Source Entry rows remain unchanged. Existing downstream engines are reused as-is and source-vs-normalized outputs must match exactly.
- Final independent acceptance verification on the verified PR head:
  - focused tests: `44/44 PASS` across 6 files;
  - TypeScript: PASS;
  - Balance Contract: PASS;
  - build: PASS;
  - `git diff --check`: PASS;
  - full suite: `602 PASS / 13 FAIL`, with the same pre-existing failure set and 3 existing suite load errors;
  - Architecture review: PASS;
  - new Phase 3 regression: NO;
  - Firebase/Firestore writes: NO;
  - tracked verification changes: NO.
- Protected accounting/data surfaces remain unchanged.
- Phase 3 merging alone does **not** activate live Production Shadow/output execution and requires no deployment.

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

Central Registry Phases 1–3 changed none of these protected surfaces and made no Production Firestore data write.

## Current next gate

- The next architectural phase is **Phase 4: explicitly approved read-only runtime wiring** through the proven Central boundary.
- Phase 4 must not be started automatically. It requires the normal Makka Change Workflow, current Reviewer Context review, current GitHub verification, and explicit owner approval before implementation.
- EntryForm/write-path Cutover remains later and last. No writer switch, Cutover, or deployment is implied by Phases 1–3.

## Other current notes

- Pre-existing accounting/Golden test failures remain separate follow-up work; never regenerate Golden merely to clear them.
- Historical `arabicWeight` migration/backfill remains not approved.
- Legacy planning/grill trackers marked Historical are not evidence of Production state.
- Current Production behavior remains on deployed application commit `5241d44d3251a515a81ec6004fb6ae8447a64956`.

## Primary references

- `docs/DECISIONS.md` — active decisions D-021, D-022, D-023.
- `docs/adr/ADR-010-central-accounting-registry.md`.
- `docs/adr/ADR-011-central-accounting-shadow-orchestration.md`.
- `docs/adr/ADR-012-central-read-only-output-evidence.md`.
- Detailed Production release records remain in their dedicated release documents.

## Source roles and closure

- GitHub: current code, tests, implementation, and technical truth.
- Notion: mandatory workflow, approved decisions/status, and change history.
- Google Drive: accounting/operational/architecture references and `Makka — Current Reviewer Context`.
- A phase is not Closed until GitHub + Notion + Google Drive are synchronized and directly re-read by ChatGPT.
