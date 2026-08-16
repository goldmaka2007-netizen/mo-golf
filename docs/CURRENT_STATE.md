# Current Project State

Last reviewed: 2026-08-17

## Production baseline

- Repository: `goldmaka2007-netizen/mo-golf`
- Production: https://makka-central-accounting.web.app
- Firebase project: `makka-central-accounting`
- Deployed application code commit: `ef01889414c924ff28921fb4c89c094746a4e98c`
- Deployment scope for the current release: Firebase Hosting only.
- Production Firestore Data/Rules/Indexes/Functions/Storage/Auth were not changed by the Smart Gold Assistants release.

## Smart Gold Assistants — deployed 2026-08-17

The production Entry flow now includes optional pricing assistants for `بيع ذهب` and `شراء ذهب`. They do not save accounting Entries directly; they calculate/pre-fill and return to the existing `EntryForm` Step 2, after which the existing Step 3 review/save pipeline remains authoritative.

### Smart Sale

- Fixed Gold-21 official-price snapshot per open assistant session.
- Product/karat resolved from account metadata/registry rather than a manual karat selector.
- Live-linked workmanship per gram and per piece.
- Configurable sale tax/stamp pricing in Settings: default 18k = 15 EGP/g, 21k = 12 EGP/g, 24k = none.
- Suggested total plus manually entered final agreed total.
- Workmanship and tax/stamp are pricing-only and are not persisted as separate accounting fields.

### Smart Purchase

The helper is intentionally limited to the four approved normal-customer purchase taxonomies:

- `gold.raw.scrap_foreign`
- `gold.raw.scrap_arabic`
- `gold.direct.coin`
- `gold.direct.bar`

It provides linked discount %, discount EGP/g, and purchase price/g, then hands the final agreed cash amount to the existing Entry Form.

### Quantity tracking

Approved behavior:

- Foreign scrap: weight only.
- Arabic scrap: weight only.
- Gold coin: weight + quantity, default/minimum count 1.
- Gold bar: weight + quantity, default/minimum count 1.

Authenticated acceptance proved that the imported Production coin/bar account documents lacked `quantityStep`. The accepted fix is code-only: `src/lib/inventoryTrackingPolicy.ts` derives quantity capability from stable runtime taxonomy and the Account Registry exposes `tracksQuantity = true` for coin/bar without rewriting Production metadata. `SEED_ACCOUNTS` now also contains `quantityStep: 1` for new coin/bar seed accounts.

The compatibility policy remains taxonomy-constrained; unrelated `gold_direct` accounts are not automatically quantity-tracked.

## Validation and acceptance

Final accepted release checks:

- Focused assistant/account-registry/count tests: 39 passed.
- `npm run typecheck`: passed.
- `npm run check:balance-contract`: passed.
- `npm run build`: passed.
- `git diff --check`: passed.
- Full suite during implementation review: 65 test files passed with the same 5 pre-existing Golden/accounting failures; no new failures and no Golden Baseline change.

Authenticated Production smoke:

- Smart Purchase exact four-product scope: passed.
- Scrap count hidden: passed.
- Coin count visible/default 1: passed.
- Bar count visible/default 1: passed.
- Smart Sale + fixed price snapshot: passed.
- Manual Entry Form: passed.
- Runtime console errors: 0.
- 390px mobile horizontal overflow: none detected.
- Test accounting Entries saved: 0.

## Accounting invariants unchanged

The release did not change:

- Posting Matrix.
- WAC.
- COGS.
- Balance Engine.
- Entry schema/save contract.
- Historical transaction data.

The helpers are pricing assistance only; all accounting validation and persistence still run through the existing centralized Entry path.

## Current implementation landmarks

- `src/components/views/EntryForm.tsx` — authoritative manual/pre-filled entry and save flow.
- `src/components/views/GoldPricingAssistant.tsx` — Smart Sale/Purchase presentation.
- `src/lib/goldPricingAssistant.ts` — pure pricing, product resolution, reset/session, and handoff helpers.
- `src/lib/inventoryTrackingPolicy.ts` — central runtime coin/bar quantity compatibility policy.
- `src/lib/accountRegistry.ts` — canonical account tracking resolution.
- `src/components/views/SettingsView.tsx` — separate sale-pricing settings card.
- `src/hooks/useDataSync.ts` / `src/store.ts` — Settings synchronization/state.
- `src/lib/inventoryCostEngine.ts` and cost timeline — authoritative inventory cost/COGS path.

## Settings state

`goldSaleTaxStampPerGramEgp` is a separate top-level Settings field. It is not nested under `openingCostConfig` and does not affect WAC/opening inventory cost.

## Recent production lineage

- `898fc6cabe6e13d3317a354145aaf65f0e7097db` — Al-Safi transfer realization baseline before this feature.
- `e995e7350944856611d135f20f9e48f4fb541b88` — initial Smart Gold Assistants.
- `3b5e737361accbec4c3b10c29442ce5db19621d7` — four-product Smart Purchase restriction.
- `ef01889414c924ff28921fb4c89c094746a4e98c` — central coin/bar quantity tracking; merged and deployed.

Detailed release record: `docs/SMART_GOLD_ASSISTANTS_RELEASE_2026-08-17.md`.
Architecture decision: `docs/adr/ADR-009-smart-gold-assistants-runtime-quantity-tracking.md`.

## Known baseline issues

The repository still has five documented pre-existing Golden/accounting test failures that were present before this feature. They were not changed or hidden by this release. Do not regenerate the Golden Baseline merely to clear them.

## Source-of-truth order

Use `CONSTITUTION.md`, `docs/DECISIONS.md`, active ADRs, this file, executable tests/contracts, then current implementation code. Verify technical paths against the current branch before editing.
