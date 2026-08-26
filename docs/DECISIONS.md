# Final Active Decisions

This file is a compact index of approved decisions. Detailed rationale belongs in ADRs. A decision remains active until explicitly superseded.

## D-001 — Production-first changes

Makka is treated as production software. Use root-cause analysis and the smallest central correction. Broad refactors require explicit approval.

## D-002 — Hybrid authority model

Business/accounting decisions in the Constitution, this file, and active ADRs are authoritative. Technical names and paths must be verified against current code.

## D-003 — Smart reading budget

Read the Constitution and Current State first, then approximately 3–10 directly relevant source/test files. Expand only with a stated reason.

## D-004 — Confidence policy

Known facts may be used. High-confidence inference is allowed only when it cannot alter protected behavior. Unknown blocking decisions must be raised explicitly.

## D-005 — One centralized accounting pipeline

Opening entries and invoices feed central identity, posting/projection, cost, ledger, Trial Balance, and financial statement paths. Reports and UI must not create independent accounting calculations.

## D-006 — Independent dimensions

EGP, gold equivalent 21, silver weight, accessories quantity, and Book Value EGP remain separate. Unlike dimensions are never added together.

## D-007 — Treasury is cash-only

Treasury carries EGP cash only. It does not carry metal weight, accessories quantity, or inventory Book Value.

## D-008 — WAC is authoritative for inventory cost

WAC determines inventory Book Value and COGS. Current market price is not inventory cost.

## D-009 — Sale posts revenue and COGS once

A sale automatically creates revenue, inventory reduction, and COGS. No second user-created COGS invoice and no double posting.

## D-010 — Official financial reporting

Official financial statements are in EGP and must balance. Gold, silver, and quantity are supporting metrics. Official gold supporting quantity is equivalent 21 weight.

## D-011 — Runtime account resolution is mandatory

Invoice validation and all WAC/report consumers use the centralized runtime cost-timeline path. Strict low-level WAC must not be called directly from UI or invoice validation.

## D-012 — Historical data remains unchanged

No Firestore migration or rewriting of historical transactions. Compatibility is implemented in application logic and approved overlays.

## D-013 — Firebase safety

Firestore Data, Rules, Indexes, Functions, Storage, and Authentication remain unchanged unless explicitly authorized. Default deployment is Hosting only and requires explicit approval.

## D-014 — Golden Baseline protection

Do not regenerate or edit Golden Baseline simply to make tests pass. Expected-output changes require an approved accounting/business decision.

## D-015 — Documentation synchronization

Simple technical metadata may be updated with a task. Accounting or architectural decisions require explicit approval and a Decision/ADR update.

## D-016 — Definition of Done

Every delivery reports root cause, changed files, verification, data/Firebase impact, remaining risks, deployment status, and one of: Completed, Partially Completed, or Blocked.

## D-017 — Merchant metal positions are signed and use separate carrying-value pools

Each merchant gold position is signed in E21 and each merchant silver position is signed in physical grams. Positive positions are payables; negative positions are merchant-metal receivables. Gold, silver, inventory, and merchant cash/workmanship remain independent dimensions and WAC pools. New positions use the approved immutable operation basis; opening entries use Settings opening cost. Merchant transfers preserve carrying value without inventory or P&L. Physical settlements release merchant carrying value and Inventory WAC independently, recognizing only the legitimate metal-settlement gain or loss. See ADR-007.

## D-018 — Smart Gold Assistants remain outside the accounting write contract

Smart Sale and Smart Purchase are optional pricing/pre-fill helpers; the existing Entry Form review/save pipeline remains authoritative. Smart Purchase is restricted to the four approved stable inventory taxonomies: foreign scrap, Arabic scrap, gold coin, and gold bar. Coin/bar are weight + quantity products and may derive quantity capability from the approved runtime taxonomy when legacy Production metadata lacks `quantityStep`; no Production metadata migration is required. Pricing-only values never become new Entry fields. See ADR-009.

