# ADR-011 — Central Registry-Gated Shadow Accounting

**Status:** Active  
**Date:** 2026-08-31  
**Extends:** ADR-010

## Problem

Makka already contains read-only shadow/parity helpers and a `canonical_preview` accounting-engine mode. After ADR-010 / Central Accounting Registry Phase 1, those older helpers can still be called with lower-level account or mapping inputs directly.

If a new Shadow Mode path bypasses the Central Accounting Registry, Makka would recreate multiple accounting-definition authorities instead of converging on one logical source of truth.

A second risk exists when a historical/runtime row carries both a visible transaction label (`tx`) and a stored `operationKind`, or when an older row omits `operationKind`. Lower-level legacy/parity helpers can derive an operation kind that differs from the Central Registry identity while still agreeing with each other, producing misleading exact-parity evidence.

## Decision

All newly approved Central Accounting Shadow orchestration must begin at the Central Accounting Registry boundary.

The Phase 2 flow is:

`Central Accounting Registry → Shadow readiness + operation-identity consistency gate → Registry-normalized parity copy → existing read-only parity engine → comparison report`

The Registry is the mandatory preflight authority for operation coverage, operation identity, and account-definition safety. The existing parity engine remains a calculation helper; it is not promoted to a separate accounting-definition authority.

When `operationKind` is present on a source row, it must match the operation kind resolved by the Central Accounting Registry from `tx` before parity is exposed. A mismatch fails closed.

Absence of `operationKind` alone does not block a covered historical row. After preflight succeeds, Shadow builds temporary read-only copies of all compared rows and sets their comparison-only `operationKind` from the Central Accounting Registry identity. The source entries remain unchanged. Lower-level legacy fallback is therefore not an operation-identity authority for an approved Central Shadow comparison.

## Fail-closed behavior

No parity comparison is exposed when Registry Shadow readiness is false or stored operation identity is internally inconsistent.

Blocking conditions include, at minimum:

- invalid canonical operation catalog;
- unmapped operation labels, including blank/whitespace labels;
- stored `operationKind` contradicting the operation identity resolved by the Central Accounting Registry from `tx`;
- ambiguous account aliases;
- account classification conflicts.

A blocked Shadow run returns coverage/blocker evidence and no parity result.

## Phase 2 scope

Phase 2 adds read-only orchestration and regression coverage only.

It does **not**:

- change EntryForm or save/edit behavior;
- activate canonical posting as the Production writer;
- change Posting Matrix semantics;
- change Inventory WAC / COGS;
- change Merchant Metal WAC;
- change Balance Engine semantics;
- write to Firestore or rewrite historical rows;
- backfill or persist missing `operationKind` values;
- change Firebase Rules, Indexes, Functions, Storage, or Authentication;
- modify or regenerate Golden Baseline;
- deploy or activate live Production Shadow execution by itself.

Production remains on the existing authoritative write path until a later separately approved Cutover.

## Compatibility

Existing low-level shadow/parity helpers may remain for historical tests and compatibility. They are implementation helpers, not approved entrypoints for new Shadow orchestration.

They should not be broadly deleted or refactored merely for architectural neatness; migration away from direct callers must be evidence-led and incremental.

Historical rows without a stored `operationKind` remain readable and are not rewritten. For approved Central Shadow comparison only, their temporary parity copies use the operation kind resolved by the Central Accounting Registry. When a stored kind exists, contradictory identity is evidence that the row cannot safely participate in parity until the inconsistency is understood.

Historical-only operation availability remains historical-only. Registry-normalizing a parity copy does not promote that operation into the new-write path.

## Verification

Phase 2 regression coverage must prove:

1. a covered operation can pass Central Registry preflight and reach parity comparison;
2. unknown operations fail closed before parity;
3. blank/whitespace operation labels fail closed before parity;
4. stored `operationKind` that contradicts the Central Registry identity fails closed before parity;
5. absence of `operationKind` does not block a covered row and the temporary parity copy uses the Registry operation kind;
6. the known fallback-conflict cases (`دفع لعميل`, `مرتجع ذهب`, `مرتجع فضة`) use Registry identity during parity without mutating source rows;
7. a single identity mismatch blocks the whole Shadow run;
8. Shadow orchestration does not mutate source entries;
9. the new orchestration boundary has no React/UI, Firebase persistence, or legacy decision-constant dependency;
10. protected accounting/data surfaces remain unchanged.

Repository-level verification is required before merge. A full missing-`operationKind` catalog audit must show zero unexplained Registry-vs-parity identity mismatches. Live Production Shadow activation or deployment is a later workflow gate, not implied by merging this read-only foundation.
