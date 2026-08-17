# Current Project State

Last reviewed: 2026-08-18

## Production baseline

- Repository: `goldmaka2007-netizen/mo-golf`
- Production: https://makka-central-accounting.web.app
- Firebase project: `makka-central-accounting`
- Deployed application code commit: `9a24826f5a1204f81a58ac3dc271e17c3f501da2`
- Production asset: `/assets/index-565SPfPc.js`
- Deployment scope for the current release: Firebase Hosting only.
- Production Firestore Data/Rules/Indexes/Functions/Storage/Auth were not changed by the Smart Gold Pricing Configuration release.

## Smart Gold Pricing Configuration — deployed 2026-08-18

The Smart Gold Assistants now share a normalized pricing configuration with Settings and Story Builder while remaining outside the accounting write contract.

### Settings source of truth

`pricingConfig` is stored under `settings/{uid}` and is separate from `openingCostConfig`.

- Missing config is normalized/read safely and causes no automatic Firestore write.
- Persistence happens only after an explicit user Save action using `setDoc(..., { merge: true })`.
- No Production migration is performed.
- Assistant session overrides do not mutate saved Settings automatically.
- Stable taxonomy/pricing identity is preferred; `account:<id>` is fallback only when stable taxonomy is unavailable.

### Jewelry workmanship defaults

Each supported `gold.product.*` taxonomy may store one authoritative default:

```ts
{ mode: 'perGram' | 'perPiece', value: number }
```

The Sale Assistant displays workmanship per gram and per piece and keeps the two values live-linked by the entered jewelry weight. For normal jewelry, count remains inventory metadata only and does not affect pricing.

### Bullion and coin pricing semantics

Approved bullion unit weights are 0.25, 0.5, 1, 2.5, 5, 10, 20, 31.1, and 50 g. Approved coin unit weights are 2, 4, and 8 g. 100 g is not part of the approved new selector/config list.

For bullion/coin only:

- Multiple units in one assistant quote must be identical in product and unit weight.
- `totalWeight = unitWeight × count`.
- Displayed workmanship per piece remains the single-unit amount.
- Internal sale workmanship is `perPiece × count`, equivalent to `perGram × totalWeight`.
- Entry prefill receives total weight and count separately.

Accepted Production example: bullion 0.25 g × 3 => total weight 0.75 g, displayed workmanship 1000 EGP/g and 250 EGP/piece, internal workmanship 750 EGP.

### Tax / stamp

Tax/stamp behavior is taxonomy/product-identity based, not karat-only.

- Jewelry: applicable tax/stamp is automatic and mandatory in Smart Sale; no user disable toggle.
- `gold.direct.bar`: separate tax/stamp = 0 and no toggle.
- `gold.direct.coin`: separate tax/stamp = 0 and no toggle, including 21k coin.

### Purchase defaults

Smart Purchase remains restricted to exactly:

- `gold.raw.scrap_foreign`
- `gold.raw.scrap_arabic`
- `gold.direct.coin`
- `gold.direct.bar`

Settings can hold an independent default discount percentage for those four taxonomies. Product selection seeds the default and reuses the linked discount % / discount EGP per gram / purchase price per gram calculations. Scrap keeps manual weight; bar/coin use approved fixed unit weights and `unitWeight × count`. Final agreed total remains blank until manually entered.

### Actual sale workmanship

After manual Final Agreed Total entry, Smart Sale displays effective workmanship per gram and per piece.

- Jewelry: final total minus gold value minus applicable tax/stamp.
- Bullion/coin: final total minus gold value.
- Negative effective workmanship displays a clear red warning but does not block Review/save.

### Story Builder compatibility

Story Builder consumes the same saved pricing configuration for bullion/coin. Existing local `bullionCharges` / `coinCharges` remain read-only legacy EGP/g fallback data only. Saved `pricingConfig` wins. Legacy fallback reads never trigger Firestore writes and Story Builder is no longer an independent editable pricing authority.

## Smart Gold Assistants — deployed 2026-08-17

The production Entry flow includes optional pricing assistants for `بيع ذهب` and `شراء ذهب`. They do not save accounting Entries directly; they calculate/pre-fill and return to the existing `EntryForm`, after which the existing review/save pipeline remains authoritative.

### Smart Sale

- Fixed Gold-21 official-price snapshot per open assistant session.
- Product/karat resolved from account metadata/registry rather than a manual karat selector.
- Live-linked workmanship per gram and per piece.
- Suggested total plus manually entered final agreed total.
- Workmanship, tax/stamp, defaults, discounts, and actual-workmanship presentation remain pricing-only and are not persisted as separate accounting Entry fields.

### Smart Purchase

The helper remains intentionally limited to the four approved normal-customer purchase taxonomies listed above.

