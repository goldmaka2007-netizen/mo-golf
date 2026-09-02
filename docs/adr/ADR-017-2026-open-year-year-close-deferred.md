# ADR-017 — 2026 Open Year; Year-Close Deferred

Status: Accepted
Date: 2026-09-02
Owner: Mohamed Yasser

## Context

Central Accounting Phases 1–5B are implemented, independently verified, merged, and not deployed. Phase 5B established the Central Accounting write boundary for current create, correction/update, and inventory-check settlement paths.

Previous current-state documentation treated a separate Year-Close / closed-period authority as a mandatory blocker before Production Write Cutover. The owner has now made an explicit superseding decision for the current operating year.

## Decision

For the remainder of 2026, Makka operates with 2026 as an open year.

- Year-Close / closed-period authority is deferred until the end-of-year transition work.
- Year-Close is not a prerequisite for Production Readiness or Production activation of the already-approved Central Accounting Phases 1–5B during 2026.
- No 2027 preparation, period-closing workflow, date-boundary guard, migration, or new accounting logic is added by this decision.
- Historical 2026 corrections remain governed by the existing Phase 5B correction path: explicit reason, full Central revalidation, and audit metadata. Saved accounting Entries still have no hard-delete runtime path.
- Reports for still-open 2026 periods remain live/dynamic rather than treated as permanently closed snapshots.
- Production deployment remains a separate explicit owner approval after Production Readiness is verified.

## Protected invariants

This decision does not change:

- Posting Matrix semantics.
- Inventory WAC / COGS.
- Merchant Metal WAC.
- Balance Engine semantics.
- Entry schema/save contract beyond the already-approved Phase 5B state.
- Historical Firestore records.
- Firestore Rules / Indexes / Functions / Storage / Auth.
- Golden Baseline.

## Consequence

The previous documentation-only Year-Close deployment blocker is superseded for the current 2026 operating year. The next gate is Production Readiness Verification on the existing Central Accounting implementation, followed by a separate explicit owner decision on deployment.

Year-Close remains deferred future work and must go through its own Makka Change Workflow and approval gate when the owner chooses to start it.
