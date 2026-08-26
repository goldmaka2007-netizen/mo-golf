# Current Project State

Last reviewed: 2026-08-27

## Production baseline

- Repository: `goldmaka2007-netizen/mo-golf`
- Production: https://makka-central-accounting.web.app
- Firebase project: `makka-central-accounting`
- Latest deployed application commit: `a9e23b0c51adc0d0ff960dde8d333d2cc94ca194`
- Latest release: Home gold summary alignment with Financial Position + mobile readability correction.
- Deployment scope: Firebase Hosting only.
- Release status: COMPLETED / PRODUCTION DEPLOYED / OWNER MANUAL ACCEPTED / CROSS-SYSTEM VERIFIED.
- ChatGPT directly verified GitHub + Notion + Google Drive against the same final Production state before closure.

## Latest production change — Home Gold Summary Alignment

The Operational Home gold card no longer maintains an independent gold-ownership calculation.

Current approved behavior:

- Home gold summary consumes the same Financial Position ownership projection used for the official supporting E21 quantities.
- Home displays only Gold Assets, Gold Liabilities, and Gold Equity/Net Ownership as E21 weights.
- Gold Assets - Gold Liabilities = Gold Equity.
- Home rounds the three displayed values to two decimal places for mobile readability; the underlying projection remains unchanged.
- Treasury remains a lightweight operational cash read.
- If the Financial Position gold projection cannot be built, Home shows `—` plus a diagnostic rather than inventing a value.

Owner live Production acceptance on 2026-08-27:

- Gold Assets: `2,209.75 g E21`.
- Gold Liabilities: `100.06 g E21`.
- Gold Equity / Net Ownership: `2,109.69 g E21`.
- The values were visible on iPhone without clipping or overlap.
- These displayed values match the reviewed 2026-08-26 Financial Position quantities after display rounding from `2209.750 / 100.060 / 2109.690`.

Implementation commits:

- `04b39a40c3c845a07bb3085d8be16170efa604d5` — align Home gold card with Financial Position.
- `a9e23b0c51adc0d0ff960dde8d333d2cc94ca194` — improve Home gold card readability.

Final Production asset: `/assets/index-D4l93UvJ.js`.

Detailed record:
- `docs/HOME_GOLD_SUMMARY_ALIGNMENT_PRODUCTION_RELEASE_2026-08-27.md`
- Decision: `docs/DECISIONS.md` D-020.

## Validation and safety

Gold-source alignment validation:

- Focused Home / Financial Position / UI tests: `11/11 PASS`.
- Typecheck: PASS.
- Balance Engine contract guard: PASS.
- Production build: PASS.
- `git diff --check`: PASS.
- The known `financialPositionCentralBalances.test.ts` sign failure remained pre-existing and unchanged.

Readability follow-up validation:

- Focused Home/UI: `3/3 PASS`.
- Typecheck: PASS.
- Balance Engine contract guard: PASS.
- Production build: PASS.
- `git diff --check`: PASS.

Deployment evidence:

- Firebase Hosting only.
- Production root: HTTP 200.
- Final Production asset: HTTP 200.
- Local / Production asset SHA-256 matched.

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

- Financial Position + Equity correction — application commit `1a97d66da6d4475f704e025cfcb1ef940e0cf48e`.
- E21 / WAC / Al-Safi consistency — application commit `f66cc5678df8b54a00809705a9ff54b2b030f061`.
- Story Compact Fit + Story-only Buy Spread — application commit `1be587d3aa22196e9d1d544459693e5a69ddfd5b`.
- Financial Position baseline release — application commit `b304f1205fe92fea49f1de209b9a180233761a73`.
- Operational Home original release — application commit `5086600f740b86277f635fa2f4113470ee4b7669`; its original independent Home gold calculation was superseded by the 2026-08-27 Home Gold Summary Alignment release.

## Known open items

- Pre-existing accounting/Golden test failures remain separate follow-up work. Do not regenerate or alter the Golden Baseline merely to clear them.
- Completion of the full historical 2116-row migration/reconciliation is not proven by current documentation.
- Historical `arabicWeight` migration/backfill remains **not approved** and requires a separate Critical migration safety review, dry run, rollback design and explicit owner approval.
- Legacy Planning/Grill trackers are not evidence of current Production state.
- Broader performance/dead-code cleanup remains separate work.
- JavaScript chunk-size warnings above 500KB remain a separate performance item and did not block this release.

## Source roles and closure

- GitHub: execution truth for code, tests, deployment implementation and technical state.
- Notion: workflow, approved decisions, task status and change history.
- Google Drive: accounting, operational, architecture and reviewer-facing references.
- `Makka — Current Reviewer Context` must stay short and point to detailed records.
- Uploaded copies are snapshots only; live GitHub/Notion/Drive sources win when they differ.
- This release is hard-closed only because the accepted Production state and the affected GitHub + Notion + Google Drive references were directly re-read and found consistent.
