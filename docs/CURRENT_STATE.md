# Current Project State

Last reviewed: 2026-09-02

## Production baseline

- Repository: `goldmaka2007-netizen/mo-golf`.
- Production: `https://makka-central-accounting.web.app`.
- Firebase project: `makka-central-accounting`.
- Central Accounting Phases 1–5B were deployed to Firebase Hosting only from approved application SHA `c7d7522f8a4737708f4658293176748f13607cfe`.
- Current deployed main asset after that deployment: `/assets/index-B_SQyuZ-.js`.
- Deployment verification: root/asset HTTP 200; React/Firebase/session startup passed; initial read-only smoke passed.
- No Firestore Data/Rules/Indexes/Functions/Storage/Auth change and no synthetic Production accounting transaction was created.

## Central Accounting — current checkpoint

- Phases 1–4C + 5A + 5B: `IMPLEMENTATION COMPLETE / VERIFIED / MERGED / DEPLOYED`.
- Production owner acceptance: `BLOCKED`.
- Task closure: `NOT CLOSED`.

Owner iPhone acceptance passed Home, Daily Journal, Operations, Gold Sale Entry opening, and Reports menu. Unified Trial Balance then failed closed with `central_shadow_not_exact`, so acceptance stopped before closure.

## Trial Balance Production blocker — read-only evidence

A Production read-only Evidence Pack found:

- `shadow.status = blocked`.
- `shadow.exactParity = false`.
- `coverage.shadowReady = true`.
- `operationCatalogIssues = 0`.
- `unmappedOperations = 0`.
- `ambiguousAccountAliases = 0`.
- `accountClassificationConflicts = 0`.
- Exactly 5 `operation_identity_mismatch` blockers.

All five blocking Entries are historical `دفع لعميل` rows dated 2026-06-18 through 2026-08-05. Their stored legacy `operationKind` is `transfer`, while normal Central Registry resolution is `customer.payment / other`. Shadow intentionally blocks before parity, so no parity rows are produced. Evidence attributes the conflict to historical Production data that predates the 2026-09-02 deployment, not to new data created by the deployment.

## Approved compatibility correction

Owner explicitly approved the smallest code compatibility fix. Do **not** modify or backfill the five historical Firestore rows.

The approved compatibility boundary is intentionally narrow. An identity mismatch may bypass the historical mismatch blocker only when all of the following are true:

1. `canonicalOperationId` is absent.
2. `canonicalOperationVersion` is absent.
3. stored `operationKind === 'transfer'`.
4. normal Registry resolution is successful.
5. resolved operation ID is exactly `customer.payment`.
6. resolved Registry `operationKind === 'other'`.

For that exact historical case only, Shadow may continue through the existing Registry-normalized parity-copy path without mutating the source Entry. Any centrally identified row and every other identity mismatch must remain fail-closed. No hardcoded date bypass is approved.

Target implementation scope: `src/lib/centralAccountingShadow.ts` plus focused Shadow/runtime/Trial Balance tests only, unless compilation proves a minimal adjacent change is necessary.

## Required implementation verification

Before merge, prove at minimum:

- historical `دفع لعميل` with no Central identity + stored `transfer` reaches comparison/parity without mutating source data;
- the same row with `canonicalOperationId` present remains blocked;
- the same row with `canonicalOperationVersion` present remains blocked;
- stored `sale` / `purchase` contradictions remain blocked;
- ordinary operation identity contradictions and unknown/unmapped operations remain blocked;
- focused Shadow + Central read-only runtime + Trial Balance tests pass;
- TypeScript passes;
- Balance Contract passes;
- relevant Central Accounting regression set shows no new regression.

No Golden Baseline regeneration is authorized.

## Phase 5B durable state

Phase 5B established `src/lib/centralAccountingWriteService.ts` as the single runtime accounting Entry write boundary for current Entry create, correction/update, and inventory-check settlement paths.

- Saved accounting Entries have no hard-delete runtime path.
- Corrections require an explicit reason and complete Central revalidation, with atomic audit metadata.
- Stable Operation ID / Firestore document identity provides idempotent retry; conflicting same-ID authoritative payloads fail closed.
- Invoice-number uniqueness is enforced centrally.
- Legacy generic `تسوية` remains historical/transition compatibility only and is not writable for new operations.
- Inventory checks system-generate `تسوية عجز` / `تسوية زيادة` from the actual difference.
- Historical Entries remain readable; Central/audit metadata is optional on legacy rows; no historical rewrite is implied.

Detailed Phase 5B acceptance: `docs/PHASE_5B_CENTRAL_WRITE_CUTOVER_2026-09-02.md`.
Production Readiness record: `docs/CENTRAL_ACCOUNTING_PRODUCTION_READINESS_2026-09-02.md`.

## 2026 Open Year decision

Owner decision on 2026-09-02: 2026 remains an open operating year. Year-Close / closed-period authority and 2027 transition work remain deferred until end-of-year work. This Trial Balance compatibility fix does not reopen or alter that decision.

Decision record: `docs/adr/ADR-017-2026-open-year-year-close-deferred.md`.

## Protected accounting/data invariants

Do not change without a separate explicit owner decision and approval:

- Posting Matrix.
- Inventory WAC / COGS.
- Merchant Metal WAC.
- Balance Engine semantics.
- Entry save/edit contract outside an explicitly approved scope.
- Historical Firestore records.
- Firestore Rules / Indexes / Functions / Storage / Auth.
- Golden Baseline.

## Current next work

Implement the approved narrow historical `customer.payment` Shadow compatibility fix on a clean branch from current verified `main`, run the required focused and regression checks, open a PR, and stop before merge/deploy for independent ChatGPT review.

A code fix approval does **not** authorize a new Production deployment. Any redeploy requires a separate explicit owner approval after the PR is reviewed/merged and the exact deployable SHA is verified.

After redeploy, owner mobile acceptance must resume from the Trial Balance blocker and continue through the remaining safe read-only checks. Final closure requires successful Production acceptance plus verified GitHub + Notion + Google Drive synchronization.

## Source roles and closure

- GitHub: current code, tests, implementation, and technical truth.
- Notion: mandatory workflow, approved decisions/status, and change history.
- Google Drive: accounting/operational/architecture references and `Makka — Current Reviewer Context`.
- The task is not Closed until GitHub + Notion + Google Drive are synchronized and directly re-read by ChatGPT.
