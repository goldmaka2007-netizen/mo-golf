# ADR-016 — Central Write Contract and Cutover Preflight

Status: Approved for Phase 5A implementation on 2026-09-01. Verified in repository source. Not wired to a Production writer. Not deployed.

## Context

Phases 1–4C centralized accounting identity and all approved read-only accounting consumers behind the Central Accounting Registry and exact Shadow boundary. The remaining architectural stage is the write path. That stage is materially higher risk because it can affect persisted Entries and therefore remains protected by a separate owner approval gate.

The owner approved Phase 5A only: build and verify a pure in-memory Central write contract / Cutover preflight without changing the current EntryForm/App save path, Firestore persistence, Entry schema, Posting Matrix, WAC/COGS, Balance Engine semantics, historical data, Firebase backend resources, Golden Baseline, or Production deployment.

Phase 5A is therefore an acceptance boundary, not a Cutover. It must tell the truth about whether the current Registry and candidate Entry are ready for a future Central writer and must fail closed when they are not.

## Decision

Add a pure `buildCentralAccountingWritePreflight` contract that performs no persistence and is not called by the current writer.

Approved preflight flow:

`Candidate Entry + current Entries + Accounts + Opening Cost Config → Central Registry / Cutover readiness → Central operation identity → stable account identity → existing accounting/numbering/gold-equivalent/quantity/posting/cost validators → prepared in-memory Entry or blockers`

Rules:

1. The preflight is pure and performs no Firebase/Firestore, React, store, or legacy operation-constant write action.
2. The Central Registry is the only operation-identity authority. Unknown, ambiguous, blank/unsupported, or contradictory operation identity fails closed; legacy operation rules are not fallback authority.
3. Global `coverage.cutoverReady` is mandatory. If the Registry is not Cutover-ready, the preflight returns `registry_not_cutover_ready` even if an individual candidate could otherwise validate.
4. Account resolution uses stable source account IDs as authority. Unknown, ambiguous, inactive, historical-only, or accounts without a stable source ID are not writable.
5. Prepared Entries receive Central `operationKind`, `debitAccountId`, and `creditAccountId` only on an in-memory copy. The submitted/source Entry object is not mutated.
6. Existing submitted account display labels are preserved. A later account rename must not silently rewrite historical Entry labels during an unrelated update; stable IDs remain the identity authority.
7. Write source is explicit: `user`, `setup`, or `system`.
   - `user` may write only current-runtime operations that are user-selectable.
   - `setup` may write only approved setup-only operations that are user-selectable in setup context.
   - `system` may write only current-runtime operations marked system-generated.
8. Existing Posting Matrix, accounting policy, numbering policy, gold-equivalent audit, accessory quantity-step validation, and runtime inventory Cost Timeline remain the validation authorities; Phase 5A only orchestrates them behind the Central boundary.
9. Create preflight fails on an existing candidate ID. Update preflight requires exactly one existing Entry with the candidate ID.
10. Update Cost Timeline validation replaces that one existing row in memory rather than appending a duplicate candidate.
11. Phase 5A does not change or activate delete behavior. The current hard-delete path is a separate unresolved Phase 5B/Cutover policy decision because the locked Central architecture requires explicit correction/audit semantics and no approved Central delete contract exists yet.
12. Phase 5A does not wire EntryForm/App save/edit, change Firestore persistence, change Entry schema, modify accounting semantics, or authorize deployment.

## Current readiness truth

The default current Registry remains **not Cutover-ready** because the transition-only legacy operation `inventory.adjustment.legacy` is still selectable/writable in the current catalog. Phase 5A intentionally preserves that fail-closed result rather than masking it in tests.

Focused tests may use an explicit Cutover-ready catalog fixture only to prove the contract behavior that would apply after all real readiness blockers are intentionally resolved.

## Failure behavior

If any mandatory gate fails:

- `ready=false`;
- one or more structured blockers are returned;
- no persistence is attempted;
- source Entry and Account objects remain unchanged;
- no legacy operation fallback is consulted;
- the existing Production writer remains untouched.

Blocker families include Registry readiness, operation identity/writability, account identity/writability, create/update identity, accounting policy, numbering, canonical posting, gold-equivalent validity, accessory quantity validity, and runtime inventory cost validity.

## Verification contract

Phase 5A acceptance must demonstrate:

- the real default Registry remains blocked while a transition-only legacy writer is still selectable;
- a Cutover-ready fixture can prepare a valid current user operation from Central operation/account identity;
- setup-only operations are separated from normal user writes;
- system-generated operations cannot be submitted through the user path;
- update cost validation replaces exactly one existing row rather than duplicating it;
- stable account IDs remain authoritative while historical labels are preserved;
- missing/non-unique update targets fail closed;
- unknown operation identity has no legacy fallback;
- contradictory stored `operationKind` fails closed;
- source candidates remain immutable;
- the contract has no Firebase, React, store, or legacy operation-constant dependency;
- focused tests, TypeScript, Balance Contract, build, diff check, and full-suite baseline complete successfully on the verified source/test head.

Verified source/test head: `02c102150404fafbf93bc9ece9d3ab24e6857817`.
GitHub Actions verification run: `33503684233` (`Phase 5A Verification`, conclusion `success`).
The temporary verification workflow is branch-only evidence infrastructure and must be removed before merge.

## Consequences

Phase 5A gives Makka a testable Central write acceptance contract without activating it. The next write-path phase must resolve remaining Cutover blockers and the explicit delete/correction policy before any Central persistence wiring is allowed. Any future wiring of this contract into EntryForm/App/Firestore remains a protected implementation scope requiring explicit owner approval and separate verification. Deployment remains a separate approval after merge.
