# Current Project State

Last reviewed: 2026-08-20

## Production baseline

- Repository: `goldmaka2007-netizen/mo-golf`
- Production: https://makka-central-accounting.web.app
- Firebase project: `makka-central-accounting`
- Latest deployed application commit: `cabe6a3`
- Latest production asset: `/assets/index-DBvzrIuJ.js`
- Asset SHA-256: `3888888fa7458c49af2e83cd46fe2dce3214e16e0462e61607464d91b571f5a9`
- Deployment scope: Firebase Hosting only.
- Firestore Data/Rules/Indexes, Functions, Storage, Auth and Golden Baseline were not changed by this release.

## Latest production change — Story Builder contact footer

- Story Builder keeps the existing 1080×1920 price-story layout and replaces the Facebook QR footer with three RTL contact rows: location, WhatsApp `+20 15 50326921`, and Facebook `مكة للمصوغات والمجوهرات @makkagoldalex`.
- Contact icons are local gold Canvas vectors, and WhatsApp/Facebook LTR segments are drawn independently to preserve phone and username order.
- Final icon polish uses 30px local gold Canvas vectors for the location pin, WhatsApp bubble/handset, and Facebook mark; production smoke passed.
- Facebook mark received a final local Canvas path correction; production smoke passed without changing Location, WhatsApp, or share logic.
- The QR asset and generation dependency were removed; the disclaimer copy remains unchanged and its heading was removed as requested.
- Production smoke passed for React/Firebase startup, Story Builder preview, 1080×1920 output, share/save controls, and release-attributable console errors.

## Latest production change — Financial Position

The Financial Position report is now a richer presentation and traceability layer over the existing EGP accounting source. It does not introduce a new accounting calculation path.

Current behavior:

- Monetary EGP values remain sourced from `buildFinancialStatementsEgp`.
- Current-year month buttons are available from January through the latest-data month; each month is cumulative as of its cutoff.
- The latest month uses the latest actual entry date.
- Gold inventory collapsed rows show Book Value plus E21 weight.
- Silver inventory collapsed rows show Book Value plus silver weight.
- Accessories remain monetary-only when collapsed.
- Merchant gold, silver and cash receivables/payables are separated for review while preserving authoritative aggregates.
- Assets, liabilities and equity show secondary gold/silver monitoring dimensions; equity metal labels are net monitoring positions, not accounting equity grams.
- Smart zero hiding keeps a metal row visible when EGP is zero but a genuine non-zero metal balance exists.
- Detail rows can drill into the existing account/ledger path where available.
- CSV export is latest-cutoff only and refuses to export when the cost timeline is unavailable.

## Acceptance and accounting parity

- Financial Position acceptance/parity tests passed before merge.
- Post-merge focused validation passed.
- Pre-deploy focused validation passed.
- `npm run typecheck`: passed.
- `npm run check:balance-contract`: passed.
- Production build: passed.
- The monthly read model was verified to preserve `buildFinancialStatementsEgp` monetary outputs at the same cutoff.
- No monetary difference was found in the parity gate.
- The known `financialPositionCentralBalances.test.ts` expectation mismatch (`-1.43` expected vs `+1.43` actual) reproduces on the pre-change baseline and remains PRE-EXISTING / OUT OF SCOPE. Do not alter protected accounting behavior merely to clear it.

## Production verification

- Production root: HTTP 200.
- Production main asset: HTTP 200.
- Local and production JS asset SHA-256 matched exactly.
- Authenticated read-only production smoke passed for the Financial Position report.
- The latest month opened by default, month buttons stopped at the latest-data month, inventory/merchant sections rendered correctly, totals and net metal labels rendered, detail opening did not change totals, latest-only CSV was available, and no release-attributable console errors were observed.

## Current implementation landmarks

- `src/components/views/reports/EgpBalanceSheetView.tsx` — Financial Position presentation.
- `src/lib/monthlyFinancialPosition.ts` — monthly cutoff read model and latest-only CSV rows.
- `src/lib/financialPositionPresentation.ts` — presentation-only smart-zero visibility helper.
- `src/lib/financialStatementsEgp.ts` — authoritative EGP statement read model used by the Financial Position presentation.
- `src/lib/__tests__/monthlyFinancialPosition.acceptance.test.ts` — Financial Position acceptance/parity regression coverage.
- `src/lib/inventoryCostEngine.ts` and the runtime cost timeline — authoritative inventory cost/COGS path; unchanged by the Financial Position release.

## Export review

The owner reviewed the pre-update `balance_sheet.csv` against the post-update `financial_position_2026-08-01.csv` before closure.

The 32 inventory rows matched one-for-one between the two exports, including Book Value and metal weight. Aggregates were preserved:

- Gold inventory: EGP 13,506,267.67 and E21 2,226.420 g.
- Silver inventory: EGP 674,310.45 and 5,391.750 g.
- Accessories inventory: EGP 6,118.95.

The new export adds full Financial Position detail while preserving those inventory figures. Its summary for the reviewed cutoff is balanced with `assets - liabilities - equity = 0`.

## Protected accounting/data invariants

This release did not change:

- Posting Matrix.
- WAC.
- Inventory Cost / COGS semantics.
- Balance Engine semantics.
- Entry schema/save contract.
- Merchant settlement accounting semantics.
- Historical transaction data.
- Approved Historical Overlay records.
- Firestore Data / Rules / Indexes.
- Functions / Storage / Authentication.
- Golden Baseline.

## Known open issues / technical debt

- The documented pre-existing Golden/accounting failures remain separate work; do not regenerate Golden Baseline merely to clear them.
- Completion of the full historical 2116-row migration/reconciliation is still not proven by current documentation.
- Broader legacy/performance cleanup remains separate follow-up work.
- Historical Planning/Grill trackers are not proof of current Production state.

## Source roles and closure

- GitHub is the execution truth for code, tests and technical state.
- Notion stores workflow, approved decisions and change history.
- Google Drive stores reviewer-facing, operational, accounting and architecture references.
- `Makka — Current Reviewer Context` must stay short and point to detailed references.
- A task is not Closed until ChatGPT directly verifies GitHub + Notion + Google Drive are updated and consistent.

Project-uploaded or attached copies are snapshots only. When they differ from live project sources, verify against the live sources before acting.
