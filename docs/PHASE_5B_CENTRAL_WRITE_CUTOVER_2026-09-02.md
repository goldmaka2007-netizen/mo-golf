# Phase 5B — Central Write Cutover

Date: 2026-09-02

Status: `IMPLEMENTATION COMPLETE / VERIFIED / MERGED / NOT DEPLOYED`

## Source identity

- Pull Request: `#28`
- Verified pre-merge HEAD: `caacd43b3d18bb76daa4b448b3168d0a764ed097`
- Base: `73fb9003a20cc452e548760c878222406ffdf605`
- Squash merge commit: `8148286b837f2622f3336f0f74eac5d20007e916`
- Verified merged tree matches reviewed HEAD tree: YES
- Production deployed application remains: `5241d44d3251a515a81ec6004fb6ae8447a64956`

## Final architecture

Phase 5B routes current runtime accounting Entry writes through `src/lib/centralAccountingWriteService.ts` as the single accounting Entry write boundary.

Covered runtime paths:

- EntryForm create.
- Posted Entry correction/update.
- Inventory-check settlement.

Approved behavior:

- Saved accounting Entries are not hard deleted.
- Corrections require an explicit reason and are fully revalidated through the Central write contract.
- Correction metadata/audit is committed atomically with the update.
- New drafts use a stable Operation ID and Firestore document identity for idempotent retry.
- Same Operation ID with a conflicting authoritative payload, including stable debit/credit account IDs, fails closed.
- Invoice-number uniqueness is enforced inside Central preflight.
- Legacy generic `تسوية` remains historical/transition compatibility only and is not writable for new runtime operations.
- Inventory checks system-generate `تسوية عجز` or `تسوية زيادة` from the actual difference.
- Legacy Settings tools that could delete Entries, renumber historical Entries, or directly import Entries are fail-closed.
- Historical Entry metadata additions are optional; no backfill or historical rewrite occurred.
- Permanent architecture tests protect the single-writer boundary, including aliased Entry refs and transaction/batch mutation aliases.

## Independent acceptance

Final independent acceptance on verified HEAD `caacd43b3d18bb76daa4b448b3168d0a764ed097`:

- Clean temporary clone: YES.
- Existing workspace modified: NO.
- Focused acceptance: 13 files / 129 tests; 128 passed / 1 failed. The sole failure was the known `costRecalculationPhase5` baseline failure and matched exact `main`.
- Additional inventory/COGS safety: 5 files / 145 tests; 145/145 PASS.
- TypeScript: PASS.
- Balance Contract: PASS.
- Build: PASS.
- `git diff --check`: PASS.
- Full suite on Phase 5B HEAD: 83 passed files / 11 failed files; 668 passed tests / 13 failed tests; 3 known fixture/import suite errors.
- Full suite on exact base `main`: 81 passed files / 11 failed files; 638 passed tests / 13 failed tests; 3 known fixture/import suite errors.
- Failure names: SAME.
- New Phase 5B regression: NO.

## Protected surfaces

Phase 5B did not change:

- Posting Matrix semantics.
- Inventory WAC / COGS semantics.
- Merchant Metal WAC semantics.
- Balance Engine semantics.
- Financial-reporting calculation engines.
- Historical Firestore data.
- Golden Baseline.
- Firebase Rules / Indexes / Functions / Storage / Auth.

No Production deployment occurred.

## Mandatory next gate

Year-Close / closed-period authority is intentionally NOT implemented in Phase 5B.

Therefore:

`Production Write Cutover / deployment = BLOCKED pending a separately approved and verified Year-Close authority.`

Merge of Phase 5B does not authorize deployment.
