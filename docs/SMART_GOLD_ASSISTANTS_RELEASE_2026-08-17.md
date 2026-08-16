# Smart Gold Assistants — Production Release — 2026-08-17

## Status

Completed, merged to `main`, and deployed to Firebase Hosting.

- Production application commit: `ef01889414c924ff28921fb4c89c094746a4e98c`
- Production: https://makka-central-accounting.web.app
- Firebase project: `makka-central-accounting`
- Deployment scope: Hosting only

## Purpose

The release adds optional pricing assistants for live gold sale and purchase transactions without replacing the existing Entry Form or accounting pipeline. The assistants calculate and prefill; the existing Entry Form review/save path remains authoritative.

## Smart Sale Assistant

- Available only for `بيع ذهب`.
- Takes a fixed Gold-21 official-price snapshot when the assistant session opens.
- Derives the selected product/karat from approved account metadata and registry resolution.
- Provides live-linked workmanship fields: EGP/gram and total piece workmanship.
- Supports configurable sale tax/stamp pricing rates stored separately in Settings:
  - 18k: default 15 EGP/g.
  - 21k: default 12 EGP/g.
  - 24k: no tax/stamp.
- Shows suggested total and a dominant manually entered final agreed total.
- Does not persist workmanship or tax/stamp as independent accounting fields.

## Smart Purchase Assistant

- Available only for `شراء ذهب`.
- Uses the same fixed session price-snapshot model.
- The customer-purchase scope is intentionally limited to these stable inventory taxonomies:
  - `gold.raw.scrap_foreign`
  - `gold.raw.scrap_arabic`
  - `gold.direct.coin`
  - `gold.direct.bar`
- Provides live-linked discount percentage, EGP/gram discount, and purchase price/gram.
- Shows suggested total and the final agreed total; actual final price/gram and discount are informational only.
- No discount analytics are persisted as separate Entry fields.

## Quantity tracking decision

Authenticated acceptance showed that legacy Production account documents for the gold coin and bar did not contain `quantityStep`, so the registry originally classified both as weight-only.

The approved correction is application-side and does **not** migrate Production Firestore metadata:

- `gold.raw.scrap_foreign` → weight only.
- `gold.raw.scrap_arabic` → weight only.
- `gold.direct.coin` → weight + quantity.
- `gold.direct.bar` → weight + quantity.

`src/lib/inventoryTrackingPolicy.ts` derives coin/bar quantity capability from the approved runtime taxonomy. The Account Registry then exposes `trackingMode = weight_and_quantity` and `tracksQuantity = true`. `SEED_ACCOUNTS` also gives coin/bar `quantityStep: 1` so new seeded accounts carry the same intent explicitly.

For compatibility with the already imported Production dataset, the runtime policy contains approved current runtime-ID mappings for coin/bar in addition to stable inventory resolution. This is read-only compatibility logic; it does not rewrite account documents. An unrelated `gold_direct` account is not automatically considered quantity-tracked.

## Entry Form handoff

The assistants do not save Entries. `مراجعة` hands the calculated values back to the normal `EntryForm` Step 2 and locks the negotiated session market price against live price refresh. The existing Step 3 review, identity validation, Posting Matrix, numbering, inventory guards, WAC/Cost validation, and Firestore save path remain authoritative.

The manual/historical Entry Form remains directly usable.

## Settings

Sale tax/stamp pricing is persisted as the separate top-level Settings field:

`goldSaleTaxStampPerGramEgp`

It is intentionally separate from `openingCostConfig` because it is a sale-pricing parameter, not an inventory opening-cost or WAC input.

## Validation

Final accepted implementation:

- Focused assistant/account-registry/count tests: 39 passed.
- `npm run typecheck`: passed.
- `npm run check:balance-contract`: passed.
- `npm run build`: passed.
- `git diff --check`: passed.
- Full suite during final implementation review: 65 test files passed with the same 5 pre-existing Golden/accounting failures; no new failures and no Golden Baseline regeneration.

## Production acceptance

Authenticated Production smoke passed:

- Smart Purchase exposes exactly four approved products.
- Scrap products hide count.
- Gold coin shows count with default/minimum 1.
- Gold bar shows count with default/minimum 1.
- Smart Sale loads real products and follows the same Account Registry quantity policy.
- Fixed session-price indicator works.
- Manual Entry Form still opens.
- 390px mobile width: no horizontal overflow detected.
- Runtime console errors: 0.
- Test accounting Entries saved: 0.

## Accounting and Firebase safety

Unchanged:

- Posting Matrix.
- WAC.
- COGS.
- Balance Engine.
- Entry schema.
- Entry save contract.
- Historical transactions.

Production actions:

- Firestore data writes: 0.
- Firestore Rules deploys: 0.
- Firestore Indexes deploys: 0.
- Functions deploys: 0.
- Storage/Auth deploys: 0.
- Firebase Hosting deploy: successful.

## Implementation files

Main feature paths include:

- `src/components/views/GoldPricingAssistant.tsx`
- `src/components/views/EntryForm.tsx`
- `src/components/views/SettingsView.tsx`
- `src/lib/goldPricingAssistant.ts`
- `src/lib/inventoryTrackingPolicy.ts`
- `src/lib/accountRegistry.ts`
- `src/hooks/useDataSync.ts`
- `src/store.ts`
- `src/migrationData.ts`
- focused regression tests under `src/lib/__tests__`

## Related commits

- `e995e7350944856611d135f20f9e48f4fb541b88` — initial Smart Sale/Purchase assistants.
- `3b5e737361accbec4c3b10c29442ce5db19621d7` — restrict Smart Purchase to the four approved taxonomy products.
- `ef01889414c924ff28921fb4c89c094746a4e98c` — derive coin/bar quantity tracking centrally from taxonomy and update seed metadata.
