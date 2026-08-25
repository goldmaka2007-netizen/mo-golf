# Current Project State

Last reviewed: 2026-08-25

## Production baseline

- Repository: `goldmaka2007-netizen/mo-golf`
- Production: https://makka-central-accounting.web.app
- Firebase project: `makka-central-accounting`
- Latest deployed application commit: `1a97d66da6d4475f704e025cfcb1ef940e0cf48e`
- Latest release: Financial Position + Statement of Changes in Equity production correction and acceptance.
- Deployment scope: Firebase Hosting only.
- Release status: COMPLETED / PRODUCTION DEPLOYED / OWNER MANUAL ACCEPTED.
- Cross-system closure requires GitHub + Notion + Google Drive verification.

## Latest production change — Financial Position & Equity

Financial Position and Statement of Changes in Equity remain official EGP reports from the centralized accounting projection. Gold E21 and silver grams are supporting ownership metrics only.

Current approved behavior:

- Financial Position shows supporting net gold/silver ownership under accumulated equity.
- Fixed assets are separated from ordinary receivables using explicit canonical metadata or canonical registry classification by stable source account ID; no Arabic-name classification.
- Financial Position CSV exports fixed assets separately.
- Merchant signed positions and no-netting rules remain unchanged.
- Equity Statement is YTD from January 1 to the selected cutoff, separating opening equity, capital additions, drawings, other direct-to-equity movements, current YTD profit and ending equity.
- True opening entries are opening-only; ordinary January 1 transactions remain period movements.
- Approved post-year-start historical inventory overlays are direct-to-equity book-value movements only; they do not enter P&L and are not balancing plugs.
- Equity Statement fails closed if ending equity does not reconcile with the same-date Financial Position.

Owner live Production acceptance on 2026-08-25:

- Total Assets: `14,286,709 EGP`
- Total Liabilities: `629,354 EGP`
- Total Equity: `13,657,355 EGP`
- EGP equation reconciled exactly.
- Gold assets `2,197.410 g E21` less liabilities `100.060 g E21` = net ownership `2,097.350 g E21`.
- Silver assets `5,361.410 g` less liabilities `0.310 g` = net ownership `5,361.100 g`.
- Fixed assets `13,750 EGP`; ordinary receivables `6,100 EGP`.
- Equity Statement opened successfully after removal of the previous `5,408.88 EGP` fail-closed difference and matched the same-date Financial Position supporting metal ownership.

Detailed record:
- `docs/FINANCIAL_POSITION_EQUITY_PRODUCTION_RELEASE_2026-08-25.md`
- Decision: `docs/DECISIONS.md` D-020.

## Validation and safety

Final release evidence includes focused regressions, Typecheck, Balance Engine contract guard and production build passing. The final deployment was Firebase Hosting only.

This release did **not** change:

- Posting Matrix.
- Inventory WAC semantics / legacy precedence.
- COGS semantics.
- Balance Engine semantics.
- Entry save contract/schema.
- Firestore Production data or historical entries.
- Historical overlay directives or approved economic values.
- Firestore Rules / Indexes / Functions / Storage / Auth configuration.
- Golden Baseline.

## Manual / visual acceptance rule

Codex may perform code work, automated tests, build and technical deployment verification. Final Visual / UX / operational acceptance on Firebase Production belongs to the owner. ChatGPT may guide and verify screenshots/exports. A task is not Closed until owner acceptance when applicable and GitHub + Notion + Google Drive are synchronized and directly verified by ChatGPT.

## Protected accounting/data invariants

Do not change these without a separate explicit owner decision and approval:

- Posting Matrix.
- WAC / COGS.
- Balance Engine semantics.
- Entry save contract/schema outside an explicitly approved scope.
- Historical Firestore records.
- Firestore Rules / Indexes / Functions / Storage / Auth.
- Golden Baseline.

## Recent production sequence

Detailed history belongs in individual release records. Important recent releases include:

- E21 / WAC / Al-Safi consistency — application commit `f66cc5678df8b54a00809705a9ff54b2b030f061`.
- Story Compact Fit + Story-only Buy Spread — application commit `1be587d3aa22196e9d1d544459693e5a69ddfd5b`.
- Story Builder Contact Footer — application commit `cabe6a3d8cc3d355c17d9af4ef83e6ccfa46cf0a`.
- Financial Position baseline release — application commit `b304f1205fe92fea49f1de209b9a180233761a73`.
- Reports Bundle Lazy Loading — application commit `bbe0b782ac312cc9466f5c22b3be87a1f913efa2`.

## Known open items

- Pre-existing accounting/Golden test failures remain separate follow-up work. Do not regenerate or alter the Golden Baseline merely to clear them.
- Completion of the full historical 2116-row migration/reconciliation is not proven by current documentation.
- Historical `arabicWeight` migration/backfill remains **not approved** and requires a separate Critical migration safety review, dry run, rollback design and explicit owner approval.
- Legacy Planning/Grill trackers are not evidence of current Production state.
- Broader performance/dead-code cleanup remains separate work.

## Source roles and closure

- GitHub: execution truth for code, tests, deployment implementation and technical state.
- Notion: workflow, approved decisions, task status and change history.
- Google Drive: accounting, operational, architecture and reviewer-facing references.
- `Makka — Current Reviewer Context` must stay short and point to detailed records.
- Uploaded copies are snapshots only; live GitHub/Notion/Drive sources win when they differ.
- If implementation is complete but any source is behind, use `Implementation Complete / Sync Pending` rather than Closed.
