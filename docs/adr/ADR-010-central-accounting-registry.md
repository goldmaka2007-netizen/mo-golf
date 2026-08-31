# ADR-010 — Central Accounting Registry as the Target Single Accounting Authority

**Status:** Active  
**Date:** 2026-08-31

## Problem

Makka already has a centralized accounting pipeline, but account identity/classification, operation availability, legacy rule lookup, form behavior, and compatibility logic still live across several implementation surfaces. That distribution makes maintenance harder and creates a long-term risk that UI/report code can become a second source of accounting truth.

## Decision

Makka will converge on one **Central Accounting Registry** as the target runtime authority for accounting definitions.

The registry owns or exposes, through one read boundary:

- stable canonical account identity and structured account metadata;
- versioned canonical operation identity;
- abstract account roles used by operations;
- operation field requirements;
- operation-level accounting invariants/test contracts;
- coverage state for legacy account/operation mapping;
- readiness gates for Shadow Mode and eventual Cutover.

The registry is a logical single source of truth. It does not need to be one physical file. Internal modules may remain focused as long as consumers go through the central domain boundary instead of maintaining independent accounting rules.

## Phase 1 — Read-only foundation

The first implementation phase is deliberately read-only.

- `src/lib/canonicalOperationCatalog.ts` defines versioned operation identity and coarse approved invariants.
- `src/lib/centralAccountingRegistry.ts` composes the existing canonical account registry with the operation catalog and produces Coverage/Readiness reports.
- The Phase 1 registry does **not** replace or activate EntryForm save behavior, Posting Matrix, WAC/COGS, Balance Engine, Ledger, or financial statements.
- No Firestore write, migration, historical rewrite, Firebase backend change, or deployment is part of Phase 1.
- Existing Production behavior remains authoritative until a separately approved Cutover phase.

## Operation identity and versioning

Every approved business operation has a stable operation ID independent from its Arabic display label. Operation definitions are versioned. A material future rule change creates a new version rather than silently changing the meaning of historical operations.

Current visible operations are mapped explicitly. Historical operation labels remain readable for compatibility but are not automatically promoted to new runtime operations.

Owner decision on 2026-08-31: `مرتجع ذهب` and `مرتجع فضة` are legacy-only and are therefore marked `historical_only` in the canonical operation catalog.

## Legacy compatibility

Legacy rules and historical labels are compatibility inputs only during the transition.

- New central runtime modules must not import `RAW_DATA`, `CATS`, or `OPERATION_RULES` as decision authority.
- Compatibility tests may read legacy constants to prove that every existing label has an explicit canonical mapping.
- Unknown operations fail closed; there is no silent legacy fallback in the central registry.
- Historical Firestore rows remain unchanged.

After Cutover, legacy logic is read/history compatibility only and cannot create new accounting operations.

## Readiness gates

### Shadow-ready

Shadow analysis may proceed only when:

- the operation catalog is internally valid;
- every used operation label maps unambiguously;
- canonical account aliases are not ambiguous;
- no account classification conflict is present.

### Cutover-ready

Cutover requires all Shadow gates plus:

- all historical-only/discovered accounts that need mapping are resolved;
- all active canonical account definitions are explicitly approved;
- no transition-only operation remains in the new-write path;
- reconciliation and Shadow Mode parity are accepted under the Makka Change Workflow;
- explicit owner approval is obtained before changing the write path.

## Architecture guard

The Central Accounting Registry runtime boundary must remain independent from React/UI, Firebase persistence, and legacy constants. Focused regression tests enforce this boundary.

Existing hardcoded/legacy consumers are migrated incrementally. Phase 1 does not perform a broad deletion/refactor merely to make the architecture look clean.

## Protected behavior

This ADR does not change:

- Posting Matrix semantics;
- Inventory WAC / COGS;
- Merchant Metal WAC;
- Balance Engine semantics;
- Entry save/edit contract;
- Golden Baseline;
- Production Firestore records;
- Firebase Rules, Indexes, Functions, Storage, or Authentication.

Any later phase that changes one of those surfaces requires the normal protected-surface approval gate.

## Consequences

- Account/operation additions can eventually be defined once and consumed by Entry Form, Posting, Ledger, Trial Balance, financial statements, and reports.
- Duplicated name-based and UI-side accounting rules can be removed gradually after parity is proven.
- Cutover is intentionally harder than Shadow activation; incomplete mapping cannot be hidden behind a fallback.
- The migration remains reversible before Cutover because Phase 1 writes no Production accounting data.

## Verification

Phase 1 regression coverage must prove at minimum:

1. canonical operation IDs and aliases are unique and versioned;
2. current/legacy operation labels have explicit mappings;
3. legacy returns remain historical-only;
4. unknown operations fail closed;
5. historical account gaps block Cutover;
6. unapproved canonical accounts block Cutover;
7. Central Registry source files contain no Firebase/React/legacy-constant dependency.
