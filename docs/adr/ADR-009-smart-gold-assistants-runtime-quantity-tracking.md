# ADR-009 — Smart Gold Assistants and Runtime Quantity Tracking

- Status: Accepted
- Date: 2026-08-17
- Production code: `ef01889414c924ff28921fb4c89c094746a4e98c`

## Context

Live gold sale and customer-purchase transactions need pricing assistance before the normal accounting Entry is saved. The application must preserve the existing Posting/WAC/save contracts and historical manual-entry path.

During authenticated acceptance, legacy Production metadata for the gold coin and gold bar did not contain `quantityStep`, so the generated Account Registry classified them as weight-only even though the approved business behavior is weight + quantity. Rewriting Production account documents solely to fix UI/runtime interpretation was rejected in favor of a central compatibility policy.

## Decision

### 1. Assistants are pricing/pre-fill helpers only

Smart Sale and Smart Purchase are optional pre-entry helpers. They do not create or persist accounting Entries and do not own posting rules. They hand values to the existing `EntryForm`; the existing review/save path remains authoritative.

### 2. Session price is a fixed negotiation snapshot

Opening a helper snapshots the current official Gold-21 price. The snapshot remains fixed for that open helper session. Leaving and re-entering creates a fresh session. Resetting inside the same session does not refresh the snapshot.

### 3. Smart Purchase has a closed approved taxonomy scope

Normal-customer `شراء ذهب` in the helper may resolve only:

- `gold.raw.scrap_foreign`
- `gold.raw.scrap_arabic`
- `gold.direct.coin`
- `gold.direct.bar`

An additional generic `gold_direct` rule does not automatically become eligible.

### 4. Coin/bar quantity capability comes from stable runtime taxonomy

For existing imported Production accounts, quantity tracking may be inferred at runtime only when the account resolves structurally to:

- `gold.direct.coin`
- `gold.direct.bar`

The Account Registry therefore exposes quantity in addition to gold weight for these taxonomies even when the legacy Firestore document lacks `quantityStep`.

Scrap taxonomies remain weight-only. The rule is centralized in `src/lib/inventoryTrackingPolicy.ts`, not in React and not as an Arabic-name UI heuristic.

Approved Production runtime IDs for the current imported coin/bar documents may be used as a compatibility bridge inside the central runtime policy. This mapping is read-only and must remain taxonomy-constrained; it is not permission to classify every `gold_direct` account as quantity-tracked.

### 5. New seeded coin/bar accounts carry explicit metadata

`SEED_ACCOUNTS` includes `quantityStep: 1` for the coin and bar so future seeded accounts express the intended tracking model directly. Scrap accounts do not receive `quantityStep`.

### 6. No Production metadata migration is required

No historical Entry or Production account document is rewritten for this decision. Compatibility remains in application logic, consistent with the historical-data-preservation policy.

### 7. Sale tax/stamp settings are pricing configuration

The 18k and 21k sale tax/stamp EGP/gram rates are stored as separate top-level Settings pricing configuration (`goldSaleTaxStampPerGramEgp`). They are not part of `openingCostConfig`, WAC, COGS, or a separate transaction posting. 24k has no tax/stamp in this helper.

## Consequences

- Existing imported coin/bar accounts behave correctly without a Firestore migration.
- New seed accounts are explicit and need less compatibility inference.
- UI behavior and Entry review both consume the same Account Registry `tracksQuantity` result.
- The helper cannot bypass Posting Matrix, numbering, WAC, inventory guards, or Entry validation.
- Runtime compatibility mappings must be reviewed if the approved Production account identity changes; unknown/unrelated direct-gold accounts remain fail-closed for quantity inference.

## Verification

- Focused assistant/account-registry/count tests: 39 passed.
- Typecheck, Balance Contract, build, and diff check passed.
- Authenticated Production acceptance passed for exact four-product purchase scope, scrap count hidden, coin/bar count default 1, sale assistant behavior, and manual Entry Form access.
- No Production Firestore writes occurred during implementation or acceptance.
