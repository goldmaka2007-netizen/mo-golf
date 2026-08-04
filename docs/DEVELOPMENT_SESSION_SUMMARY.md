# Development Session Summary

Date: 2026-08-04

## Objective
Final reliability pass for historical accounting entry beginning 16 June: correct the Gold Sales Invoice dimension failure, standardize report numbers, and add Trial Balance gram price.

## Root cause and correction
The generic invoice `count` field was interpreted as the accounting `quantity` dimension for every product. Gold and silver invoices can retain an operational piece count, but that count is not accessories inventory. The same generic weight fallback could also classify an accessories payload as gold. Dimension selection is now centralized around the selected accounts: accessories own quantity; gold owns gold weight; silver owns silver weight. Validation remains active and rejects genuinely forbidden dimensions.

## Accounting contracts preserved
Treasury is EGP-only. Metal and accessories dimensions remain independent. WAC remains the source of Book Value and COGS. Revenue, COGS, inventory relief, and settlement legs remain generated once by the central projection. Historical records were not migrated or rewritten.

## Changed areas
- Save-time accounting policy and Posting Matrix dimension selection.
- Central formatting utility and Daily Journal/Trial Balance presentation.
- Unified Trial Balance WAC-derived effective gram price.
- Focused invoice/settlement matrix and regression tests.

## Verification
- Exact invoice dimension matrix: 12/12 passed.
- Focused policy/pipeline tests: 9/9 passed.
- Report/accounting regressions: 43/43 passed.
- Contract Guard, TypeScript, lint, production build, and git diff check: passed.
- Build asset: `assets/index-BEk4es11.js`.

## Known limitations
Sales returns, purchase returns, merchant receipts, customer payments, and mixed-category invoices were not invented or claimed as supported. The production verification used HTTP and the deployed static asset; no production Firestore test writes were made.
