# Makka — E21 / WAC / Al-Safi Production Release — 2026-08-24

## Status

COMPLETED / PRODUCTION DEPLOYED / OWNER MANUAL ACCEPTED.

Cross-system closure is completed only after GitHub + Notion + Google Drive are verified consistent.

## Production identity

- Repository: `goldmaka2007-netizen/mo-golf`
- Production: https://makka-central-accounting.web.app
- Firebase project: `makka-central-accounting`
- Deployed application commit: `f66cc5678df8b54a00809705a9ff54b2b030f061`
- Application commit message: `fix Al-Safi validation and symmetric E21 reporting`
- Deployment scope: Firebase Hosting only.

## Implemented scope

1. **Al-Safi transfer save guard**
   - Gold merchant-to-merchant transfers involving the approved Al-Safi hub are rejected when the same operation does not contain a valid positive immutable transaction price.
   - The guard accepts the operation's persisted/submitted `invoiceOfficialPricePerGramEgp` or `marketPrice` field and does not fetch current-market or previous-day fallback prices.

2. **Unified Trial Balance E21 reporting consistency**
   - Historical gold reporting resolves one canonical E21 quantity per operation and applies the same quantity symmetrically to both historical gold legs.
   - Entry `karat` is preferred when valid; otherwise one uniquely proven gold-inventory-account karat may be used; otherwise historical raw quantity is preserved rather than guessing.
   - Reporting-only change: Inventory WAC legacy precedence, COGS and book-value legs are unchanged.

3. **WAC Audit runtime merchant normalization**
   - WAC Audit/Summary now normalizes account metadata through the approved runtime account override before building the merchant timeline.
   - This restores the approved stable-ID merchant classification for `الاء ياسر` in WAC Audit without changing Firestore account metadata.

## Automated validation

- Final focused suite: 6 test files / 43 tests passed.
- Typecheck: passed.
- `git diff --check`: passed.
- Build: passed.
- Balance Engine contract guard: passed.
- No Golden Baseline rewrite.
- Known full-suite accounting/Golden failures were reproduced on the clean pre-change HEAD and remain pre-existing/out of scope.

## Owner manual acceptance — Firebase Production

The owner personally performed the manual/visual/operational acceptance on the live Firebase application after deploy. Codex did not perform visual or UX acceptance.

Verified by owner screenshots and exports:

- Unified Trial Balance remained balanced on the live app.
- `علاء صالح — ذهب` shows `41.05 g E21` instead of the stale `41.06` reporting result; the TX1714-style `57.91 -> 57.90` reporting inconsistency is resolved.
- `الاء ياسر — ذهب` appears in the Trial Balance with `24.68 g E21` and approximately `144,131.20 EGP` book balance.
- Owner-exported WAC Audit includes `الاء ياسر` as a gold merchant with `24.68 g E21`, `144,131.20 EGP` carrying value and `5,840 EGP/g` WAC.
- WAC Audit has 0 Errors; remaining 137 diagnostics are legacy same-day ordering warnings.
- Owner-exported Trial Balance CSV confirms:
  - `علاء صالح — ذهب`: `41.05 g E21`, `242,195 EGP` book balance.
  - `محمد السيد — ذهب`: `29.37 g E21`, `171,870.18 EGP` book balance.
  - `الصافي — ذهب`: `4.96 g E21`, `31,594.84 EGP` book balance.
  - `سمير ناشد — فضة`: `0.31 g`, `32.55 EGP` book balance.
  - `الاء ياسر — ذهب`: `24.68 g E21`, `144,131.20 EGP` book balance.

The Al-Safi rejection guard was not manually tested by creating a production transaction, because a failed guard could create a fake accounting entry. It is accepted through automated regression coverage instead.

## Safety / protected invariants

- No Firestore migration.
- No historical Firestore data rewrite.
- No `arabicWeight` backfill.
- No `goldEquivalent21Snapshot` backfill.
- Inventory WAC legacy precedence unchanged.
- COGS rules unchanged.
- Posting Matrix unchanged.
- Balance Engine semantics unchanged.
- Golden Baseline unchanged.
- Firestore Rules/Indexes/Functions unchanged.

## Manual / visual acceptance workflow rule

For Makka Application releases, Codex may perform code changes, automated tests, build and technical deployment verification only. Visual, UX and operational/manual acceptance on the deployed Firebase application is performed by the owner. Screenshots/exports may be reviewed with ChatGPT, but owner acceptance is the final manual acceptance gate.

After deployment, status remains `Manual Acceptance Pending` until the owner performs the required checks and explicitly accepts. A task is not Closed until owner acceptance when applicable and GitHub + Notion + Google Drive are synchronized and verified.