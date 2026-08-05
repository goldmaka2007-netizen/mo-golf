# ADR-005 — Central Runtime Inventory Account Resolution

**Status:** Active  
**Date:** 2026-08-04

## Problem

Invoice posting accepted live Firestore inventory account IDs while a save-time WAC validation path called the strict cost engine directly. The engine expected stable/versioned cost identities, so a valid production Silver Band account failed with `unknown_inventory_account`.

## Context

Production inventory accounts have runtime document IDs. The cost engine uses stable taxonomy for strict and deterministic WAC. Background recalculation already had compatibility behavior, but invoice validation and other consumers did not all enter through the same path.

## Decision

Use one canonical runtime cost-timeline entry point for invoice validation, inventory settlement, background recalculation, WAC, Book Value, COGS, and report consumers.

On the reviewed head this is:

- `rebuildRuntimeInventoryCostTimeline` in `src/lib/costRecalculation.ts`

The path:

1. Resolves verified runtime IDs to stable cost identities in memory.
2. Runs the strict cost engine.
3. Restores runtime IDs in results so reports join to the live account master.
4. Rejects unknown or conflicting accounts.

The low-level `rebuildInventoryCostTimeline` must not be called directly from UI/invoice validation with unresolved production IDs.

## Alternatives rejected

- Add a one-off exception for the reported account ID.
- Relax the strict engine to accept arbitrary inventory IDs.
- Rewrite Firestore account IDs.
- Maintain separate resolver logic for invoice save and background recalculation.

## Consequences

The centralized resolver is now a high-value contract. New supported inventory accounts and audited clones must be covered by the resolver audit and transaction regressions.

## Implementation landmarks

- `src/lib/costRecalculation.ts`
- `src/lib/runtimeCostAccountResolver.ts`
- `src/lib/inventoryCostCatalog.ts`
- `src/lib/inventoryCostEngine.ts`
- `src/lib/__tests__/inventoryAccountResolution.regression.test.ts` or its current equivalent

## Regression protection

- Cover every active supported inventory ID emitted by invoice mappings.
- Prove purchase/sale paths for gold, silver, and accessories.
- Prove COGS, Book Value, Ledger, Trial Balance, and statements share the resolved timeline.
- Prove a random invalid ID still fails with `unknown_inventory_account`.
