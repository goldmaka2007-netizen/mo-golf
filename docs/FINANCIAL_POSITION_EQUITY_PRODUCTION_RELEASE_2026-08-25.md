# Makka — Financial Position & Equity Production Release — 2026-08-25

## Status

COMPLETED / PRODUCTION DEPLOYED / OWNER MANUAL ACCEPTED.

Cross-system closure requires final GitHub + Notion + Google Drive verification.

## Production identity

- Repository: `goldmaka2007-netizen/mo-golf`
- Production: https://makka-central-accounting.web.app
- Firebase project: `makka-central-accounting`
- Final deployed application commit: `1a97d66da6d4475f704e025cfcb1ef940e0cf48e`
- Final application commit message: `fix: include approved equity overlays in roll-forward`
- Deployment scope: Firebase Hosting only.

## Implemented scope

- Financial Position equity summary now shows supporting net gold E21 and silver ownership alongside official EGP equity, using the same centralized Financial Position projection.
- The top equity presentation label is `إجمالي حقوق الملكية المتراكمة`; the historical `الأرباح والخسائر 2024` display label is presented as `أرباح وخسائر سنوات سابقة` without changing stored history.
- Fixed assets are separated from ordinary receivables. Classification uses authoritative metadata / canonical registry identity by stable source account ID, never Arabic account-name matching.
- Financial Position CSV exports fixed-asset rows separately from ordinary receivables.
- Merchant treatment remains signed and independent: merchant metal payable vs receivable is not netted across dimensions or merchants.
- Statement of Changes in Equity is an official EGP YTD roll-forward from January 1 through the selected cutoff. Opening equity, capital additions, drawings, direct-to-equity movements, current YTD profit and ending equity are separated.
- Same-day January 1 normal transactions remain period movements; only true opening entries belong to opening equity.
- Approved post-year-start historical inventory overlays are presented as direct-to-equity book-value movements in the equity roll-forward. They do not enter P&L and are not balancing plugs.
- The equity statement fails closed when ending equity does not reconcile to the same-date Financial Position.

## Root-cause corrections during owner acceptance

1. Historical Production account documents could lack `canonicalSubType=fixed_asset` even though the centralized account registry resolved the same stable account ID as a fixed asset. The Financial Position now accepts the registry classification without mutating Firestore metadata.
2. The Equity roll-forward initially omitted approved generated inventory-opening `book_value` equity legs dated after year start, while ending Financial Position equity included them. The exact Production fail-closed difference was `5,408.88 EGP`; those approved overlay legs are now included only as direct-to-equity movements.

## Validation

- Fixed-asset historical-metadata regression: passed.
- Equity opening / same-day capital-addition / approved-overlay regressions: passed.
- Final focused accounting suite: 3 files / 10 tests passed.
- Typecheck: passed.
- Balance Engine contract guard: passed.
- Production build: passed.
- Golden Baseline was not changed.
- No protected accounting engine semantics were altered.

## Owner manual acceptance — Firebase Production

Owner acceptance was completed on the live Firebase app after the final Hosting-only deploy.

Same-date Financial Position at `2026-08-25`:

- Total Assets: `14,286,709 EGP`
- Total Liabilities: `629,354 EGP`
- Total Equity: `13,657,355 EGP`
- EGP equation: `14,286,709 - 629,354 = 13,657,355`
- Gold assets: `2,197.410 g E21`
- Gold liabilities: `100.060 g E21`
- Net gold ownership: `2,097.350 g E21`
- Silver assets: `5,361.410 g`
- Silver liabilities: `0.310 g`
- Net silver ownership: `5,361.100 g`

Fixed-asset / ordinary-receivable acceptance:

- Fixed assets: `13,750 EGP` = cash counter machine `7,250` + laptop `6,250` + landline phone `250`.
- Ordinary receivables: `6,100 EGP` = Um Omar `1,100` + Shorouk Habashy `5,000` (zero-balance rows may remain visible but do not alter the total).

The live Equity Statement opened successfully after the overlay correction, with no `5,408.88 EGP` reconciliation failure. Its supporting ownership values matched the same-date Financial Position exactly: net gold `2,097.350 g E21`, net silver `5,361.100 g`.

## Safety / protected invariants

Unchanged:

- Posting Matrix.
- Inventory WAC semantics / legacy precedence.
- COGS semantics.
- Balance Engine semantics.
- Entry save contract/schema.
- Firestore Production data and historical entries.
- Historical inventory overlay directives and approved economic values.
- Firestore Rules / Indexes / Functions / Storage / Auth configuration.
- Golden Baseline.

No Firestore migration or historical rewrite was performed.
