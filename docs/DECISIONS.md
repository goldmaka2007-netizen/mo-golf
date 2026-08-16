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

Smart Sale and Smart Purchase are optional pricing/pre-fill helpers; the existing Entry Form review/save pipeline remains authoritative. Smart Purchase is restricted to the four approved stable inventory taxonomies: foreign scrap, Arabic scrap, gold coin, and gold bar. Coin/bar are weight + quantity products and may derive quantity capability from the approved runtime taxonomy when legacy Production metadata lacks `quantityStep`; no Production metadata migration is required. Sale tax/stamp is pricing configuration separate from Opening Cost/WAC. See ADR-009.
