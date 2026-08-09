# ADR-006 — Merchant Gold Liability Carrying-Value WAC

**Status:** Active
**Date:** 2026-08-09

## Problem

Merchant gold weight, ordinary cash/workmanship payable, and inventory cost were projected through overlapping semantics. A merchant transfer could be treated like inventory movement, and physical settlement could leave the difference between merchant carrying value and Inventory WAC inside the merchant balance.

## Decision

- Maintain a derived in-memory gold liability state per merchant: E21 units, EGP Book Value in minor units, and Merchant Liability WAC.
- Value a new liability from the approved immutable operation price snapshot; use only approved historical/opening compatibility sources when that snapshot is absent, with diagnostics instead of invented prices.
- Transfer gold between merchants at the source merchant's immediately preceding liability WAC. The destination receives the identical carrying value; inventory and P&L are unchanged.
- Settle physical gold by releasing the merchant liability at Merchant Liability WAC and inventory at Inventory WAC. Post only the difference to the generated settlement gain or loss account.
- Keep Treasury settlement cash-only and keep workmanship/cash separate from gold Book Value.
- Close the full carrying value when E21 reaches zero so rounding residue cannot remain.

## Consequences

General Ledger, Unified Trial Balance, Income Statement, and Statement of Financial Position consume the same central carrying-value projection. Firestore history and account documents are unchanged; compatibility remains in memory and ID-first.

## Regression protection

Protect receipt valuation, WAC settlement gain/loss, merchant transfer invariants, cash-only settlement, Khaled Hamido completed cycles, and Mohamed El Sayed to Al-Safy transfer carrying value.
