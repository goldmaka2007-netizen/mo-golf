# Smart Gold Pricing Configuration — Production Release

Date: 2026-08-18
Status: COMPLETED / PRODUCTION PASSED

## Release

- Feature commit: `9a24826f5a1204f81a58ac3dc271e17c3f501da2`
- Production: https://makka-central-accounting.web.app
- Firebase project/site: `makka-central-accounting` / `makka-central-accounting.web.app`
- Production asset: `/assets/index-565SPfPc.js`
- Deployment scope: Firebase Hosting only.

## Objective

Unify configurable gold pricing defaults across Settings, Smart Sale, Smart Purchase, and Story Builder without changing the accounting write contract.

The Smart Gold Assistants remain pricing / negotiation / pre-fill helpers only. `EntryForm` remains the authoritative review/save path and no pricing-only fields are added to `Entry`.

## Pricing configuration

A normalized `pricingConfig` is stored under `settings/{uid}` and is separate from `openingCostConfig`.

Rules:

- No automatic Firestore write when `pricingConfig` is absent.
- Save happens only after an explicit user Save action.
- Settings persistence uses `setDoc(..., { merge: true })`.
- No migration of Production data.
- Assistant session overrides never write back to Settings automatically.

### Stable product identity

Pricing resolution uses stable taxonomy/pricing identity first, with `account:<id>` only as a fallback when a stable taxonomy is unavailable. Arabic display names are not the authoritative identity for the new pricing rules.

## Jewelry sale defaults

Each supported `gold.product.*` taxonomy can have one authoritative workmanship default:

```ts
{ mode: 'perGram' | 'perPiece', value: number }
```

The assistant displays both workmanship per gram and per piece and keeps them live-linked by the entered jewelry weight.

Example: a 400 EGP per-piece default remains 400 EGP/piece. At 1 g it is 400 EGP/g; at 2 g it is 200 EGP/g.

For normal jewelry, count is inventory metadata only and does not alter pricing weight, gold value, workmanship, tax/stamp, or suggested total.

## Bullion and coin weights

Approved bullion unit weights:

- 0.25 g
- 0.5 g
- 1 g
- 2.5 g
- 5 g
- 10 g
- 20 g
- 31.1 g
- 50 g

Approved coin unit weights:

- 2 g
- 4 g
- 8 g

100 g is not part of the approved new selector/config list.

For bullion/coin only, multiple units in one assistant quote must be identical in type and unit weight:

`totalWeight = unitWeight × count`

The displayed workmanship per piece remains the single-unit value. Internal sale workmanship is derived separately as `perPiece × count` (equivalent to `perGram × totalWeight`).

Accepted production example:

- Unit weight: 0.25 g
- Count: 3
- Total weight: 0.75 g
- Displayed workmanship: 1000 EGP/g and 250 EGP/piece
- Internal workmanship used in suggested price: 750 EGP

The Entry prefill receives total weight and the count separately.

## Tax / stamp policy

Tax/stamp behavior is based on stable product identity, not karat alone.

- Jewelry: applicable tax/stamp is automatic and mandatory in Smart Sale; there is no user toggle to disable it.
- `gold.direct.bar`: separate tax/stamp = 0 and no toggle.
- `gold.direct.coin`: separate tax/stamp = 0 and no toggle, including 21k coin.

## Purchase Assistant

Smart Purchase remains restricted to exactly four approved taxonomies:

- `gold.raw.scrap_foreign`
- `gold.raw.scrap_arabic`
- `gold.direct.coin`
- `gold.direct.bar`

Settings provides an independent default discount percentage for those four products only.

Selecting a product seeds the discount default and reuses the linked discount % / discount EGP per gram / purchase price per gram calculations.

- Scrap keeps manual weight.
- Bar/coin use approved fixed unit weights.
- Bar/coin total purchase weight is `unitWeight × count`.
- Final agreed total remains blank until manually entered.

## Actual sale workmanship

After the user manually enters the final agreed total, Smart Sale displays effective workmanship per gram and per piece.

- Jewelry: `finalTotal - goldValue - taxStampTotal`.
- Bullion/coin: `finalTotal - goldValue`.

For multiple bullion/coin units, actual per-piece workmanship is unit-based rather than the whole multi-unit total.

If effective workmanship is negative, the UI displays a clear red warning. The warning is informational only and does not block Review or the existing Entry save path.

## Story Builder compatibility

Story Builder consumes the same `pricingConfig` source for bullion/coin pricing.

Existing local `bullionCharges` / `coinCharges` remain read-only compatibility fallback data with legacy meaning of EGP per gram. A saved `pricingConfig` value wins over the legacy fallback. Fallback reads never trigger a Firestore write and Story Builder is no longer an independent editable pricing authority.

## Validation

Acceptance completed successfully:

- Focused pricing/presentation tests: 2 files / 27 tests passed.
- `npm run typecheck`: passed.
- `npm run check:balance-contract`: passed.
- `npm run build`: passed.
- `git diff --check`: passed.
- Full suite: 66/71 files passed; 526/531 tests passed.
- The same five documented pre-existing Golden/accounting failures remained unchanged; no Golden Baseline change.
- Persistence contract: passed using an isolated Vitest `setDoc` mock with zero live Firestore writes.

## Production smoke

Authenticated, read-only Production smoke passed:

- Firebase initialization and React mount: passed.
- Existing session: passed.
- Settings pricingConfig UI: passed; approved weights present and 100 g absent.
- Sale bullion 0.25 g × 3: total weight 0.75 g; displayed 1000 EGP/g and 250 EGP/piece; suggested total 6107.25; no tax/stamp toggle.
- Purchase Assistant: exactly four approved products.
- Story Builder: approved weights only; legacy charge controls read-only; 100 g absent.
- Mobile RTL at approximately 390 px: no meaningful horizontal overflow.
- Runtime/startup console errors: 0.

No Settings Save or Review action was pressed during Production smoke, so the smoke remained read-only.

## Protected surfaces unchanged

This release did not change:

- Posting Matrix
- WAC
- COGS
- Balance Engine
- Entry schema/save contract
- Historical Entries
- Firestore Data
- Firestore Rules
- Firestore Indexes
- Functions
- Storage
- Authentication

## Final state

The feature is accepted, committed, pushed, deployed to Firebase Hosting, and verified on Production.

Any later behavior change requires a new change-control cycle.
