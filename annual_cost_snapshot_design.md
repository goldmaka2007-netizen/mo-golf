# Annual Cost Snapshot — Design Only

Status: design-only. No collection, migration, Production write, or runtime
activation is authorized by this document.

## Versioned record

```ts
interface AnnualCostSnapshot {
  fiscalYear: number;
  closingAccounts: Array<{
    stableInventoryAccountId: string;
    unitBasis: 'gold_equivalent21_centigram' | 'silver_centigram' | 'accessory_milli_piece';
    closingQuantityUnits: number;
    closingPhysicalQuantityUnits: number;
    closingMetalWacMinorPerStandardUnit: number | null;
    closingWorkmanshipWacMinorPerPhysicalUnit: number | null;
    closingTotalBookCostMinor: number;
  }>;
  calculationGenerationId: number;
  approvedOverlayHashes: string[];
  rulesVersion: string;
  sourceDatasetFingerprint: string;
  createdAt: string;
  status: 'draft' | 'approved' | 'superseded';
}
```

All money and quantities remain scaled integers where the Cost Engine already
uses scaled integers. WAC fields use the same documented tolerance as
`phase5-cost-baseline-v1`.

## New-year opening

Only an `approved` snapshot may seed the next fiscal year. Each closing account
becomes one derived opening Cost State with the same stable account ID,
quantity, metal cost component, workmanship cost component, and total book
cost. It does not create a purchase, sale, revenue, expense, profit, or Phase 4
posting. The source snapshot ID/hash must be included in the new-year Cost Run
settings hash.

## Prior-year correction

If a prior-year source operation, approved Overlay, rules version, or opening
configuration changes:

1. mark every dependent later snapshot `superseded`; never overwrite it;
2. recalculate from the earliest affected operation in the earliest affected
   fiscal year;
3. generate a new `draft` snapshot for that year;
4. cascade recalculation through each later fiscal year;
5. compare every replacement against its superseded predecessor;
6. require explicit owner approval before any replacement becomes `approved`.

Reports must not use `draft` or `superseded` snapshots as current balances.
