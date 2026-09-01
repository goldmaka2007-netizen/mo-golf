# ADR-015 — Central Read-Only Runtime Wiring: EGP Financial Reporting

Status: Approved for Phase 4C implementation on 2026-09-01. Not deployed.

## Context

Phases 4A and 4B proved that the Unified Trial Balance and General Ledger can consume Registry-approved temporary operation identity through the Central read-only runtime without changing their existing calculation semantics. The remaining EGP financial-reporting read paths still invoked their engines directly from React:

- `EgpIncomeStatementView` called `buildFinancialStatementsEgp` directly.
- `EgpBalanceSheetView` called `buildMonthlyFinancialPosition` directly for both display and CSV export.
- `EquityStatementView` called `buildEquityStatementEgp` and `computeAccountBalances` directly.
- `FinancialStatementsView` is only a two-tab wrapper around the Income Statement and Financial Position views, so centralizing those child views also centralizes the comprehensive financial-statements surface.

Phase 3 already independently proved that Registry-approved operation identity preserves downstream EGP Financial Statement outputs. The owner additionally approved on 2026-09-01 that the separate Statement of Changes in Equity must be included in the same Phase 4C so the read-only accounting migration is not declared complete while a material accounting report still bypasses the Central runtime.

Phase 4C changes orchestration only. It does not change approved financial-reporting engines or accounting rules.

## Decision

The EGP Income Statement, monthly EGP Financial Position, and EGP Statement of Changes in Equity become the final Phase 4 read-only runtime consumers of the Central Accounting identity boundary.

Approved Income Statement flow:

`Income Statement UI → Central read-only runtime adapter → relevant cutoff Entries → historical inactive-account Shadow compatibility copies → exact Registry-gated Shadow → complete Registry-approved temporary Entry identity → existing buildFinancialStatementsEgp`

Approved Financial Position flow:

`Financial Position UI/export → Central read-only runtime adapter → Entries on/before selected cutoff → historical inactive-account Shadow compatibility copies → exact Registry-gated Shadow → complete Registry-approved temporary Entry identity → existing buildMonthlyFinancialPosition`

Approved Equity Statement flow:

`Equity Statement UI → Central read-only runtime adapter → Entries on/before selected cutoff → historical inactive-account Shadow compatibility copies → exact Registry-gated Shadow → complete Registry-approved temporary Entry identity → existing buildEquityStatementEgp + existing Balance Engine diagnostic`

Rules:

1. `buildFinancialStatementsEgp`, `buildMonthlyFinancialPosition`, `buildEquityStatementEgp`, and Balance Engine calculation semantics remain unchanged by Phase 4C.
2. All three runtime adapters use the shared `buildCentralRuntimeIdentity` boundary already used by Trial Balance and General Ledger.
3. Stored `Entry.operationKind` is never fallback authority. Complete exact Central Shadow identity is mandatory.
4. Referenced inactive historical accounts may be temporarily activated only on in-memory Shadow copies. Original Account objects remain inactive and unchanged.
5. Income Statement Shadow excludes rows after the requested income end date. Earlier rows remain available for historical/cost context.
6. Financial Position and Equity Statement Shadow include only rows on/before the selected cutoff, matching their existing cutoff contracts. A later invalid operation must not block an earlier valid report.
7. Existing Cost Timeline behavior remains authoritative. An existing `available=false` cost diagnostic is not converted into a Central identity blocker; it remains the existing engine diagnostic state.
8. Financial Position CSV export must use the same Central runtime adapter. Export may not bypass Central identity by calling `buildMonthlyFinancialPosition` directly from React.
9. `EquityStatementView` may not directly invoke `buildEquityStatementEgp` or `computeAccountBalances`; both sit behind the Central runtime boundary.
10. If Central identity is blocked, the UI shows a clear blocked state and does not invoke the previous direct engine path.
11. `FinancialStatementsView` remains a presentation-only wrapper. No duplicate accounting calculation is added there.
12. Phase 4C does not change EntryForm, save/edit contracts, Production writer, Posting Matrix, Inventory WAC/COGS, Merchant Metal WAC, Balance Engine semantics, Financial Statement or Equity accounting semantics, shared `accountRegistry`, historical Firestore data, Firebase backend resources, or Golden Baseline.
13. Phase 4C does not authorize deployment.
14. Phase 4C is not complete until independent verification confirms Income Statement, Financial Position, Equity Statement, Phase 4A Trial Balance, and Phase 4B General Ledger behavior on the exact branch HEAD.

## Cutoff behavior

The Central identity gate evaluates only rows that can affect the requested report:

- Income Statement: rows after `incomeEndDate` are excluded before Shadow.
- Monthly Financial Position: rows after `cutoffDate` are excluded before Shadow.
- Equity Statement: rows after `cutoffDate` are excluded before Shadow.

This prevents an unrelated later unknown/invalid operation from blocking an earlier report while preserving the existing engines' period and cutoff semantics.

## Failure behavior

If Central Shadow is blocked, non-exact, or has incomplete parity identity:

- runtime status is `blocked`;
- no affected Financial Position, Income Statement, or Equity result is returned;
- React does not call the old direct engine path;
- Financial Position CSV export does not bypass the Central gate;
- source Account and Entry objects remain unchanged;
- no data is written.

Existing invalid Cost Timeline or Equity reconciliation diagnostics remain engine-level unavailable states after Central identity has succeeded.

## Verification contract

Independent Phase 4C acceptance must demonstrate:

- Registry-covered rows with missing stored `operationKind` produce the same EGP reporting semantics as the pre-wiring engines;
- contradictory, unknown, blank, or whitespace operation identity fails closed;
- complete parity identity is mandatory and source objects remain immutable;
- historical inactive accounts remain Shadow-only compatibility copies;
- later irrelevant rows are excluded before each relevant report cutoff;
- selected-period Income Statement output matches the previous direct engine;
- monthly Financial Position output matches the previous direct engine at the same cutoff;
- Equity Statement output and its Balance Engine diagnostic match the previous direct path at the same cutoff;
- Financial Position CSV uses an already Central-approved monthly result and has no direct engine bypass;
- Income, Financial Position, Equity, and the comprehensive two-tab Financial Statements surface have no direct accounting-engine fallback in React;
- Phase 4A Trial Balance and Phase 4B General Ledger regressions remain clean;
- TypeScript, Balance Contract, build and diff checks pass;
- full-suite failures remain classified against the accepted baseline and Golden Baseline is not modified.

## Consequences

A successful Phase 4C completes the approved read-only accounting-report migration to the Central runtime identity boundary: Trial Balance, General Ledger, Income Statement, Financial Position, and Statement of Changes in Equity all require exact Registry-approved temporary identity before their existing report engines execute. It does not authorize or implement EntryForm/write Cutover and does not deploy any Central runtime change to Production.
