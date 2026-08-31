# ADR-013 — Central Read-Only Runtime Wiring: Unified Trial Balance First

Status: Approved for Phase 4A implementation on 2026-09-01. Not deployed.

## Context

Phase 1 established the Central Accounting Registry. Phase 2 established Registry-gated Central Shadow parity. Phase 3 proved that Registry-approved temporary operation identity can traverse the existing Ledger/financial projection, Unified Trial Balance, and EGP Financial Statement engines without changing their outputs.

The next architectural step is to begin using the proven Central boundary in an actual application read path. Switching every report at once would unnecessarily widen risk and make rollback/diagnosis harder.

## Decision

The Unified Trial Balance is the first approved read-only runtime consumer of the Central Accounting path.

Approved runtime flow:

`Trial Balance UI → Central read-only runtime adapter → Phase 3 output evidence → exact Central Shadow + complete parity identity → temporary Registry-normalized Entry copies → existing buildUnifiedTrialBalance`

Rules:

1. The runtime adapter must call the accepted Phase 3 evidence boundary first.
2. Runtime execution is allowed only when Phase 3 evidence returns `matched` with exact comparison.
3. Runtime operation identity comes only from complete Central Shadow parity. Stored `Entry.operationKind` is not a fallback authority.
4. Parity row-count mismatch or missing canonical parity identity blocks runtime execution.
5. Source Entry rows remain unchanged; normalization is temporary and in-memory only.
6. The existing `buildUnifiedTrialBalance` engine remains the sole Trial Balance calculation engine. No accounting logic is reimplemented in React/UI code.
7. The Trial Balance UI must not fall back to its previous direct legacy-entry runtime path when the Central gate blocks. It displays a clear blocked state instead.
8. Date-range behavior remains the existing Trial Balance behavior; entries after the selected end date are excluded before the Central runtime gate.
9. Phase 4A does not change EntryForm, save/edit contracts, Production writer, Posting Matrix, Inventory WAC/COGS, Merchant Metal WAC, Balance Engine semantics, Golden Baseline, Firestore Production data, or Firebase backend resources.
10. Phase 4A does not authorize deployment. Production activation remains a separate approval gate.
11. Other read-only consumers such as General Ledger and EGP Financial Statements remain outside this first runtime wiring step and require their own focused verification before being switched.

## Why Trial Balance first

The Unified Trial Balance is already a read-only consumer of centralized balance/projection logic and has a clear balance contract. It has no save path and no user action that writes accounting data. This makes it the lowest-risk place to prove the runtime adapter pattern before widening Central runtime consumption.

## Failure behavior

If Central evidence is blocked, mismatched, incomplete, or otherwise not exact:

- Trial Balance runtime returns `blocked`;
- no Trial Balance report is produced through the Central runtime adapter;
- the UI does not silently invoke the old direct path;
- no data is modified.

## Verification contract

Phase 4A verification must demonstrate:

- a covered row with missing stored `operationKind` reaches Trial Balance only through Registry-approved temporary identity;
- contradictory or unknown operation identity fails closed;
- source Entries are unchanged;
- the Trial Balance UI imports and invokes the Central runtime adapter and no longer calls `buildUnifiedTrialBalance` directly;
- the adapter contains no Firebase persistence, React/UI, EntryForm, RAW_DATA/CATS/OPERATION_RULES authority, Posting Matrix, or WAC/COGS implementation;
- existing Phase 1–3 focused regressions still pass;
- TypeScript, Balance Contract, build, and diff checks pass;
- any full-suite failures remain classified against the accepted baseline and Golden Baseline is not modified.

## Consequences

A successful Phase 4A proves one real read-only application consumer can use the Central path safely. It does not complete read-only migration for every report and does not authorize the EntryForm/write Cutover. General Ledger and Financial Statements can be wired later using the same proven pattern after focused acceptance.
