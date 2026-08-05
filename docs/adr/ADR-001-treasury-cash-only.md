# ADR-001 — Treasury Is EGP Cash-Only

**Status:** Active  
**Date:** 2026-08-03

## Problem

Earlier projections allowed treasury-like balances to participate in metal or other dimensions, which confused cash with ownership quantities and damaged financial reporting meaning.

## Context

Treasury represents physical/available cash. Gold, silver, accessories quantity, and inventory Book Value belong to inventory, merchant, ownership, and accounting projections—not the cash drawer.

## Decision

Treasury carries EGP cash only.

- No gold dimension.
- No silver dimension.
- No accessories quantity.
- No inventory Book Value dimension.
- It enters official financial statements only through its EGP cash balance.

## Alternatives rejected

- Triple-purpose treasury containing cash and metal quantities.
- Showing metal in treasury for convenience while attempting to remove it later in reports.

Both create multiple meanings for one account and require report-specific corrections.

## Consequences

Posting and reporting must route metal/quantity ownership to the appropriate accounts. Any treasury metal leg is a regression unless a new explicit decision supersedes this ADR.

## Regression protection

Tests should confirm treasury dimensions remain zero except EGP and that official statements still balance.
