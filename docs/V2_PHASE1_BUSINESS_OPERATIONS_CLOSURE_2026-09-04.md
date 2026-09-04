# Makka V2 — Phase 1 Business Operations Drill Closure — 2026-09-04

## Status

**CLOSED / OWNER-APPROVED BUSINESS FREEZE / GEMINI RED-TEAM REVIEW PASSED / DOCUMENTATION SYNC**

Makka V2 is separate from the currently accepted Production application and from the Central Accounting remediation track. This closure freezes Phase 1 business-operation meaning only. It does not authorize V2 implementation, Production deployment, Firestore changes, Posting Matrix changes, WAC/COGS changes, Balance Engine changes, or migration execution.

Detailed V2 Phase 1 business decisions live in Google Drive **Makka V2 — Project Master Context & Phases**. Notion **Makka V2 — Project Index**, **01 — Business, Accounting & Inventory Rules**, and **02 — Operations Catalog & Field Matrix** carry the reviewer-facing/canonical cross-references and legacy/current-app drift labels.

## Independent closure review

Gemini Pro performed a deep read-only red-team closure review from Google Drive and returned **READY TO CLOSE AFTER DOCUMENTATION CLEANUP**, with **no genuine Phase 1 Business Blocker**. ChatGPT then checked the reported drift against live Google Drive, Notion, and GitHub before cleanup.

The cleanup fixed three high-risk documentation boundaries:

1. **Count is operation-specific.**
   - Gold/Silver retail sale: weight is primary; count is optional even when the product tracks count. Omitted count leaves count unchanged and produces a non-blocking warning; entered count decrements exactly the entered count.
   - Gold coin/bar purchase and silver-bar purchase: positive count remains required.
   - Merchant receipt and Tafiet output: count is required when the received/destination product tracks count.
   - Accessories: quantity is required and must be a positive whole integer.

2. **Negative inventory is operation-specific.**
   - Gold Sale, Silver Sale, and Accessory Sale may pass below available inventory only after a strong warning and explicit confirmation.
   - This is not a universal outgoing-inventory override and does not automatically apply to merchant settlement, Tafiet, transfer, or other internal/settlement paths.

3. **V2 correction lifecycle supersedes older soft-delete wording.**
   - Wrong operations are corrected by direct edit of the original operation.
   - Hard Delete is allowed after confirmation, while full audit evidence is retained and later dependent results are recomputed chronologically.
   - No normal Return operation exists in the Mohamed Gold workflow.

## Required market-price snapshots for new direct metal sale/purchase

For new V2 direct metal sale/purchase operations, a valid current market-price snapshot is required at registration:

- Gold Sale.
- Gold Purchase.
- Silver Sale.
- Silver Purchase.

Missing/zero current metal price blocks save. A backdated entry still captures the current application price at registration time, not the historical price for the entered invoice date. The **Final Agreed Total** remains the authoritative cash amount and is not forced by the market snapshot.

This snapshot rule does not automatically apply to Tafiet, Inventory Transfer, Accessories, or merchant/internal operations whose own business contract has no market-price input.

## Migration boundary

Historical missing market prices are a migration concern, not a reason to weaken new-operation validation.

The reviewed 2026 daily-price CSV covers every missing metal-price row in the current analytical snapshot. Values sourced from that file must be marked as **Derived Historical Price**, preserve any already-recorded historical price, and be reconciled on the fresh live export used at migration time. No historical data was changed during Phase 1 closure.

## Phase boundary

Phase 1 is closed because the owner/business meaning is sufficiently defined for Domain & Data Model work without inventing new business rules.

Intentionally deferred:

- **Phase 2:** entities, authoritative vs derived fields, identities, relationships, operation aggregates, validation representation.
- **Phase 3:** Posting Matrix, WAC/COGS, Balance Engine, merchant carrying-value accounting, Al-Safi realization accounting, valuation, depreciation.
- **Migration:** live export, immutable raw copy, account mapping, historical cleanup/backfill, reconciliation, cutover.
- **UI/UX / Platform:** form design, warnings presentation, database/platform selection.

Phase 2 is **READY / NOT STARTED**. Starting design does not authorize implementation.

## Production and code impact

- Application code changed: **none**.
- Tests/builds required for this docs-only closure: **none**.
- Firebase/Firestore impact: **none**.
- Production deployment: **none**.
- Central Accounting acceptance/remediation status: unchanged and separate.
