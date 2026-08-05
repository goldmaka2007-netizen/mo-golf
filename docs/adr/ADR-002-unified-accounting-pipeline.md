# ADR-002 — Unified Accounting Pipeline

**Status:** Active  
**Date:** 2026-08-03

## Problem

When Ledger, Trial Balance, and financial statements calculate balances independently, the same source operation can produce different classifications, dimensions, or totals.

## Context

Makka tracks monetary value, multiple inventory quantities, and Book Value. Duplicated report logic magnifies small classification differences and can hide Double Posting or missing COGS.

## Decision

Opening entries and invoices feed one central accounting projection. Ledger, Trial Balance, official statements, and supporting reports consume that projection and the same compatible cost timeline.

UI/report components may format, group, filter, and present results. They must not invent accounting legs, revalue inventory, or independently calculate COGS.

## Alternatives rejected

- Separate cash, gold, silver, and accessories accounting systems as official statements.
- Independent report formulas using raw entries.
- UI-side balancing adjustments.

## Consequences

Central changes have wider impact and require focused regressions across Ledger, Trial Balance, and statements. In return, one fixed root cause corrects every consumer.

## Implementation landmarks

Verify current paths before editing. On the reviewed 2026-08-05 head, relevant files included:

- `src/lib/postingMatrix.ts`
- `src/lib/legacyLedger.ts`
- `src/lib/unifiedTrialBalance.ts`
- `src/lib/financialStatementsEgp.ts`

## Regression protection

A representative operation should prove balanced projected legs, consistent Ledger/Trial Balance rows, and balanced official statements.
