# XLSX → CSV Release — 2026-08-15

## Release

- Application commit: `1796f7bf53b2c95a407d74de6ee10f9c9dbc2f63`
- Firebase project: `makka-central-accounting`
- Scope: Firebase Hosting only
- Production asset: `assets/index-DDP4HsQB.js`

## Change

- Removed the `xlsx` dependency and all runtime XLSX references.
- Replaced application exports with native UTF-8 BOM CSV downloads.
- Replaced Settings Excel/CSV import with CSV-only import using a standards-compliant local parser.
- Preserved the previous importer business fields: date, operation, debit, credit, cash, weight, notes, karat, count, Arabic weight, and multiplier.
- Added header mapping, reordered-column support, extra-column ignoring, BOM handling, quoting/newline support, numeric validation, and malformed-row rejection.

## Bundle

| Metric | Before | After | Saving |
|---|---:|---:|---:|
| JavaScript | 2,350.19 kB | 1,914.60 kB | ~435.59 kB / 18.53% |
| Gzip | 662.59 kB | 517.50 kB | ~145.09 kB / 21.89% |

The earlier CSV-only measurement was 1,912.59 kB / 516.69 kB gzip; the final deployed build includes the Settings parser and focused tests do not affect runtime. XLSX was part of the main/initial bundle, not a separate lazy chunk.

## Validation

- Focused CSV/Settings/export tests: 8 passed.
- `npm run typecheck`: passed.
- `npm run check:balance-contract`: passed.
- `npm run build`: passed.
- `git diff --check`: passed.
- Full suite: 490 passed, 5 pre-existing accounting/Golden failures; no Golden Baseline change.

## Production Smoke and Safety

- Production root: HTTP 200.
- Production JS asset: HTTP 200.
- Browser smoke reached Home, Daily Journal, Reports, Settings CSV UI, and Inventory Check.
- Safe CSV file parsing was verified in Settings without submitting the import/write action.
- Firestore Data, Rules, Indexes, Functions, Storage, Authentication, accounting logic, WAC, COGS, and posting logic were unchanged.
