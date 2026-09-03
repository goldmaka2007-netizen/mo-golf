# Current Project State

Last reviewed: 2026-09-03

## Current Production operating baseline

- Repository: `goldmaka2007-netizen/mo-golf`.
- Production: `https://makka-central-accounting.web.app`.
- Firebase project: `makka-central-accounting`.
- Daily business Production remains based on the last known working and owner-accepted legacy application SHA `5241d44d3251a515a81ec6004fb6ae8447a64956`, with the separately approved Story-only patch applied from release commit `7642c22b76b316966cfe67490c8992ebff13a6f2` on branch `release/story-ui-legacy-2026-09-03`.
- Current Production main asset: `/assets/index-BKNQiFne.js`.
- The Story-only release passed `npm ci`, focused Story + StoryPricing tests (15 PASS), TypeScript, Balance Contract Guard, production build, `git diff --check`, Firebase Hosting-only deploy, root/asset HTTP 200, and startup smoke without console errors.
- Owner manual Production acceptance: Compact Story PASS, Full Story PASS, and daily-use Firebase Production works normally after deployment.
- The Story release changed Firebase Hosting only. It did **not** change Firestore data, Rules, Indexes, Functions, Storage, Auth, backend configuration, Posting Matrix, WAC/COGS, Merchant Metal WAC, Balance Engine, Entry contracts, or Golden Baseline.
- Current Central Accounting/main application state was **not** deployed as part of this Story release.

## Accepted Story-only Production release — 2026-09-03

- Release base: `5241d44d3251a515a81ec6004fb6ae8447a64956`.
- Release branch: `release/story-ui-legacy-2026-09-03`.
- Release commit: `7642c22b76b316966cfe67490c8992ebff13a6f2` (`feat: release approved story redesign on legacy production`).
- Application diff was limited to `src/components/views/StoryBuilderView.tsx` plus the focused Story contract test; no accounting/backend files changed.
- Compact and Full Story outputs are 1080×1920.
- Compact uses the accepted price-first fintech layout with dynamic date/time, Gold hero, one-row Silver table, readable CTA/disclaimer/footer, and no decorative outer frame/fake Story UI.
- Full preserves Gold → Bullion (two columns) → Coins (one vertical column) → Silver → disclaimer → contacts, with no Full CTA.
- Pricing, Story-only buy spread, workmanship, source content, sharing/download behavior, and filenames remain unchanged.
- Production release status: `DEPLOYED / OWNER MANUAL ACCEPTED / DAILY USE PASS`.

## GitHub / Central Accounting source state

