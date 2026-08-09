# ADR-007 — Signed Merchant Metal Positions and Carrying Value

**Status:** Active
**Date:** 2026-08-09
**Supersedes:** ADR-006

## Problem

The former merchant-gold projection assumed a non-negative liability. A merchant could economically cross through zero into a metal receivable while retaining a liability-classified carrying value. Silver had no equivalent central signed carrying-value model, and report-side static account classification could place a negative merchant position on the wrong Balance Sheet side.

## Decision

- Derive one signed position per merchant and metal. Gold uses E21; silver uses physical grams. Positive is a payable, negative is a receivable, and exact zero carries no unexplained value.
- Maintain independent payable and receivable carrying-value/WAC pools for gold and silver. These pools are also independent of Inventory WAC and merchant cash/workmanship.
- Value a newly created side from the immutable operation basis. A normal saved operation price is authoritative; an opening uses the matching Settings opening cost.
- On physical settlement, release the old merchant side at its carrying WAC and inventory at Inventory WAC. Recognize the legitimate difference immediately in the metal-specific settlement gain/loss account. If the operation crosses zero, establish only the excess on the new side at the operation basis.
- Transfer signed positions algebraically at source carrying value. Transfers may cross zero, move no inventory, create no P&L, and preserve the identical total value from source to destination.
- Classify each merchant/metal independently in official reports: receivable on the asset side and payable on the liability side. Never net different merchants or infer the side solely from static account type.
- Historical price repair is limited to genuinely missing accounting prices on eligible non-opening operations. It uses the exact-date official Gold21 or Silver999 reference, never overwrites a valid saved price, and has no previous-day fallback.
- Preserve Firestore account identity. Runtime classification may route a historically misclassified merchant through the general merchant engine.

## Consequences

General Ledger, Trial Balance, Income Statement, Statement of Financial Position, and merchant-facing projections consume the same central signed carrying-value timeline. Existing operation prices remain authoritative. Silver settlement differences use silver-specific accounts instead of gold accounts.

## Implementation landmarks

- `src/lib/merchantGoldLiability.ts` — compatible export plus the generic signed merchant-metal timeline.
- `src/lib/engine.ts` — central gold/silver merchant operation semantics.
- `src/lib/inventoryCostEngine.ts` — independent inventory movement and immutable operation basis.
- `src/lib/legacyLedger.ts` — central Book Value and settlement gain/loss legs.
- `src/lib/financialStatementsEgp.ts` and `src/lib/unifiedTrialBalance.ts` — economic sign classification.
- `scripts/backfill-missing-merchant-metal-prices.ts` — guarded, idempotent, dry-run-first repair.

## Regression protection

Protect positive and negative zero-crossings, carrying-value-conserving transfers, gold/silver independence, exact-zero cleanup, opening Settings prices, completed merchant cycles, receivable reclassification, and Balance Sheet balance.
