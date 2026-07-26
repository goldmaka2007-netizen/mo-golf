# Canonical Mapping Design — Phase 2.1

Phase 2.1 closes design decisions only. It does not bind mappings to the Production Accounting Engine.

## Deterministic variant contract

Every row in `canonical_operation_mapping_matrix.csv` contains operationType, variant, triggerConditions, requiredFields, the three ledger postings, inventory/cost/profit effects, fallbackPolicy, status and decisionId. Historical variants use exact raw operation + debit + credit; the 41 non-TX42 openings additionally use exact sourceOperationId; returns require originalOperationId.

## True metal-weight counterparts

- Gold purchase: Dr named physical gold inventory / Cr `canonical:metal-flow:gold:acquired`, Equivalent-21.
- Gold sale: Dr `canonical:metal-flow:gold:sold` / Cr named physical gold inventory, Equivalent-21.
- Silver purchase: Dr named physical silver inventory / Cr `canonical:metal-flow:silver:acquired`, physical grams.
- Silver sale: Dr `canonical:metal-flow:silver:sold` / Cr named physical silver inventory, physical grams.

These are commercial metal-flow accounts, not clearing accounts. They explain acquisition/disposal of shop-owned metal and close annually to the matching retained metal result. Physical inventory moves once; ledger legs do not generate a second inventory movement.

## Cost and returns

Purchases debit carrying-cost assets, never purchase expense. Sales recognize Revenue and relieve carrying cost to COGS at pre-sale WAC. Returns use original linked cost. Surpluses are excluded from confirmed-cost available WAC pending audited manual cost assignment.