- The Central Accounting implementation remains preserved in GitHub; it was **not** reverted or deleted.
- Central Accounting application/code merge baseline: `223f473785ff72b7b92bdd005ef34508f56168af` (PR #31 merged).
- That baseline includes the narrow historical `customer.payment` Shadow compatibility correction.
- Production must **not** be redeployed from the Central Accounting/main application state until the unresolved parity and operational issues are investigated, corrected, independently verified, and explicitly re-approved by the owner.
- Documentation sync may advance GitHub `main` beyond `223f473...`; the important distinction is: daily Production runs the accepted legacy baseline plus the isolated Story-only release, while Central Accounting source remains preserved in GitHub for offline remediation.

## Central Accounting Production acceptance result

Central Accounting Phases 1–5B were previously deployed to Firebase Hosting and then tested on Production. The release is **NOT Production accepted**.

### Historical identity blocker correction

The first Production Evidence Pack found five historical `دفع لعميل` rows with stored legacy `operationKind=transfer` while Central Registry resolved `customer.payment / other`. The approved narrow compatibility fix was implemented, tested, merged through PR #31, and deployed.

A later read-only RCA proved that this identity fix worked correctly:

- all 5 historical rows satisfy the approved compatibility boundary;
- `operation_identity_mismatch = 0` for those rows;
- source rows remain unchanged as `transfer`;
- canonical parity identity is `customer.payment / other`;
- no historical Firestore backfill or mutation was performed.

### Current real blocker after the identity fix

Production RCA on 3,504 Entries / 76 Accounts / 74 canonical definitions found:

- `shadow.status = compared`;
- `shadow.exactParity = false`;
- `coverage.shadowReady = true`;
- operation catalog issues = 0;
- unmapped operations = 0;
- ambiguous account aliases = 0;
- account classification conflicts = 0;
- Shadow blockers = 0.

Parity result:

- total rows = 3,504;
- matched = 1,643;
- open = 1,861;
- errors = 0;
- 105 repeated discrepancy patterns.

Difference counts:

- dimension = 1,863;
- value = 1,860;
- inventory = 1;
- validation = 3.

Severity:

- warning = 1,860;
- info = 1.

The dominant discrepancy is legacy quantity being used/carried while canonical quantity is not used / resolves to `0`. Example: 1,088 `بيع ذهب` rows show quantity `1 -> 0`.

Open rows by major operation:

- `بيع ذهب`: 1,219;
- `تيفيت`: 295;
- `شراء ذهب`: 150;
- `بيع ملحقات`: 75;
- `بيع فضة`: 47;
- other operations: 75.

Therefore the current `central_shadow_not_exact` is **not** an identity blocker. The identity fix succeeded and exposed a broader parity-model mismatch that must be resolved before Central Accounting can be accepted for Production.

## Additional operational blocker observed by owner

During the Central Accounting Production attempt, the owner also tried a Gold Sale invoice and reported that it would not save. This was not investigated before the emergency rollback because restoring daily business operation took priority.

Treat the Sale-save failure as a separate Production-critical issue to reproduce and investigate read-only/focused before any future Central Accounting redeploy. Do not assume it shares the same root cause as the 1,861 parity discrepancies.

## Current status

- Daily business Production: `LEGACY BASELINE + STORY-ONLY RELEASE / OWNER MANUAL ACCEPTED / DAILY USE PASS`.
- Story redesign task: `CLOSED` after Production deployment, Compact + Full owner acceptance, and daily-use confirmation.
- Central Accounting code: `PRESERVED IN GITHUB / NOT PRODUCTION ACCEPTED`.
- Central Accounting Production Acceptance task: `BLOCKED / NOT CLOSED`.
- Emergency rollback task: `IMPLEMENTED / OWNER CHECK PASSED`.
- No Central Accounting redeploy is authorized at this checkpoint.
- 2026 remains an Open Year; Year-Close / closed-period authority and 2027 transition remain deferred until end-of-year work.

## Mandatory next work for the next ChatGPT account

Start from live sources, not old chat history:

1. Read Notion `Makka Change Workflow — مسار أي تعديل جديد`.
2. Read Google Drive `Makka — Current Reviewer Context`.
3. Verify GitHub `main`, then read `AGENTS.md`, `CONSTITUTION.md`, and this file.
4. Preserve the accepted daily Production baseline: legacy SHA `5241d44d...` plus the Story-only release commit `7642c22b...`; do not replace it with current Central Accounting/main without a separate explicit owner decision.
5. Do **not** deploy current Central Accounting source to Production merely because it is on `main`.
6. Investigate Central Accounting in two controlled tracks before any redeploy:
   - parity remediation for the 1,861 open rows, starting with quantity semantics and repeated operation patterns;
   - independent RCA for the owner-observed Gold Sale save failure.
7. Any accounting/business semantic change requires explicit decision lock and owner approval under the Makka Change Workflow.
8. After a corrected Central Accounting release passes independent verification and Owner Production Acceptance, sync GitHub + Notion + Google Drive and verify all three before closing that separate task.

## Protected accounting/data invariants

Do not change without a separate explicit owner decision and approval:

- Posting Matrix.
- Inventory WAC / COGS.
- Merchant Metal WAC.
- Balance Engine semantics.
- Entry save/edit contract outside an explicitly approved scope.
- Historical Firestore records / Production data.
- Firestore Rules / Indexes / Functions / Storage / Auth.
- Golden Baseline.
- Any accounting or business rule not proven from approved project evidence.

## Source roles and transfer note

- GitHub = executable/source/test truth and this durable current-state record.
- Notion = mandatory workflow, approved decisions/status, and change log.
- Google Drive = reviewer-facing/accounting/operational references and `Makka — Current Reviewer Context`.
- Story release details are recorded here and in Notion Project Change Log; `Makka — Current Reviewer Context` should stay short and point to those records rather than duplicating the full implementation history.
