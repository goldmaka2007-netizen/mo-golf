# Smart Daily Management Dashboard — Production Release — 2026-08-18

## Status

COMPLETED / PRODUCTION PASSED

## Release

- Code release commit: `c885542d425b2dcb00e2391036c2b0352827f70b`
- Commit message: `feat(daily-journal): add smart daily management dashboard`
- Production: `https://makka-central-accounting.web.app`
- Firebase project/site: `makka-central-accounting`
- Production assets: `index-EFUA_wnF.js`, `index-Phdfmo_w.css`
- Root HTTP: 200
- Asset HTTP: 200

## Product behavior

The Daily Journal now follows the accepted operating order:

1. Selected date and the existing historical `إضافة عملية لهذا اليوم` shortcut.
2. Cash Closing card.
3. Today’s operations for review/edit access.
4. Smart Daily Management Dashboard.

Cash Closing is built from canonical cash accounting legs only and shows opening cash, all cash in, opening + cash in, all cash out, and closing cash for physical till reconciliation.

## Smart dashboard

Gold is the primary management dimension. The dashboard provides weighted transaction analysis for Today / last 7 days / last 30 days using `SUM(EGP) / SUM(E21)`, Trading Spread instead of accounting profit, and a transparent customer-gold buying ceiling.

The buying decision uses the most conservative applicable margin guardrail from:

- fixed EGP per E21 gram,
- percentage of expected sell value,
- historical trading spread.

Official Gold 21 market price is a reference/warning only and never silently changes the recommendation. Historical selected dates do not substitute today’s market price when an authoritative historical price is unavailable.

Merchant gold/silver is separated from customer commercial purchase/sale metrics. Merchant workmanship/cash balance is never treated as gold purchase value. Silver, internal transfers/scrap, and settlements are surfaced dynamically when relevant. Accessories remain accounted for in invoices/inventory/cash without a dedicated smart card.

## Data-quality and safety rules

- Customer-vs-merchant commercial classification is fail-closed on ambiguity.
- Multi-leg ambiguous gold transactions are excluded from customer commercial averages while genuine canonical cash remains included exactly once.
- Karat conflicts are excluded only from karat-specific breakdowns where safe aggregate movement remains available.
- Cash reason categories reconcile to canonical Cash In / Cash Out.
- Daily Journal does not depend on WAC, Inventory Cost, COGS, or accounting profit.

## Acceptance and validation

- Final focused Daily Journal tests: 14/14 Passed.
- All 20 locked acceptance scenarios are covered, including a direct synthetic multi-leg regression.
- `npm run typecheck`: Passed.
- `npm run check:balance-contract`: Passed.
- Production build: Passed.
- `git diff --check`: Passed.
- iPhone visual acceptance: Passed.
- Browser/application smoke: Firebase initialized, React mounted, active session, no runtime errors/warnings.

Production historical anchor `2026-07-25` verified:

- Cash In: 15,400 EGP.
- Gold Sales: 14,680 EGP.
- Silver Sales: 700 EGP.
- Repair/other cash income: 20 EGP.
- Silver: 4.40 g / 700 EGP.
- Historical market price displayed as unavailable rather than using today’s price.
- Selected historical date carried correctly into Entry Form.

## Protected systems unchanged

The release did not change:

- Posting Matrix
- WAC
- Inventory Cost
- COGS
- Balance Engine
- Entry schema/save semantics
- Firestore Data / Rules / Indexes
- Functions / Storage / Authentication
- CSV behavior
- historical data
- Gold Bullion pricing engine

Deployment was Firebase Hosting only.
