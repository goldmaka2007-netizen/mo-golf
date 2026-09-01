# ADR-014 — Central Read-Only Runtime Wiring: General Ledger

Status: Approved for Phase 4B implementation on 2026-09-01. Not deployed.

## Context

Phase 4A proved the Unified Trial Balance can run as a real read-only application consumer behind the Registry-gated Central Shadow without changing report semantics. The General Ledger is the next read-only consumer.

Before Phase 4B, `GeneralLedgerView` built account selection from the existing account registry but invoked `getAvailableDimensions`, `computePeriodAccountBalances`, and `buildLedgerReport` directly from React for the selected account. It also built multiple dimension reports and all-time summary reports independently.

## Decision

General Ledger details must enter through the existing Central read-only runtime boundary.

Approved flow:

`General Ledger UI → Central read-only runtime adapter → historical Shadow compatibility copies for referenced inactive accounts → exact Registry-gated Shadow → complete Registry-approved temporary Entry identity → existing dimension discovery + Balance Engine period balances + existing buildLedgerReport`

Rules:

1. Account selection remains the existing read-only registry-driven presentation. Phase 4B changes the Ledger calculation path, not account-tree UX.
2. The runtime adapter performs one Central Shadow identity gate for the Ledger bundle, not one Shadow run per dimension.
3. Runtime execution requires exact compared Shadow parity and complete canonical operation identity for every Entry.
4. Stored `Entry.operationKind` is never fallback runtime authority.
5. Historical inactive source accounts referenced by the report input are resolved only through temporary in-memory Shadow copies. Original accounts remain inactive and unchanged.
6. The existing report-account presentation set is preserved. Temporary historical Shadow copies must not reappear as selectable/active Ledger accounts.
7. Existing `getAvailableDimensions`, `computePeriodAccountBalances`, and `buildLedgerReport` remain the calculation authorities. No Ledger accounting rule is reimplemented in React or the Central adapter.
8. Period and all-time summary reports share the same Registry-approved temporary Entry identity.
9. The UI excludes Entries after the later of the selected report end date and the existing all-time summary cutoff before Central Shadow. Irrelevant later Entries must not block an earlier report.
10. If Central Shadow or parity identity is blocked/incomplete, no Ledger report bundle is produced and the UI must not silently invoke the previous direct path.
11. Phase 4B does not change EntryForm, save/edit contracts, Production writer, Posting Matrix, Inventory WAC/COGS, Merchant Metal WAC, Balance Engine semantics, Ledger calculation semantics, Financial Statement semantics, shared Account Registry contract, Golden Baseline, Firestore Production data, or Firebase backend resources.
12. Phase 4B does not authorize deployment.

## Performance

The successful runtime path performs one Central Shadow run, one dimension discovery, one period Balance Engine calculation, one all-time-summary Balance Engine calculation, and then the same existing Ledger report builds already required by the UI. It removes the previous duplicate selected-dimension report build because the selected report is read from the already-built dimension bundle.

## Failure behavior

If Central Shadow is blocked/non-exact or parity identity is incomplete:

- runtime status is `blocked`;
- dimensions and Ledger report arrays are empty;
- the UI shows a clear blocked state;
- there is no legacy/direct Ledger fallback;
- no source Account or Entry is modified.

## Verification contract

Phase 4B acceptance must demonstrate:

- missing stored `operationKind` reaches Ledger only through Registry-approved temporary identity;
- contradictory, unknown, blank, and whitespace operation identity fails closed before Ledger calculation;
- historical inactive counterparties resolve in Shadow without being reactivated in Ledger presentation;
- source Account/Entry immutability;
- period Ledger dimensions, balances, rows, operation labels, counterparties, and all-time summary semantics match the pre-wiring direct calculation;
- report end-date / summary cutoff behavior is preserved;
- GeneralLedgerView no longer directly invokes `buildLedgerReport`, `getAvailableDimensions`, or `computePeriodAccountBalances`;
- runtime does not invoke the full Phase 3 evidence chain or Financial Statements;
- focused Phase 1–4A regressions, TypeScript, Balance Contract, build, and diff checks pass;
- any full-suite failures remain classified against the accepted baseline and Golden Baseline is not modified.

## Consequences

After Phase 4B, Unified Trial Balance and General Ledger are the two real Central read-only runtime consumers. EGP Financial Statements remain the final read-only consumer before any EntryForm/write-path Cutover work can be proposed.