## D-019 — Unified Smart Gold Pricing Configuration

`settings/{uid}.pricingConfig` is the authoritative configurable pricing source for Smart Sale, Smart Purchase defaults, and Story Builder bullion/coin pricing. It remains separate from `openingCostConfig`, is normalized on read, and is written only after an explicit user Save with merge semantics; missing configuration and legacy fallback reads must never trigger automatic Firestore writes.

Approved pricing semantics:

- Product identity uses stable taxonomy/pricing identity first and `account:<id>` only as fallback; Arabic display names are not authoritative keys.
- Jewelry workmanship defaults store one authoritative `{ mode: 'perGram' | 'perPiece', value }`; the other displayed value is derived live from the entered jewelry weight. Jewelry count remains inventory metadata only and does not alter pricing.
- Bullion approved unit weights are 0.25, 0.5, 1, 2.5, 5, 10, 20, 31.1, and 50 g; coin approved unit weights are 2, 4, and 8 g. 100 g is excluded from the approved new selector/config list.
- For bullion/coin, multiple units in one assistant quote are identical units: `totalWeight = unitWeight × count`. Displayed workmanship per piece remains the single-unit value while internal sale workmanship uses `perPiece × count` (equivalent to `perGram × totalWeight`). Entry prefill receives total weight and count separately.
- Jewelry tax/stamp is automatically applied when applicable and cannot be disabled in Smart Sale. `gold.direct.bar` and `gold.direct.coin` have zero separate tax/stamp and no toggle, including 21k coin; tax behavior is product-identity based, not karat-only.
- Smart Purchase stays limited to exactly `gold.raw.scrap_foreign`, `gold.raw.scrap_arabic`, `gold.direct.coin`, and `gold.direct.bar`, with independent default discount percentages. Scrap keeps manual weight; bar/coin use fixed unit weight and count-derived total weight. Final agreed total remains manually entered.
- Story Builder consumes the same saved pricing source. Existing local `bullionCharges` / `coinCharges` are read-only legacy EGP/g fallback data only; saved pricing configuration wins and fallback reads never write Firestore.
- Negative effective sale workmanship is displayed as a warning only and does not change or block the existing Entry review/save contract.

Detailed release record: `docs/SMART_GOLD_PRICING_CONFIG_RELEASE_2026-08-18.md`.

## D-020 — Financial Position and Equity roll-forward reporting

Official Financial Position and Statement of Changes in Equity remain EGP statements and must reconcile to the same centralized accounting projection. Gold E21 and silver grams are supporting ownership metrics only.

Approved reporting semantics:

- Financial Position supporting net metal ownership is derived from the same-date asset and liability positions; unlike dimensions are never netted into EGP.
- Any Home/UI surface that labels gold Assets, Liabilities, Equity, or net ownership must consume the same Financial Position ownership projection rather than maintain an independent gold-ownership calculation.
- Fixed assets are classified from authoritative account metadata or the canonical registry by stable source account ID. Arabic account-name matching is not an accounting classification source.
- The Equity Statement is YTD from January 1 through the selected cutoff. True opening entries belong to opening equity; normal January 1 transactions remain period movements.
- Capital additions, withdrawals and other direct-to-equity movements use authoritative account classification, not display names.
- Approved historical inventory overlays dated after year start and on/before the cutoff are presented as direct-to-equity book-value movements. They do not enter current-period P&L and are not balancing plugs. Overlays on/before year start remain opening-basis effects only.
- Ending equity must equal the same-date Financial Position equity. A material reconciliation difference is fail-closed rather than silently adjusted.

Detailed Financial Position/Equity release record: `docs/FINANCIAL_POSITION_EQUITY_PRODUCTION_RELEASE_2026-08-25.md`.
Home gold-summary consumer release: `docs/HOME_GOLD_SUMMARY_ALIGNMENT_PRODUCTION_RELEASE_2026-08-27.md`.
