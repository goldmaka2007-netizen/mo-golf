# Phase 5 Golden Dataset Regression Policy

## Mandatory local checks

- `npm run test:golden` runs the fixed 2,169-record Golden Regression.
- `npm test` also discovers and runs the same test, so a normal test run cannot
  omit it.
- `npm run golden:generate -- --explicit-owner-approved-change --reason "<reason>" --change-id "<id>"`
  is the only supported baseline rewrite command.

The generator refuses CI, requires all three explicit arguments, runs
prerequisite Cost tests, rejects deficits/diagnostics, prints the complete
current and proposed JSON before writing, and never runs after a Golden failure
to make CI pass.

## Precision

- Money stored in minor units: exact integer equality.
- Decimal money outside the engine: maximum tolerance `0.01 EGP`.
- Quantities stored as scaled integers: exact integer equality.
- Decimal metal quantities outside the engine: maximum tolerance
  `0.000001 gram`.
- WAC: maximum tolerance `0.000001 minor unit per scaled quantity unit`. This
  permits floating division noise only; component costs remain exact integers.

No numeric Golden assertion uses formatted-string comparison.

## Change-sensitive scope

Any change touching the following must run `npm run test:golden`:

- `src/lib/inventoryCostEngine.ts`
- operation adapters/classification and entry identity
- `src/lib/goldEquivalent.ts` and karat conversion
- ordering/comparator logic
- `src/lib/historicalInventoryOverlay.ts`
- `src/lib/inventoryCostCatalog.ts` and stable account mappings
- cost reports and `src/lib/costRecalculation.ts`
- opening cost configuration
- precision, rounding, and proportional-cost helpers

No `.github` directory or GitHub Actions workflow existed when this policy was
added. Therefore integration is currently mandatory through the default local
test suite and the dedicated npm command; no workflow was created.
