# Merchant Metal Missing-Price Backfill — 2026-08-09

Scope: Firebase project `makka-central-accounting`, collection `entries`, only eligible non-opening merchant-metal operations whose accounting price was absent.

- Previewed before writes: 12 operations.
- Applied: 12 operations in one Firestore batch.
- Field written: `invoiceOfficialPricePerGramEgp` only.
- Existing valid `marketPrice` / `invoiceOfficialPricePerGramEgp` values changed: 0.
- Exact-date reference: `اسعار جولد بيلون الرسمية ٢٠٢٦ حتي اليوم` (`16WLyg73LG6kH1l2awiUpL8JZaBJSdUOyvQw4VEAaIQM`).
- Opening entries excluded; no previous-day fallback.
- Post-apply eligible missing operations: 0.
- Pre-existing-price hash before/after: `816127164cad6994c5e3a78fccf621f3a43003e7c9d7230cc5dba8f03c8de5ad`.
- Firestore Rules, Indexes, Functions, Storage, Authentication, historical weights, journals, account IDs, and operation numbers were unchanged.

| Operation | Date | Metal | Old state | Applied price |
|---|---:|---|---|---:|
| TX373 | 2026-01-27 | silver | absent | 165 |
| TX382 | 2026-01-27 | silver | absent | 165 |
| TX496 | 2026-02-05 | gold | absent | 6655 |
| TX495 | 2026-02-05 | gold | absent | 6655 |
| TX646 | 2026-02-17 | gold | absent | 6600 |
| TX644 | 2026-02-17 | gold | absent | 6600 |
| TX632 | 2026-02-17 | gold | absent | 6600 |
| TX643 | 2026-02-17 | gold | absent | 6600 |
| TX642 | 2026-02-17 | gold | absent | 6600 |
| TX641 | 2026-02-17 | gold | absent | 6600 |
| TX683 | 2026-02-20 | silver | absent | 145 |
| TX1361 | 2026-04-08 | gold | absent | 7250 |
