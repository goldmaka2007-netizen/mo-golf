# Current Project State

Last reviewed: 2026-08-24

## Production baseline

- Repository: `goldmaka2007-netizen/mo-golf`
- Production: https://makka-central-accounting.web.app
- Firebase project: `makka-central-accounting`
- Latest deployed application commit: `f66cc5678df8b54a00809705a9ff54b2b030f061`
- Application release: E21 / WAC / Al-Safi consistency and validation fix.
- Deployment scope: Firebase Hosting only.
- Release status: COMPLETED / PRODUCTION DEPLOYED / OWNER MANUAL ACCEPTED.
- Cross-system closure requires GitHub + Notion + Google Drive verification.

## Latest production change — E21 / WAC / Al-Safi consistency

### Al-Safi transfer guard

- Gold merchant-to-merchant transfers involving the approved Al-Safi hub are rejected when the same operation does not contain a valid positive immutable transaction price.
- The validation reads the same operation's persisted/submitted price fields; it does not fetch current-market or previous-day fallback prices.
- The three historical missing-price transfers had already been manually corrected by the owner before this code release. This release is preventive and does not rewrite them.

### Unified Trial Balance E21 reporting

- Historical gold reporting resolves one canonical E21 quantity per operation and applies that same quantity symmetrically to both historical gold legs.
- Valid entry karat is preferred. If absent, a uniquely proven gold-inventory-account karat may be used. If karat cannot be proven safely, the historical raw quantity is preserved rather than guessed.
- TX1714-style stale reporting is fixed: `57.90 g @ 21K` with stored raw `57.91` reports canonically as `57.90`.
- This is a reporting-only correction. Inventory WAC legacy precedence, COGS and book-value projection were not changed.

### WAC Audit merchant normalization

- WAC Audit/Summary now applies the approved runtime account override before building the merchant timeline.
- The stable-ID runtime classification for `الاء ياسر` is therefore included in WAC Audit without changing Firestore account metadata.

## Validation and owner acceptance

Automated validation for application commit `f66cc5678df8b54a00809705a9ff54b2b030f061`:

- Final focused suite: 6 files / 43 tests passed.
- Typecheck: passed.
- `git diff --check`: passed.
- Build: passed.
- Balance Engine contract guard: passed.
- Golden Baseline was not rewritten.
- Pre-existing accounting/Golden failures remain separate work and must not be hidden by changing protected expectations.

Owner manual acceptance on live Firebase Production:

- Unified Trial Balance remained balanced.
- `علاء صالح — ذهب`: `41.05 g E21`, confirming the old +0.01 reporting discrepancy is removed.
- `الاء ياسر — ذهب`: `24.68 g E21`, approximately `144,131.20 EGP` book balance.
- Owner-exported WAC Audit includes `الاء ياسر` as a gold merchant with `24.68 g E21`, `144,131.20 EGP` carrying value and `5,840 EGP/g` WAC.
- WAC Audit: 0 Errors. Remaining 137 diagnostics are legacy same-day ordering warnings.
- Owner-exported Trial Balance CSV confirms:
  - `علاء صالح — ذهب`: `41.05 g E21`, `242,195 EGP` book balance.
  - `محمد السيد — ذهب`: `29.37 g E21`, `171,870.18 EGP` book balance.
  - `الصافي — ذهب`: `4.96 g E21`, `31,594.84 EGP` book balance.
  - `سمير ناشد — فضة`: `0.31 g`, `32.55 EGP` book balance.
  - `الاء ياسر — ذهب`: `24.68 g E21`, `144,131.20 EGP` book balance.

The Al-Safi rejection guard was not manually tested by creating a Production accounting entry. That control is accepted through focused automated regression tests because deliberately testing a failed guard on live data could create a false transaction.

Detailed GitHub release record:
- `docs/E21_WAC_ALSAFI_PRODUCTION_RELEASE_2026-08-24.md`

## Manual / visual acceptance rule

For Makka Application releases:

- Codex performs code work, automated tests, build and technical deployment verification.
- Codex does **not** perform final Visual / UX / operational manual acceptance on behalf of the owner.
- After deploy, status remains `Manual Acceptance Pending` when manual acceptance applies.
- The owner performs the live Firebase manual/visual/operational checks personally.
- ChatGPT may guide the owner step-by-step and review screenshots/exports, but the final manual acceptance decision belongs to the owner.
- A task is not Closed until owner acceptance when applicable and GitHub + Notion + Google Drive are synchronized and directly verified by ChatGPT.

## Protected accounting/data invariants

Do not change these without a separate explicit owner decision and approval:

- Posting Matrix.
- Inventory WAC semantics / legacy precedence.
- COGS semantics.
- Balance Engine semantics.
- Entry save contract/schema, except an explicitly approved scoped validation change.
- Historical Firestore records.
- Historical `arabicWeight` values.
- Historical `goldEquivalent21Snapshot` values.
- Golden Baseline.

This release did not perform a Firestore migration, historical rewrite, snapshot backfill, rules/indexes/functions change, or accounting-data mutation.

## Recent production sequence

Detailed history belongs in the individual release records rather than being duplicated here. Important recent releases include:

- Story Compact Fit + Story-only Buy Spread — application commit `1be587d3aa22196e9d1d544459693e5a69ddfd5b`.
- Story Builder Compact Variant — application commit `871cb25c095db451e520f651faabf5d2306ea75b`.
- Story Builder Contact Footer — application commit `cabe6a3d8cc3d355c17d9af4ef83e6ccfa46cf0a`.
- Financial Position — application commit `b304f1205fe92fea49f1de209b9a180233761a73`.
- Reports Bundle Lazy Loading — application commit `bbe0b782ac312cc9466f5c22b3be87a1f913efa2`.

See the corresponding release records in `docs/`, Notion Change Log and Google Drive Release History for details.

## Known open items

- Pre-existing accounting/Golden test failures remain separate follow-up work. Do not regenerate or alter the Golden Baseline merely to clear them.
- Completion of the full historical 2116-row migration/reconciliation is not proven by current documentation.
- Historical `arabicWeight` backfill/migration remains **not approved** and must not be performed without a separate Critical migration safety review, dry run, rollback design and explicit owner approval.
- Legacy Planning/Grill trackers are not evidence of current Production state.
- Broader performance/dead-code cleanup remains separate work.

## Source roles and closure

- GitHub: execution truth for code, tests, deployment implementation and technical state.
- Notion: workflow, approved decisions, task status and change history.
- Google Drive: reviewer-facing, accounting, operational and architecture references.
- `Makka — Current Reviewer Context` stays short and points to detailed records.
- Project-uploaded copies are snapshots only; live GitHub/Notion/Drive sources win when they differ.
- A task is not Closed until ChatGPT directly verifies GitHub + Notion + Google Drive are updated and consistent. If implementation is finished but any source is behind, use `Implementation Complete / Sync Pending`.