# Operational Home Release — 2026-08-18

> Historical release note. The original 2026-08-18 Home gold calculation described below was superseded on 2026-08-27. Treasury remains a lightweight operational read, but Home gold Assets / Liabilities / Equity now consume the same Financial Position ownership projection. See `docs/HOME_GOLD_SUMMARY_ALIGNMENT_PRODUCTION_RELEASE_2026-08-27.md`.

## Release identity

- Feature commit: `5086600f740b86277f635fa2f4113470ee4b7669`
- Firebase project/site: `makka-central-accounting`
- Hosting URL: https://makka-central-accounting.web.app
- Production asset: `/assets/index-BBtYn-2M.js`

## Summary

Operational Home is now a lightweight mobile-first operating surface containing:

- Gold-21 and silver current-price editing through the existing `saveMetalPrices` path.
- Direct Sale Assistant and Purchase Assistant shortcuts.
- Current cashbox balance.
- Gold Inventory E21 and Net Owned Gold E21 after merchant liabilities.
- No legacy report/dashboard calculations on the Home critical path.

## Verification

- `npm run typecheck`: passed.
- Focused Home/pricing/navigation tests: 11/11 passed.
- `npm run check:balance-contract`: passed.
- `npm run build`: passed.
- `git diff --check`: passed.
- Production root: HTTP 200.
- Production JavaScript asset: HTTP 200 and includes the new Home labels/actions.
- No interactive browser smoke was available in the execution environment.

## Safety scope

- Firebase Hosting only was deployed.
- Firestore data, schema, rules, indexes, functions, WAC, COGS, Posting, and Balance Engine semantics were not changed.
- Notion and Google Drive were intentionally not updated.
