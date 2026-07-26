# Retained-results year aliases — Phase 2.1

## Canonical retained-result accounts

| Ledger | Canonical Account ID |
|---|---|
| Cash | `canonical:equity:retained-results:cash` |
| Gold | `canonical:equity:retained-results:gold` |
| Silver | `canonical:equity:retained-results:silver` |

## Approved historical semantic alias

| Historical Account ID | Stored historical name | Semantic year | Approved meaning | Modern optional display |
|---|---|---:|---|---|
| `seed-account-b99a05ac4c9416a5c6f6` | الارباح و الخساير 2024 | 2025 | الأرباح والخسائر المرحلة من سنة 2025 — ذهب | الارباح و الخساير 2024 (نتيجة 2025 المرحلة) |

- Historical stored names are immutable and are never silently renamed.
- The alias is report metadata only; it does not change Account ID or LegacyLedgerProjection.
- No semantic year is inferred for another mislabeled historical account without specific evidence; that does not block mapping to the independent Cash/Gold/Silver retained-result account.