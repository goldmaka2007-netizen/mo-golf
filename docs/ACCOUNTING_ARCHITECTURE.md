# Accounting Architecture

**Purpose:** define the central flow and prevent duplicate or incompatible accounting logic.

## 1. Canonical flow

```text
Opening Entries + Invoices
        ↓
Entry identity / stable account resolution
        ↓
Posting Matrix / central projection
        ↓
Runtime inventory account resolution
        ↓
Inventory Cost Timeline (WAC)
        ↓
Projected multi-dimensional ledger legs
        ↓
General Ledger
        ↓
Unified Trial Balance
        ↓
EGP Income Statement + Statement of Financial Position
        ↓
Supporting metal / quantity / ownership reports
```

This diagram describes responsibility, not necessarily a single synchronous call stack. Verify current function boundaries before editing.

## 2. Source-of-truth boundaries

### User/business source

Opening entries and invoices are the primary business records. Derived Ledger, Trial Balance, COGS, Book Value, and statements must be reproducible from approved inputs and compatibility configuration.

### Identity and account classification

Resolve accounts by stable IDs and structured metadata. Critical classifications must not depend only on display names.

Relevant implementation landmarks include:

- `src/lib/entryIdentity.ts`
- `src/lib/accountRegistry.ts`
- `src/lib/runtimeCostAccountResolver.ts`
- `src/lib/inventoryCostCatalog.ts`

### Posting/projection

Posting creates balanced legs for the applicable independent dimensions. Do not make a report infer the missing side of a transaction independently.

Relevant landmarks include:

- `src/lib/postingMatrix.ts`
- `src/lib/legacyLedger.ts`

### Cost/WAC

The canonical runtime entry point is currently:

- `rebuildRuntimeInventoryCostTimeline` in `src/lib/costRecalculation.ts`

It resolves verified runtime inventory accounts, runs the strict cost engine, then restores runtime IDs for downstream joins.

The strict low-level engine is:

- `src/lib/inventoryCostEngine.ts`

Do not call it directly from invoice UI/validation or another path that can receive production runtime account IDs without first passing through the approved resolver.

Merchant gold liabilities use a separate in-memory WAC timeline. It maintains E21 quantity and EGP carrying value independently from Inventory WAC. Transfers between merchants carry the source liability WAC unchanged; physical settlement compares the released liability value with the independently released Inventory WAC value.

### Ledger and Trial Balance

Projected legs carry dimensions such as:

- `cash`
- `gold`
- `silver`
- `quantity`
- `book_value`

`src/lib/unifiedTrialBalance.ts` currently declares its report source as `central_posting_projection` and combines EGP financial dimensions while reporting quantity dimensions separately.

### Official statements

`src/lib/financialStatementsEgp.ts` builds official EGP statements. Inventory enters the Statement of Financial Position through Book Value, not current market value. Supporting weight/quantity may be shown beside accounts but is not added to EGP totals.

## 3. Dimension contract

| Dimension | Meaning | Typical accounts | Official statement treatment |
|---|---|---|---|
| EGP cash/accounting | Monetary debit/credit amount | Treasury, customers, payables, revenue, expenses | Included in EGP reporting according to account nature |
| Gold | Equivalent 21 supporting quantity | Gold inventory and gold-related balances | Supporting quantity only |
| Silver | Silver weight | Silver inventory and related balances | Supporting quantity only |
| Quantity | Accessories count/quantity | Accessories inventory | Supporting quantity only |
| Book Value EGP | Cost basis of inventory and cost-derived legs | Inventory, COGS, related balancing legs | Included in official EGP statements |

Never sum weight or quantity into monetary totals.

## 4. Core posting expectations

### Sale

A supported sale produces, once:

- Cash or Customer debit as applicable.
- Sales revenue credit.
- COGS debit from WAC.
- Inventory Book Value credit.
- Quantity/weight reduction in the correct dimension.

### Purchase

A supported purchase produces:

- Inventory quantity/weight increase.
- Inventory Book Value increase at approved cost.
- Cash reduction or payable increase as applicable.
- Merchant workmanship is separated as required by the approved posting policy and capitalized only once when applicable.

### Transfer / conversion

A pure inventory transfer preserves total approved quantity and Book Value unless a separately approved gain/loss event exists. It must not manufacture revenue or COGS.

A merchant-to-merchant metal transfer is not an inventory transfer: it preserves total merchant carrying value algebraically across signed payable/receivable positions, does not move physical inventory, and does not create profit or loss. Gold and silver use independent carrying-value pools.

### Merchant metal settlement

Physical settlement releases the current merchant payable or receivable at its own Merchant Metal WAC and moves physical inventory at Inventory WAC. Crossing zero closes the old side and establishes the excess on the new side at the immutable operation basis. The difference is realized immediately in the metal-specific settlement gain/loss account. Gold and silver never share WAC state; cash/workmanship settlement with Treasury remains cash-only.

### Inventory increase / shortage

- Increase: Inventory debit and approved adjustment account credit in Book Value, with matching quantity increase.
- Shortage: Approved adjustment account debit and Inventory credit in Book Value, with matching quantity decrease.

### Delete/edit

Changing or deleting a source operation must rebuild all affected downstream cost and report results from the earliest affected operation. Do not leave orphaned derived effects.

## 5. Historical compatibility

Historical records remain unchanged. Compatibility may use:

- Stable/runtime ID mapping.
- Structured account metadata.
- Approved historical inventory overlays.
- Opening cost configuration.

Compatibility must remain fail-closed for unknown or conflicting inventory identities. Do not broaden classification rules merely to accept one invalid record.

## 6. Anti-patterns

Do not:

- Recalculate balances in React report components.
- Derive COGS from sale price.
- Use current metal price as WAC.
- Match critical accounts by Arabic/English name alone.
- Call strict WAC directly with unresolved runtime IDs.
- Merge EGP with grams or count.
- Fix a balance by inserting unexplained suspense legs.
- update Golden Baseline to hide a regression.
- edit Firestore historical records to fit a new implementation.

## 7. Required regression shape

A meaningful accounting regression should normally prove:

1. The exact reported input is accepted or rejected for the correct reason.
2. Posting contains the expected legs exactly once.
3. WAC/COGS and remaining inventory state are correct.
4. Ledger and Trial Balance consume the same resolved identity and cost timeline.
5. Official statements balance.
6. A genuinely unknown or conflicting account still fails closed.
