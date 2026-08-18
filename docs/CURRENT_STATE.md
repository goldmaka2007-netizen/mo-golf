# Current Project State

Last reviewed: 2026-08-19

## Production baseline

- Repository: `goldmaka2007-netizen/mo-golf`
- Production: https://makka-central-accounting.web.app
- Firebase project: `makka-central-accounting`
- Latest deployed application feature commit: `5086600f740b86277f635fa2f4113470ee4b7669`
- Operational Home release documentation commit: `30c2590bd861261cbcb451959718b612c4589413`
- Cross-system knowledge hard-sync receipt commit: `a401f2256f19987b57683f8c5d2a295510f3f6f2`
- Production asset: `/assets/index-BBtYn-2M.js`
- Deployment scope for the latest release: Firebase Hosting only.
- Firestore Data/Rules/Indexes/Functions/Storage/Auth were not changed by the Operational Home release.

## Current production capabilities

### Operational Home — deployed 2026-08-18

The Home screen is now a lightweight mobile-first operating surface with:

- Gold-21 and silver current-price editing through the existing `saveMetalPrices` path.
- Direct Smart Sale and Smart Purchase shortcuts.
- Current cashbox balance.
- Gold Inventory E21.
- Net Owned Gold E21 after merchant liabilities.
- No legacy report/dashboard calculations on the Home critical path.

Detailed release record: [`docs/OPERATIONAL_HOME_RELEASE_2026-08-18.md`](OPERATIONAL_HOME_RELEASE_2026-08-18.md).

### Smart Daily Management Dashboard — deployed 2026-08-18

The Daily Journal includes Cash Closing, current-day operations, and a smart management dashboard using canonical transaction/cash data with gold as the primary management dimension.

Detailed release record: [`docs/SMART_DAILY_MANAGEMENT_DASHBOARD_RELEASE_2026-08-18.md`](SMART_DAILY_MANAGEMENT_DASHBOARD_RELEASE_2026-08-18.md).

### Smart Gold Pricing Configuration — deployed 2026-08-18

Smart Sale, Smart Purchase, Settings, and Story Builder share the approved pricing configuration while remaining outside the centralized accounting write contract.

Detailed release record: [`docs/SMART_GOLD_PRICING_CONFIG_RELEASE_2026-08-18.md`](SMART_GOLD_PRICING_CONFIG_RELEASE_2026-08-18.md).

### Smart Gold Assistants — deployed 2026-08-17

Smart Sale and Smart Purchase calculate and prefill the existing Entry flow; the existing review/save path remains authoritative.

Detailed release record: [`docs/SMART_GOLD_ASSISTANTS_RELEASE_2026-08-17.md`](SMART_GOLD_ASSISTANTS_RELEASE_2026-08-17.md).

## Current implementation landmarks

- `src/components/views/EntryForm.tsx` — authoritative manual/pre-filled entry and save flow.
- `src/components/views/GoldPricingAssistant.tsx` — Smart Sale/Purchase presentation.
- `src/lib/goldPricingAssistant.ts` — pricing/configuration/session/handoff helpers.
- `src/lib/inventoryTrackingPolicy.ts` — central runtime coin/bar quantity compatibility policy.
- `src/lib/accountRegistry.ts` — canonical account tracking resolution.
- `src/components/views/SettingsView.tsx` — pricing configuration UI and explicit Save.
- `src/components/views/StoryBuilderView.tsx` — pricingConfig consumer with read-only legacy fallback.
- `src/lib/dailyJournalSmartDashboard.ts` — Smart Daily Management Dashboard calculations.
- `src/lib/homeSelector.ts` — lightweight Operational Home selection using canonical balances.
- `src/hooks/useDataSync.ts` / `src/store.ts` — synchronized app state.
- `src/lib/inventoryCostEngine.ts` and cost timeline — authoritative inventory cost/COGS path.

## Validation status

Latest Operational Home acceptance:

- `npm run typecheck`: passed.
- Focused Home/pricing/navigation tests: 11/11 passed.
- `npm run check:balance-contract`: passed.
- `npm run build`: passed.
- `git diff --check`: passed.
- Production root: HTTP 200.
- Production JavaScript asset: HTTP 200 and contains the new Home labels/actions.
- No interactive browser smoke was available in that execution environment.

The immediately preceding Smart Daily release had browser/application smoke with Firebase initialization, React mount, active session, and no runtime errors/warnings.

## Protected accounting/data invariants

The latest releases did not change:

- Posting Matrix.
- WAC.
- Inventory Cost / COGS semantics.
- Balance Engine.
- Entry schema/save contract.
- Historical transaction data.
- Firestore Data / Rules / Indexes.
- Functions / Storage / Authentication.

## Known open issues / technical debt

- Five documented pre-existing Golden/accounting test failures remain from the established baseline. Do not regenerate the Golden Baseline merely to clear them; classify and resolve them separately.
- Broader legacy/performance cleanup remains incomplete even though the Home critical path was made lightweight.
- Historical-data migration/reconciliation completion is not proven by the current repository documentation; `docs/HISTORICAL_DATA_ENTRY_READINESS.md` records readiness for controlled entry, not full completion.

## Recent production lineage

- `ef01889414c924ff28921fb4c89c094746a4e98c` — Smart Gold Assistants compatibility/final code baseline.
- `f3883d41a6ccdc495aede89bed246c25ebd14911` — Smart Gold Assistants release documentation.
- `9a24826f5a1204f81a58ac3dc271e17c3f501da2` — Smart Gold Pricing Configuration code release.
- `66440708d840b428cddb0d6586833c9786e52abe` — Smart Gold Pricing documentation/decisions baseline.
- `c885542d425b2dcb00e2391036c2b0352827f70b` — Smart Daily Management Dashboard code release.
- `b511a8a357453aa56876973d7a947080504bac39` — Smart Daily release documentation.
- `5086600f740b86277f635fa2f4113470ee4b7669` — Operational Home feature release currently deployed.
- `30c2590bd861261cbcb451959718b612c4589413` — Operational Home release documentation.
- `a401f2256f19987b57683f8c5d2a295510f3f6f2` — cross-system knowledge hard-sync receipt before this documentation cleanup.

## Source-of-truth order

Use `CONSTITUTION.md`, `docs/DECISIONS.md`, active ADRs, this file, executable tests/contracts, then current implementation code. Verify technical paths against the current branch before editing.

Notion and Google Drive are synchronized knowledge/decision surfaces and must reflect completed work, but they do not override the repository's protected authority order.

Project-uploaded or attached copies of project documents are snapshots only. If an uploaded copy differs from the live GitHub, Notion, or Google Drive source, verify and use the live source before analysis, review, or implementation.
