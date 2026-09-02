# Current Project State

Last reviewed: 2026-09-02

## Production baseline

- Repository: `goldmaka2007-netizen/mo-golf`.
- Production: `https://makka-central-accounting.web.app`.
- Firebase project: `makka-central-accounting`.
- Current deployed application commit: `5241d44d3251a515a81ec6004fb6ae8447a64956`.
- Central Accounting Phases 1–5B are merged in repository source but are **NOT DEPLOYED**.

## Central Accounting — current checkpoint

- Phase 1 — Central Accounting Registry: `IMPLEMENTATION COMPLETE / VERIFIED / MERGED / NOT DEPLOYED`.
- Phase 2 — Central Accounting Shadow: `IMPLEMENTATION COMPLETE / VERIFIED / MERGED / NOT DEPLOYED`.
- Phase 3 — Central Read-Only Output Evidence: `IMPLEMENTATION COMPLETE / VERIFIED / MERGED / NOT DEPLOYED`.
- Phase 4A — Unified Trial Balance Central runtime: `IMPLEMENTATION COMPLETE / VERIFIED / MERGED / NOT DEPLOYED`.
- Phase 4B — General Ledger Central runtime: `IMPLEMENTATION COMPLETE / VERIFIED / MERGED / NOT DEPLOYED`.
- Phase 4C — EGP Financial Reporting Central runtime: `IMPLEMENTATION COMPLETE / VERIFIED / MERGED / NOT DEPLOYED`.
- Phase 5A — Central Write Contract / Cutover Preflight: `IMPLEMENTATION COMPLETE / VERIFIED / MERGED / NOT DEPLOYED`.
- Phase 5B — Central Write Cutover: `IMPLEMENTATION COMPLETE / VERIFIED / MERGED / NOT DEPLOYED`.
- Production Readiness: `VERIFIED / READY FOR OWNER DEPLOYMENT DECISION / NOT DEPLOYED`.

## Phase 5B — final verified state

- PR: `#28`.
- Verified pre-merge HEAD: `caacd43b3d18bb76daa4b448b3168d0a764ed097`.
- Base: `73fb9003a20cc452e548760c878222406ffdf605`.
- Squash merge: `8148286b837f2622f3336f0f74eac5d20007e916`.
- Detailed acceptance record: `docs/PHASE_5B_CENTRAL_WRITE_CUTOVER_2026-09-02.md`.

Phase 5B establishes `src/lib/centralAccountingWriteService.ts` as the single runtime accounting Entry write boundary for current Entry create, correction/update, and inventory-check settlement paths.

Final approved behavior:

- Saved accounting Entries have no hard-delete runtime path.
- Corrections require an explicit reason and complete Central revalidation, with atomic audit metadata.
- Stable Operation ID / Firestore document identity provides idempotent retry; conflicting same-ID authoritative payloads fail closed.
- Invoice-number uniqueness is enforced centrally.
- Legacy generic `تسوية` remains historical/transition compatibility only and is not writable for new operations.
- Inventory checks system-generate `تسوية عجز` / `تسوية زيادة` from the actual difference.
- Legacy Settings Entry deletion, historical renumbering, and direct CSV Entry import are fail-closed.
- Historical Entries remain readable; new Central/audit metadata is optional; no backfill or historical rewrite occurred.
- Permanent architecture tests protect the single-writer boundary, including aliased document refs and transaction/batch aliases.

Final independent acceptance reported no new Phase 5B regression versus exact base `main`. TypeScript, Balance Contract, build and diff checks passed. Protected Posting Matrix, WAC/COGS, Balance Engine, Firebase backend, historical data and Golden Baseline semantics/data were unchanged.

## 2026 Open Year decision

Owner decision on 2026-09-02: 2026 remains an open operating year. Year-Close / closed-period authority and 2027 transition work are deferred until end-of-year work and are **not** prerequisites for Production Readiness or Production activation of the already-approved Central Accounting Phases 1–5B during 2026.

This decision adds no new accounting logic, date-boundary rule, migration, or backend/data change. Historical 2026 corrections continue to use the existing Phase 5B correction controls: explicit reason, complete Central revalidation, and audit metadata. Reports for still-open 2026 periods remain live/dynamic rather than permanently closed snapshots.

Decision record: `docs/adr/ADR-017-2026-open-year-year-close-deferred.md`.

## Production Readiness — verified

Readiness record: `docs/CENTRAL_ACCOUNTING_PRODUCTION_READINESS_2026-09-02.md`.

The independently verified Phase 5B pre-merge HEAD and its squash merge have the exact same Git tree (`41dece646a20ab172018b099bff6a0a0003be2da`). From that merge through the Open Year decision sync, only documentation files changed. Therefore current application/test source is identical to the accepted Phase 5B source, and the existing accepted test evidence remains applicable without repeating the same heavy test run.

Result: Central Accounting Phases 1–5B are **PRODUCTION READY** under the approved 2026 open-year policy.

This does not authorize deployment. Production deployment remains a separate explicit owner approval.

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

## Current next work

The next gate is the owner's explicit **Production Deployment approval**.

Until that approval is given, Production stays on deployed application commit `5241d44d3251a515a81ec6004fb6ae8447a64956` and no Central Accounting deployment occurs.

If approved, deployment scope is Firebase Hosting only unless the owner explicitly authorizes otherwise, followed by safe root/asset verification and non-destructive acceptance. No synthetic accounting operation should be created on Production solely for testing.

Year-Close remains deferred future work and must pass its own workflow and approval gate when the owner chooses to start it.

## Source roles and closure

- GitHub: current code, tests, implementation, and technical truth.
- Notion: mandatory workflow, approved decisions/status, and change history.
- Google Drive: accounting/operational/architecture references and `Makka — Current Reviewer Context`.
- A phase is not Closed until GitHub + Notion + Google Drive are synchronized and directly re-read by ChatGPT.
