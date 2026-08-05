# ADR-003 — WAC Inventory Valuation and Automatic COGS

**Status:** Active  
**Date:** 2026-08-03

## Problem

Inventory cannot be valued reliably from current market price or sale price. Manually creating a second COGS invoice risks duplicate cost and inconsistent remaining inventory.

## Context

Gold, silver, and accessories require quantity tracking plus an EGP Book Value. Historical purchases, opening balances, workmanship policy, transfers, and sales affect the cost pool.

## Decision

- Weighted Average Cost (WAC) is the approved inventory valuation method.
- Inventory Book Value and sale COGS come from the approved cost timeline.
- A sale automatically posts revenue and COGS once.
- Current market price is not inventory cost.
- A user does not create a separate COGS invoice.

## Alternatives rejected

- Sale-price-derived COGS.
- Current-price inventory valuation inside official statements.
- Manual second transaction for COGS.
- Report-specific reconstructed average cost.

## Consequences

Every inventory-affecting edit/delete may require recalculation from the earliest affected operation. Cost diagnostics must fail closed when inputs cannot be valued safely.

## Implementation landmarks

- `src/lib/inventoryCostEngine.ts`
- `src/lib/costRecalculation.ts`
- `src/lib/historicalInventoryOverlay.ts`
- `src/lib/openingCostConfig.ts`

## Regression protection

Protect purchase/sale/transfer/delete paths, remaining quantity, remaining total cost, COGS exactly once, Golden Dataset prerequisites, and balance contracts.
