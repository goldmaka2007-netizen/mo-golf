# ADR-012 — Central Read-Only Output Evidence Boundary

Status: Approved for Phase 3 implementation on 2026-09-01. Not deployed.

## Context

Phase 1 established the read-only Central Accounting Registry. Phase 2 established the read-only Central Shadow orchestration boundary so operation identity must pass through the Registry before parity analysis.

The next unresolved architectural risk is downstream: existing Ledger/financial projection, Trial Balance, and Financial Statement engines can still be invoked directly with stored Entry rows. They already contain substantial approved accounting behavior and must not be rewritten merely to centralize orchestration.

The project therefore needs evidence that Registry-approved operation identity can flow through the existing downstream reporting chain without changing its results.

## Decision

Add one read-only output-evidence boundary above the existing downstream engines.

Approved evidence flow:

`Central Accounting Registry → Central Shadow gate → temporary Registry-approved operation identity copies → existing Ledger/financial projection → existing Unified Trial Balance → existing EGP Financial Statements`

Rules:

1. Phase 3 does not activate a Production runtime path and does not change any writer.
2. Downstream evidence is evaluated only when Phase 2 Shadow is unblocked and exact.
3. Registry-approved operation identity is taken exclusively from the already-built Shadow parity result. Phase 3 must not introduce another operation resolver or fallback authority.
4. Shadow parity identity must be complete before downstream evaluation: parity row count must equal Entry count and every Entry must have a corresponding Registry-approved operation kind. Missing parity identity fails closed with `shadow_parity_incomplete`; stored `Entry.operationKind` is never used as fallback authority.
5. Source Entry rows remain unchanged. Only temporary in-memory copies may receive the approved operation kind.
6. The existing Ledger/financial projection, Unified Trial Balance, and EGP Financial Statement engines are reused as-is.
7. The same source inputs are run through both the untouched-entry path and temporary normalized-entry path. Projection, Trial Balance, and Financial Statements must match exactly.
8. Any mismatch is evidence of a downstream dependency on legacy operation interpretation and fails closed for review. It is not auto-corrected by Phase 3.
9. Phase 3 does not modify EntryForm, Entry save/edit contracts, Posting Matrix, Inventory WAC/COGS, Merchant Metal WAC, Balance Engine semantics, Trial Balance or Financial Statement accounting rules, Golden Baseline, Firestore data, or Firebase backend resources.
10. Deployment, live Shadow activation, read-only Production wiring, Cutover, or write-path changes remain separate approval gates.

## Why this approach

Rewriting existing reports would increase accounting risk and create another broad refactor. The current reporting engines already contain tested behavior. A small evidence boundary proves whether central operation identity can traverse those engines unchanged before any runtime consumer is switched.

This keeps Phase 3 diagnostic and reversible while directly advancing the single-source-of-truth architecture.

## Failure behavior

The evidence report is blocked when Central Shadow is blocked, not exact, or does not contain one complete Registry-approved operation identity per source Entry.

After an exact and complete Shadow pass, any mismatch in:

- Ledger/financial projection,
- Unified Trial Balance, or
- EGP Financial Statements

returns a fail-closed mismatch status with the affected output layer identified.

Phase 3 never falls back to stored Entry operation identity, never mutates persisted data, and never auto-corrects a downstream mismatch.

## Verification contract

Phase 3 verification must demonstrate:

- exact Shadow is required before downstream evaluation;
- unknown or contradictory operation identity blocks before output evaluation;
- incomplete or missing Shadow parity identity blocks before output evaluation and cannot fall back to `Entry.operationKind`;
- source entries remain byte-for-byte equivalent after the read-only run;
- projection output is unchanged by Registry-approved temporary normalization;
- Unified Trial Balance output is unchanged;
- EGP Financial Statements output is unchanged;
- the new boundary contains no React/UI dependency, Firebase persistence, EntryForm dependency, or legacy RAW_DATA/CATS/OPERATION_RULES authority;
- focused tests, TypeScript, Balance Contract, build, and diff checks pass;
- full-suite results introduce no new regression relative to the accepted repository baseline.

## Consequences

A successful Phase 3 proves downstream read-only compatibility but does not make Central Shadow live in Production. The next step may wire an explicitly approved read-only runtime consumer through the proven boundary. The EntryForm/write path remains last and requires a separate Cutover approval.
