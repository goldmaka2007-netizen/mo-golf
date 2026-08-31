# ADR-011 — Central Registry-Gated Shadow Accounting

**Status:** Active  
**Date:** 2026-08-31  
**Extends:** ADR-010

## Problem

Makka already contains read-only shadow/parity helpers and a `canonical_preview` accounting-engine mode. After ADR-010 / Central Accounting Registry Phase 1, those older helpers can still be called with lower-level account or mapping inputs directly.

If a new Shadow Mode path bypasses the Central Accounting Registry, Makka would recreate multiple accounting-definition authorities instead of converging on one logical source of truth.

## Decision

All newly approved Central Accounting Shadow orchestration must begin at the Central Accounting Registry boundary.

The Phase 2 flow is:

`Central Accounting Registry → Shadow readiness gate → existing read-only parity engine → comparison report`

The Registry is the mandatory preflight authority for operation coverage and account-definition safety. The existing parity engine remains a calculation helper; it is not promoted to a separate accounting-definition authority.

## Fail-closed behavior

No parity comparison is exposed when Registry Shadow readiness is false.

Blocking conditions include, at minimum:

- invalid canonical operation catalog;
- unmapped operation labels, including blank/whitespace labels;
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
- change Firebase Rules, Indexes, Functions, Storage, or Authentication;
- modify or regenerate Golden Baseline;
- deploy or activate live Production Shadow execution by itself.

Production remains on the existing authoritative write path until a later separately approved Cutover.

## Compatibility

Existing low-level shadow/parity helpers may remain for historical tests and compatibility. They are implementation helpers, not approved entrypoints for new Shadow orchestration.

They should not be broadly deleted or refactored merely for architectural neatness; migration away from direct callers must be evidence-led and incremental.

## Verification

Phase 2 regression coverage must prove:

1. a covered operation can pass Central Registry preflight and reach parity comparison;
2. unknown operations fail closed before parity;
3. blank/whitespace operation labels fail closed before parity;
4. Shadow orchestration does not mutate source entries;
5. the new orchestration boundary has no React/UI, Firebase persistence, or legacy decision-constant dependency;
6. protected accounting/data surfaces remain unchanged.

Repository-level verification is required before merge. Live Production Shadow activation or deployment is a later workflow gate, not implied by merging this read-only foundation.
