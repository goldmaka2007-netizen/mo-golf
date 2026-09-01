# ADR-013 — Central Read-Only Runtime Wiring: Unified Trial Balance First

Status: Approved for Phase 4A implementation on 2026-09-01. Not deployed.

## Context

Phase 1 established the Central Accounting Registry. Phase 2 established Registry-gated Central Shadow parity. Phase 3 independently proved that Registry-approved temporary operation identity can traverse the existing Ledger/financial projection, Unified Trial Balance, and EGP Financial Statement engines without changing their outputs.

The next architectural step is to begin using the proven Central boundary in an actual application read path. Switching every report at once would unnecessarily widen risk and make rollback/diagnosis harder. Re-running the entire Phase 3 evidence chain on every UI refresh would also recalculate Ledger, Trial Balance, and Financial Statements unnecessarily and is not appropriate for an interactive runtime path.

Independent Phase 4A review found one historical compatibility gap: `buildAccountRegistry` intentionally builds normal canonical definitions from active accounts only, but historical Entries may still reference a source account that has since become inactive. Passing all source accounts to Shadow was therefore insufficient because the inactive account ID was known to the source list but had no canonical definition.

## Decision

The Unified Trial Balance is the first approved read-only runtime consumer of the Central Accounting path.

Phase 3 remains the offline acceptance proof that downstream outputs are unchanged. The interactive runtime path uses the lighter Registry-gated exact Shadow identity boundary already proven in Phase 2, then invokes only the requested existing Trial Balance engine.

Approved runtime flow:

`Trial Balance UI → Central read-only runtime adapter → historical Shadow compatibility copies for referenced inactive accounts → Central Registry-gated exact Shadow + complete parity identity → temporary Registry-normalized Entry copies → existing buildUnifiedTrialBalance`

Rules:

1. Phase 3 remains the required architectural acceptance evidence before this runtime wiring is approved; it is not recalculated in full on every UI refresh.
2. The runtime adapter must begin with `buildCentralAccountingShadowReport`, which itself begins at the Central Accounting Registry.
3. Runtime execution is allowed only when Central Shadow is `compared`, has parity, and `exactParity=true`.
4. Runtime operation identity comes only from complete Central Shadow parity. Stored `Entry.operationKind` is not a fallback authority.
5. Parity row-count mismatch or missing canonical parity identity blocks runtime execution.
6. Source Entry rows remain unchanged; normalization is temporary and in-memory only.
7. A source account with `isActive=false` is eligible for a temporary Shadow-only compatibility copy only when its stable account ID is actually referenced by an Entry inside the current runtime cutoff. That temporary copy sets `isActive=true` only for Registry/Shadow classification so the stored historical account metadata can be resolved.
8. The original source account object remains `isActive=false`; the compatibility copy is never persisted and never passed to the final Trial Balance presentation engine.
9. The existing `buildUnifiedTrialBalance` engine remains the sole Trial Balance calculation engine and receives only the original active accounts, preserving prior report visibility semantics.
10. The Trial Balance UI must not fall back to its previous direct legacy-entry runtime path when the Central gate blocks. It displays a clear blocked state instead.
11. Date-range behavior remains the existing Trial Balance behavior; entries after the selected end date are excluded before the Central runtime gate.
12. Phase 4A does not change the shared `buildAccountRegistry` contract, EntryForm, save/edit contracts, Production writer, Posting Matrix, Inventory WAC/COGS, Merchant Metal WAC, Balance Engine semantics, Golden Baseline, Firestore Production data, or Firebase backend resources.
13. Phase 4A does not authorize deployment. Production activation remains a separate approval gate.
14. Other read-only consumers such as General Ledger and EGP Financial Statements remain outside this first runtime wiring step and require their own focused verification before being switched.

## Why Trial Balance first

The Unified Trial Balance is already a read-only consumer of centralized balance/projection logic and has a clear balance contract. It has no save path and no user action that writes accounting data. This makes it the lowest-risk place to prove the runtime adapter pattern before widening Central runtime consumption.

Keeping Phase 3 as offline acceptance evidence avoids recalculating unrelated Ledger and Financial Statement outputs on every Trial Balance UI refresh while preserving the same Registry/Shadow identity authority at runtime.

The inactive-account compatibility correction is deliberately local to Phase 4A instead of changing the shared Registry contract. This keeps the verified Phase 1–3 behavior stable while allowing historical Entries to remain readable through their stable account IDs.

## Failure behavior

If Central Shadow is blocked, non-exact, or has incomplete parity identity:

- Trial Balance runtime returns `blocked`;
- no Trial Balance report is produced through the Central runtime adapter;
- the UI does not silently invoke the old direct path;
- no data is modified.

## Verification contract

Phase 4A verification must demonstrate:

- a covered row with missing stored `operationKind` reaches Trial Balance only through Registry-approved temporary identity;
- contradictory or unknown operation identity fails closed;
- source Entries are unchanged;
- a historical Entry referencing an inactive account by stable ID reaches exact Shadow parity without mutating or reactivating the source account;
- the final Trial Balance remains semantically identical to the pre-PR direct calculation using active presentation accounts and does not display the inactive account merely because Shadow needed it for historical classification;
- inactive accounts not referenced by the current runtime Entries are not promoted into Shadow compatibility copies;
- the Trial Balance UI imports and invokes the Central runtime adapter and no longer calls `buildUnifiedTrialBalance` directly;
- the runtime adapter begins at Central Shadow/Registry and does not invoke the full Phase 3 Ledger + Trial Balance + Financial Statements evidence chain on each refresh;
- the adapter contains no Firebase persistence, React/UI, EntryForm, RAW_DATA/CATS/OPERATION_RULES authority, Posting Matrix, or WAC/COGS implementation;
- existing Phase 1–3 focused regressions still pass;
- TypeScript, Balance Contract, build, and diff checks pass;
- any full-suite failures remain classified against the accepted baseline and Golden Baseline is not modified.

## Consequences

A successful Phase 4A proves one real read-only application consumer can use the Central path safely without adding the Phase 3 full-evidence calculation cost to each UI refresh. It also preserves historical readability for referenced inactive accounts without changing their persisted active state or report visibility. It does not complete read-only migration for every report and does not authorize the EntryForm/write Cutover. General Ledger and Financial Statements can be wired later using the same proven pattern after focused acceptance.
