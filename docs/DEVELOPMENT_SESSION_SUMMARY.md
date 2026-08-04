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

## Inventory account/WAC production blocker

### Evidence and account meaning

- Firestore was inspected read-only: 74 accounts, including 32 active inventory accounts (20 gold, 9 silver, 3 accessories), and 2,372 entries.
- `09qdBCNEiu9JxX4N6JnK` is the active Silver Band inventory account (`silver.product.band`, chart name: Dabla Silver). It is not bad invoice data.
- The account has 15 direct operation references between 2026-01-01 and 2026-06-09. Its structural metadata matches the versioned inventory definition and resolves to stable cost identity `seed-account-585a165916de021adb5a`.

### Exact root cause

The Posting Engine resolved invoice sides against the live Firestore account master, so it correctly accepted the runtime document ID. The save-time invoice guard then called the low-level WAC engine directly. That engine accepts versioned stable cost IDs, while the existing runtime compatibility resolver was used only by background cost recalculation. The two valid paths therefore disagreed and save failed with `unknown_inventory_account`.

### Central correction

- Invoice save validation, inventory-check settlement, background recalculation, WAC, Book Value, COGS, and report timelines now enter through `rebuildRuntimeInventoryCostTimeline`.
- The resolver maps verified runtime IDs to stable cost taxonomy in memory, runs the strict cost engine, then restores runtime IDs in the returned timeline so General Ledger, Trial Balance, Income Statement, Statement of Financial Position, and inventory reports join to the same account master.
- The resolver remains fail-closed: exact versioned metadata is required for historical aliases; random or conflicting IDs remain rejected.
- Item-specific inventory clones are supported only through a valid `cloneSourceAccountId` and compatible structural metadata. They inherit the source taxonomy but keep a distinct inventory/WAC pool.
- Accessory `quantityStep=1` is treated as compatible runtime configuration for the three versioned accessory accounts; it is not a blanket inventory classification.

### Coverage guard

`inventoryAccountResolution.regression.test.ts` compares every active inventory ID emitted by supported invoice mappings with the bindings accepted by Cost/WAC. It fails if any valid emitted gold, silver, accessory, or supported clone account is missing from the resolver.

Coverage includes all 32 production inventory IDs plus the exact reported ID regression, and purchase/sale cash/credit matrices for gold, silver, and accessories.

### Verification

- Exact regression + resolver audit + transaction matrix: 7/7 passed.
- Focused accounting/WAC/report tests: 63/63 passed.
- Golden prerequisites: 38/38 passed.
- Golden baseline: 5/5 passed without baseline changes.
- Full suite: 450/450 passed.
- Balance Contract Guard, TypeScript, and lint: passed.

### Data safety

No Firestore document was migrated or rewritten. No production test write was made. Firestore data, Rules, Indexes, Functions, Storage, and Authentication are unchanged. The correction is an in-memory compatibility and resolution change plus Hosting application code only.
- Final build asset: `assets/index-Du8Rx4DR.js`.

## Known limitations
Sales returns, purchase returns, merchant receipts, customer payments, and mixed-category invoices were not invented or claimed as supported. The production verification used HTTP and the deployed static asset; no production Firestore test writes were made.
