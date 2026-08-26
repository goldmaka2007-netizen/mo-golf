# Home Gold Summary Alignment Production Release — 2026-08-27

## Status

COMPLETED / PRODUCTION DEPLOYED / OWNER MANUAL ACCEPTED / CROSS-SYSTEM VERIFIED.

## Production identity

- Repository: `goldmaka2007-netizen/mo-golf`
- Production: https://makka-central-accounting.web.app
- Firebase project: `makka-central-accounting`
- Gold-source alignment commit: `04b39a40c3c845a07bb3085d8be16170efa604d5` (`fix: align home gold card with financial position`)
- Final readability commit: `a9e23b0c51adc0d0ff960dde8d333d2cc94ca194` (`fix: improve home gold card readability`)
- Final deployed application commit: `a9e23b0c51adc0d0ff960dde8d333d2cc94ca194`
- Final production asset: `/assets/index-D4l93UvJ.js`
- Deployment scope: Firebase Hosting only.

## Observed issue

The Operational Home gold card and Financial Position were presenting the same ownership concept from different calculation paths.

On the 2026-08-26 Production data reviewed during the task:

- Home gold inventory: approximately `2208.670 g E21`.
- Home net owned gold: approximately `2108.610 g E21`.
- Financial Position gold assets: `2209.750 g E21`.
- Financial Position gold liabilities: `100.060 g E21`.
- Financial Position net gold ownership: `2109.690 g E21`.

The `1.080 g E21` discrepancy was isolated to the Home gold asset/ownership read path; merchant gold liabilities matched.

## Root cause

Home used a separate `computeAccountBalances`-based gold calculation in `homeSelector.ts`, while Financial Position used the authoritative monthly Financial Position projection, including the runtime inventory cost timeline and approved historical compatibility/overlay behavior.

That independent Home calculation could diverge from the Financial Position ownership quantities and violated the single-accounting-pipeline direction for a metric presented as gold ownership.

## Implemented behavior

- `monthlyFinancialPosition.ts` now exposes `buildFinancialPositionGoldSummary` as a small shared read model.
- The shared summary returns the same:
  - `goldAssetWeight`
  - `goldLiabilityWeight`
  - `netGoldWeight`
  used by Financial Position.
- `homeSelector.ts` keeps the treasury cash read lightweight through `computeAccountBalances`, but gold ownership now consumes the Financial Position projection instead of recalculating ownership independently.
- The Home gold card now displays only three E21 weight summaries:
  - الأصول
  - الخصوم
  - حقوق الملكية
- Home displays two decimal places for mobile readability and keeps each value on one line.
- No Book Value EGP or individual merchant/account details are added to the Home card.
- If the Financial Position gold projection cannot be built, Home fails visibly with `—` and a diagnostic rather than inventing a value.

## Validation

Gold-source alignment:

- Focused Home / Financial Position / UI tests: `11/11 PASS`.
- Typecheck: PASS.
- Balance Contract Guard: PASS.
- Build: PASS.
- `git diff --check`: PASS.
- The known `financialPositionCentralBalances.test.ts` sign failure remained pre-existing and unchanged.

Readability follow-up:

- Focused Home/UI: `3/3 PASS`.
- Typecheck: PASS.
- Balance Contract Guard: PASS.
- Build: PASS.
- `git diff --check`: PASS.

Production verification:

- Firebase Hosting deploy: PASS.
- Production root: HTTP 200.
- Final production asset: HTTP 200.
- Local and Production asset SHA-256 matched.

## Owner manual acceptance

The owner reviewed the final live Firebase Home on iPhone after the readability deploy.

Final Home gold card visibly showed:

- Assets: `2209.75 g E21`.
- Liabilities: `100.06 g E21`.
- Equity: `2109.69 g E21`.

These values match the reviewed Financial Position quantities for the same Production data after display rounding from three decimals to two. The values were visible without clipping or overlap.

## Safety / protected invariants

This release did **not** change:

- Posting Matrix.
- Inventory WAC semantics or legacy precedence.
- COGS semantics.
- Balance Engine semantics.
- Entry save contract/schema.
- Firestore Production data or historical entries.
- Approved historical overlay directives or values.
- Firestore Rules / Indexes / Functions / Storage / Auth.
- Golden Baseline.

No migration, historical rewrite, backfill, balancing plug, or hard-coded `1.08` correction was introduced.

## Related decisions

- `docs/DECISIONS.md` D-005 — One centralized accounting pipeline.
- `docs/DECISIONS.md` D-010 — Official financial reporting.
- `docs/DECISIONS.md` D-020 — Financial Position and Equity roll-forward reporting.

## Knowledge sync

Primary reviewer-facing release record:

- Google Drive: `Makka Application — Home Gold Summary Alignment Production Release — 2026-08-27`

ChatGPT directly verified the synchronized GitHub, Notion, and Google Drive records against the same accepted Production facts before hard close.
