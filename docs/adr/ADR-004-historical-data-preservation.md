# ADR-004 — Preserve Historical Firestore Data

**Status:** Active  
**Date:** 2026-08-03

## Problem

Historical documents contain legacy identifiers and shapes. Rewriting production data to match every new engine version would be risky, difficult to reverse, and could destroy auditability.

## Context

The application must support old entries while improving account classification, WAC, and reports. Historical compatibility is therefore an application responsibility unless a separately approved migration is designed and audited.

## Decision

- Do not migrate or rewrite historical Firestore transactions by default.
- Preserve runtime IDs presented by production data.
- Resolve approved legacy/runtime forms in memory using structured metadata, stable mappings, opening configuration, and approved overlays.
- Keep resolution fail-closed for unknown or conflicting identities.
- Firestore Data, Rules, Indexes, Functions, Storage, and Authentication remain unchanged unless explicitly authorized.

## Alternatives rejected

- Bulk rewrite of production documents during feature delivery.
- Name-only account matching.
- Accept-anything compatibility rules.
- Silent correction of records during reads.

## Consequences

Compatibility code is more complex and must be treated with historical respect. Every removal or broadening requires evidence and regression tests.

## Regression protection

Tests should cover known historical aliases, exact approved overlays, unknown IDs, conflicting metadata, stable output IDs, and unchanged official balances.