### Quantity tracking

Approved behavior:

- Foreign scrap: weight only.
- Arabic scrap: weight only.
- Gold coin: weight + quantity, default/minimum count 1.
- Gold bar: weight + quantity, default/minimum count 1.

Production coin/bar account documents may lack `quantityStep`. Compatibility remains code-only: runtime taxonomy/account-registry logic derives quantity capability without rewriting Production metadata. The compatibility policy is taxonomy-constrained; unrelated `gold_direct` accounts are not automatically quantity-tracked.

## Validation and acceptance

Final Smart Gold Pricing Configuration acceptance:

- Focused pricing/presentation tests: 2 files / 27 tests passed.
- `npm run typecheck`: passed.
- `npm run check:balance-contract`: passed.
- `npm run build`: passed.
- `git diff --check`: passed.
- Full suite: 66/71 files passed; 526/531 tests passed.
- The same five pre-existing Golden/accounting failures remained unchanged; no new failures and no Golden Baseline change.
- Persistence contract passed with an isolated Vitest `setDoc` mock and zero live Firestore writes.

Authenticated, read-only Production smoke:

- Firebase initialization / React mount / existing session: passed.
- Settings pricingConfig UI: passed; approved weights present and 100 g absent.
- Sale bullion 0.25 g × 3: total weight 0.75 g; displayed 1000 EGP/g and 250 EGP/piece; suggested total 6107.25; no tax/stamp toggle.
- Smart Purchase exact four-product scope: passed.
- Story Builder approved weights/read-only legacy fallback controls: passed.
- Runtime/startup console errors: 0.
- 390px mobile horizontal overflow: none detected.
- Production Settings Save/Review actions during smoke: 0; smoke remained read-only.

## Accounting invariants unchanged

The release did not change:

- Posting Matrix.
- WAC.
- COGS.
- Balance Engine.
- Entry schema/save contract.
- Historical transaction data.

The helpers remain pricing assistance only; all accounting validation and persistence still run through the existing centralized Entry path.

## Current implementation landmarks

- `src/components/views/EntryForm.tsx` — authoritative manual/pre-filled entry and save flow.
- `src/components/views/GoldPricingAssistant.tsx` — Smart Sale/Purchase presentation.
- `src/lib/goldPricingAssistant.ts` — pure pricing, configuration normalization/resolution, product resolution, session, and handoff helpers.
- `src/lib/inventoryTrackingPolicy.ts` — central runtime coin/bar quantity compatibility policy.
- `src/lib/accountRegistry.ts` — canonical account tracking resolution.
- `src/components/views/SettingsView.tsx` — pricing configuration UI and explicit Save.
- `src/components/views/StoryBuilderView.tsx` — pricingConfig consumer with read-only legacy fallback.
- `src/hooks/useDataSync.ts` / `src/store.ts` — Settings synchronization/state.
- `src/lib/inventoryCostEngine.ts` and cost timeline — authoritative inventory cost/COGS path.

## Settings state

- `pricingConfig` is a separate top-level Settings field and does not affect WAC/opening inventory cost.
- `goldSaleTaxStampPerGramEgp` remains a separate top-level Settings field for applicable jewelry tax/stamp rates.
- `openingCostConfig` remains independent.

## Recent production lineage

- `898fc6cabe6e13d3317a354145aaf65f0e7097db` — Al-Safi transfer realization baseline before Smart Gold Assistants.
- `e995e7350944856611d135f20f9e48f4fb541b88` — initial Smart Gold Assistants.
- `3b5e737361accbec4c3b10c29442ce5db19621d7` — four-product Smart Purchase restriction.
- `ef01889414c924ff28921fb4c89c094746a4e98c` — central coin/bar quantity tracking; first assistant production release.
- `f3883d41a6ccdc495aede89bed246c25ebd14911` — assistant release documentation baseline.
- `9a24826f5a1204f81a58ac3dc271e17c3f501da2` — unified Smart Gold Pricing Configuration; deployed and production-accepted.

Detailed current release record: `docs/SMART_GOLD_PRICING_CONFIG_RELEASE_2026-08-18.md`.
Previous assistant release record: `docs/SMART_GOLD_ASSISTANTS_RELEASE_2026-08-17.md`.
Architecture decision: `docs/adr/ADR-009-smart-gold-assistants-runtime-quantity-tracking.md`.

## Known baseline issues

The repository still has five documented pre-existing Golden/accounting test failures that were present before this feature. They were not changed or hidden by this release. Do not regenerate the Golden Baseline merely to clear them.

## Source-of-truth order

Use `CONSTITUTION.md`, `docs/DECISIONS.md`, active ADRs, this file, executable tests/contracts, then current implementation code. Verify technical paths against the current branch before editing.
