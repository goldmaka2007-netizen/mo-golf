# ADR-015 — Central Read-Only Runtime Wiring: EGP Financial Statements

Status: Approved for Phase 4C implementation on 2026-09-01. Not deployed.

## Context

Phases 4A and 4B proved that the Unified Trial Balance and General Ledger can consume Registry-approved temporary operation identity through the Central read-only runtime without changing their existing calculation semantics. The remaining EGP Financial Statement read paths still invoked their engines directly from React:

- `EgpIncomeStatementView` called `buildFinancialStatementsEgp` directly.
- `EgpBalanceSheetView` called `buildMonthlyFinancialPosition` directly for both display and CSV export.
- `FinancialStatementsView` is only a two-tab wrapper around those same Income Statement and Financial Position views, so centralizing the two child views also centralizes the comprehensive financial-statements surface.

Phase 3 already independently proved that Registry-approved operation identity preserves downstream EGP Financial Statement outputs. Phase 4C must therefore change orchestration only, not the approved financial-statement engines or accounting rules.

## Decision

EGP Income Statement and monthly EGP Financial Position become the final Phase 4 read-only runtime consumers of the Central Accounting identity boundary.

Approved Income Statement flow:

`Income Statement UI → Central read-only runtime adapter → relevant cutoff Entries → historical inactive-account Shadow compatibility copies → exact Registry-gated Shadow → complete Registry-approved temporary Entry identity → existing buildFinancialStatementsEgp`

Approved Financial Position flow:

`Financial Position UI/export → Central read-only runtime adapter → Entries on/before selected cutoff → historical inactive-account Shadow compatibility copies → exact Registry-gated Shadow → complete Registry-approved temporary Entry identity → existing buildMonthlyFinancialPosition`

Rules:

1. `buildFinancialStatementsEgp` and `buildMonthlyFinancialPosition` remain the calculation authorities and are not modified by Phase 4C.
2. Both runtime adapters use the shared `buildCentralRuntimeIdentity` boundary already used by Trial Balance and General Ledger.
3. Stored `Entry.operationKind` is never fallback authority. Complete exact Central Shadow identity is mandatory.
4. Referenced inactive historical accounts may be temporarily activated only on in-memory Shadow copies. Original Account objects remain inactive and unchanged.
5. Income Statement Shadow excludes rows after the requested income end date. Earlier rows remain available for historical/cost context.
6. Financial Position Shadow includes only rows on/before the selected cutoff, matching the existing monthly engine cutoff contract. A later invalid operation must not block an earlier valid statement.
7. Existing Cost Timeline behavior remains authoritative. An existing `available=false` cost diagnostic is not converted into a Central identity blocker; it remains the existing Financial Position diagnostic state.
8. Financial Position CSV export must use the same Central runtime adapter. Export may not bypass Central identity by calling `buildMonthlyFinancialPosition` directly from React.
9. If Central identity is blocked, the UI shows a clear blocked state and does not invoke the previous direct engine path.
10. `FinancialStatementsView` remains a presentation-only wrapper. No duplicate accounting calculation is added there.
11. Phase 4C does not change EntryForm, save/edit contracts, Production writer, Posting Matrix, Inventory WAC/COGS, Merchant Metal WAC, Balance Engine semantics, Financial Statement accounting semantics, shared `accountRegistry`, historical Firestore data, Firebase backend resources, or Golden Baseline.
12. Phase 4C does not authorize deployment.
13. The separate Equity Statement report is not rewired by this ADR. Phase 4C covers the existing EGP Income Statement and Financial Position surfaces that form the current comprehensive Financial Statements wrapper. Any later Equity runtime change must be separately grounded if required.

## Cutoff behavior

The Central identity gate should evaluate only rows that can affect the requested statement:

- Income Statement: rows after `incomeEndDate` are excluded before Shadow.
- Monthly Financial Position: rows after `cutoffDate` are excluded before Shadow.

This prevents an unrelated later unknown/invalid operation from blocking an earlier statement while preserving the existing engine's period and cutoff semantics.

## Failure behavior

If Central Shadow is blocked, non-exact, or has incomplete parity identity:

- runtime status is `blocked`;
- no Financial Statement result is returned;
- React does not call the old direct engine path;
- CSV export does not bypass the Central gate;
- source Account and Entry objects remain unchanged;
- no data is written.

An existing invalid Cost Timeline returned by `buildMonthlyFinancialPosition` remains an engine-level `available=false` diagnostic after Central identity has succeeded.

## Verification contract

Independent Phase 4C acceptance must demonstrate:

- Registry-covered rows with missing stored `operationKind` produce the same EGP statement semantics as the pre-wiring engines;
- contradictory, unknown, blank, or whitespace operation identity fails closed;
- complete parity identity is mandatory and source objects remain immutable;
- historical inactive accounts remain Shadow-only compatibility copies;
- later irrelevant rows are excluded before the relevant statement cutoff;
- selected-period Income Statement output matches the previous direct engine;
- monthly Financial Position output matches the previous direct engine at the same cutoff;
- Financial Position CSV uses an already Central-approved monthly result and has no direct engine bypass;
- both individual report routes and the comprehensive two-tab wrapper reach the same Central-wired child views;
- Phase 4A Trial Balance and Phase 4B General Ledger regressions remain clean;
- TypeScript, Balance Contract, build and diff checks pass;
- full-suite failures remain classified against the accepted baseline and Golden Baseline is not modified.

## Consequences

A successful Phase 4C completes the currently approved EGP Financial Statement read-path migration to the Central runtime identity boundary while preserving existing statement calculations. It does not authorize or implement EntryForm/write Cutover and does not deploy any Central runtime change to Production.
