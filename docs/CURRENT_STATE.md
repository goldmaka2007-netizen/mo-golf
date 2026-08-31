# Current Project State

Last reviewed: 2026-09-01

## Production baseline

- Repository: `goldmaka2007-netizen/mo-golf`
- Production: https://makka-central-accounting.web.app
- Firebase project: `makka-central-accounting`
- Current deployed application commit: `5241d44d3251a515a81ec6004fb6ae8447a64956`
- Current GitHub `main` baseline at task start: `8e1e3d9c0fdb8c4093d3f2095c0ebad8bb79ddd7`.
- Latest release family: Smart Sale Product Groups + Bullion/Coin Price Board.
- Deployment scope: Firebase Hosting only.
- Current release status: `COMPLETED / PRODUCTION DEPLOYED / OWNER MANUAL ACCEPTED / CROSS-SYSTEM VERIFIED`.

## Central Accounting Registry Phase 1 — merged read-only foundation

- Original Draft PR: `#14`; replacement merge PR: `#15` because the connector could not transition the verified draft to Ready for Review.
- Merged to `main` on 2026-08-31 as squash commit `3b0980bac87931abbdbf5419dc329bd1199aa87b`.
- Status: `IMPLEMENTATION COMPLETE / VERIFIED / MERGED / NOT DEPLOYED`.
- Owner approval to implement Phase 1 was given on 2026-08-31 after the Central Accounting Domain Grill.
- Target decision: D-021 / ADR-010 — one logical Central Accounting Registry becomes the future single accounting-definition authority after a separately approved Cutover.
- Phase 1 adds a versioned canonical operation catalog, a read-only Central Accounting Registry composition boundary, Coverage/Readiness reporting, and focused architecture/coverage tests.
- Phase 1 does **not** connect the new registry to EntryForm save/edit, does not activate a new posting path, and does not change current Production behavior.
- Shadow readiness and Cutover readiness are separate fail-closed gates. Blank/whitespace operation labels and other unknown operations block both gates. Cutover is also blocked while account mapping/approval or classification remains incomplete, or a transition-only operation remains writable for new operations. Historical transition rows remain readable and do not by themselves block Cutover.
- `مرتجع ذهب` and `مرتجع فضة` remain historical-only compatibility operations and are not part of the target new-operation set.
- Repository verification on the final branch HEAD passed: focused tests `22/22`, TypeScript PASS, Balance Contract PASS, build PASS, and `git diff --check` PASS. Full suite remained `586 PASS / 13 FAIL`; all 13 failures plus 3 load errors were independently reproduced on the pre-PR `main` baseline and classified as pre-existing, with no new failures introduced by Phase 1.
- Architecture review PASS. Protected surfaces remain unchanged: Posting Matrix, WAC/COGS, Merchant Metal WAC, Balance Engine, Entry save contract, Golden Baseline, Production Firestore data, and Firebase backend resources.
- Verification used isolated dummy Firebase environment values only; no Firebase/Auth/Firestore network write occurred and verification modified no tracked file.
- No deployment is authorized or required for this read-only Phase 1 checkpoint. Production runtime remains on deployed application commit `5241d44d3251a515a81ec6004fb6ae8447a64956` until a separately approved later phase changes runtime behavior.

## Central Accounting Shadow Phase 2 — merged read-only orchestration

- Original Draft PR: `#16`; replacement merge PR: `#17` because the connector could not transition the verified draft to Ready for Review.
- Merged to `main` on 2026-09-01 (Cairo project date) as merge commit `cdb33afd776abd65c00faa7bf36a223182d97b1c`.
- Status: `IMPLEMENTATION COMPLETE / VERIFIED / MERGED / NOT DEPLOYED`.
- Owner approved Phase 2 execution on 2026-09-01 after Phase 1 closure.
- Decision: D-022 / ADR-011 — every newly approved Central Shadow run must enter through the Central Accounting Registry before existing parity helpers.
- Approved read-only flow: `Central Accounting Registry → Shadow readiness gate → stored operation-identity consistency gate → Registry-normalized temporary parity copies → existing parity engine`.
- Unknown, blank, and whitespace-only operation labels fail closed before parity. A stored `operationKind` that contradicts the Registry identity resolved from `tx` blocks the entire Shadow run with `parity=null` and `exactParity=false`.
- Covered historical rows with missing `operationKind` remain unchanged. Shadow supplies the Registry operation kind only to temporary parity copies so lower-level legacy fallback cannot become the operation-identity authority.
- The previously discovered fallback conflicts for `دفع لعميل`, `مرتجع ذهب`, and `مرتجع فضة` are covered by regression tests; `مرتجع ذهب` and `مرتجع فضة` remain `historical_only` and non-user-selectable.
- Final focused verification passed `34/34` tests across four focused files. TypeScript PASS, Balance Contract PASS, build PASS, and `git diff --check` PASS.
- Full missing-`operationKind` catalog audit checked `33` current/historical labels/aliases with `0` Registry-vs-parity identity mismatches.
- Full suite remained `598 PASS / 13 FAIL` with the same previously proven pre-existing failure set; no automated regression failure was introduced by Phase 2.
- Architecture review PASS. The new wrapper has no React/UI, Firebase persistence, EntryForm, RAW_DATA/CATS/OPERATION_RULES decision authority, local WAC/COGS, or local posting-template authority.
- Protected surfaces remain unchanged: Entry save/edit contract, Production writer, Posting Matrix, Inventory WAC/COGS, Merchant Metal WAC, Balance Engine, Trial Balance/financial-statement semantics, Golden Baseline, Production Firestore data, and Firebase backend resources.
- Verification used isolated dummy Firebase environment values only; no Firebase/Auth/Firestore write occurred and verification modified no tracked file.
- Phase 2 merging does **not** activate live Production Shadow execution and does not require a deployment. Production runtime remains on deployed application commit `5241d44d3251a515a81ec6004fb6ae8447a64956`.

## Central Read-Only Output Evidence Phase 3 — implementation checkpoint

- Owner approved Phase 3 implementation on 2026-09-01.
- Working branch: `feature/central-read-only-output-evidence-phase3`, created from GitHub `main` `2869e7e21fbfa90703b6264eb0b309dfbbdd1fcc`.
- Status: `CODE IMPLEMENTATION COMPLETE / REPOSITORY VERIFICATION PENDING / NOT MERGED / NOT DEPLOYED`.
- Decision: D-023 / ADR-012 — before runtime read-only wiring, exact Central Shadow must prove unchanged downstream Ledger/financial projection, Unified Trial Balance, and EGP Financial Statements.
- The Phase 3 boundary runs only after Central Shadow is unblocked and exact. Registry-approved operation identity is consumed from the existing Shadow parity result and applied only to temporary in-memory Entry copies.
- Existing downstream engines are reused; no report accounting rule is reimplemented. The untouched source-entry outputs are compared with temporary Registry-normalized outputs for projection, Unified Trial Balance, and EGP Financial Statements.
- Any downstream mismatch fails closed and is reported by layer. Source Entry rows remain unchanged.
- Phase 3 adds no UI/runtime activation and no Firebase persistence. EntryForm, Entry save/edit, Production writer, Posting Matrix, Inventory WAC/COGS, Merchant Metal WAC, Balance Engine semantics, Trial Balance/financial-statement accounting rules, Golden Baseline, Production Firestore data, and Firebase backend resources remain outside the approved implementation scope.
- Repository verification and Evidence Pack are still required before merge review. No merge or deployment is authorized by this checkpoint.

## Current production behavior — Smart Gold Sale Assistant

- Smart Sale opens by default on a read-only `السبائك والجنيهات` price board for fast customer quoting.
- `منتجات أفرنجي` is a dedicated selector for structurally classified 18k jewelry plus foreign scrap.
- `منتجات عربي` is a dedicated selector for structurally classified 21k jewelry plus Arabic scrap; coin/bar are excluded.
- `اختيار سبيكة/جنيه للبيع` is a separate selector for `gold.direct.bar` and `gold.direct.coin`, reusing the existing fixed-weight/count/pricing/review sale flow.
- The price board itself has no sell action and does not prefill EntryForm.
- Bullion/coin board pricing reuses the Story Builder pricing authority and fallback semantics: `pricingConfig` first, legacy read-only charges second, then zero; displayed totals round up to the nearest 5 EGP.
- Smart Purchase behavior and the existing EntryForm review/save handoff remain unchanged.
- Verification: focused gold pricing tests `24/24 PASS`; TypeScript PASS; Balance Contract Guard PASS; build PASS; `git diff --check` PASS; Hosting-only deploy PASS.
- Owner live iPhone functional and visual acceptance: PASS on 2026-08-30. A duplicated `ج.م` label found during acceptance was corrected by the one-line production fix in `5241d44d3251a515a81ec6004fb6ae8447a64956` without changing price calculation.

Primary detailed record: Google Drive `Makka Application — Smart Sale Product Groups & Bullion Price Board Production Release — 2026-08-30` (Drive ID `1_lpimnJ4QQHNeML80ztVBaFsOvkChwuj6d8i1YbwYzA`).

## Previous production behavior — account management / read-quota follow-up

- Settings → Accounts opens the operational Chart of Accounts; account creation remains clone-only and safe account-use persistence remains independently re-validated.
- The 29 Aug read-quota follow-up removed the redundant global full-history manual refresh while leaving the realtime sync path unchanged.
- Clone errors remain visible inside the active modal and quota/resource exhaustion maps to clear Arabic copy.

Primary record: `docs/ACCOUNT_MANAGEMENT_PRODUCTION_RELEASE_2026-08-29.md`.

## Protected accounting/data invariants

Do not change without a separate explicit owner decision and approval:

- Posting Matrix.
- WAC / COGS.
- Balance Engine semantics.
- Entry save contract/schema outside an explicitly approved scope.
- Historical Firestore records.
- Firestore Rules / Indexes / Functions / Storage / Auth.
- Golden Baseline.

The current Central Registry/Shadow/Output Evidence phases changed none of these protected surfaces and made no Production Firestore data write.

## Known accepted UX limitations

- Existing operation labels can still appear in Add Use when a safe pattern exists even if that operation is already represented in current uses; persistence independently re-derives the candidate and rejects effective duplicates. Owner accepted this limitation on 2026-08-29; future UI filtering is separate work.
- On the narrowest mobile layout, the passive automatic-sync header control may show only the refresh-style icon while the `المزامنة تلقائية` text is hidden. It has no click handler and cannot trigger a Firestore read. Owner accepted the current presentation; future label-visibility polish is separate work.

## Other current project notes

- Initial/main JavaScript remains above 500 KB at about 1.34 MB. The read-only bundle audit is complete and the owner chose no Phase 4B for now.
- Historical `arabicWeight` migration/backfill remains not approved and requires separate Critical review and explicit owner approval.
- Pre-existing accounting/Golden failures remain separate follow-up work; never regenerate Golden merely to clear them.
- Legacy Planning/Grill trackers are historical and are not evidence of Production state.

## Source roles and closure

- GitHub: current code, tests, deployment implementation and technical truth.
- Notion: active workflow, approved decisions/status and change history.
- Google Drive: accounting, operational, architecture and reviewer-facing references.
- `Makka — Current Reviewer Context` stays short and points to primary evidence.
- Uploaded copies are snapshots; live GitHub/Notion/Drive sources win when different.
- A task is not Closed until owner acceptance is complete when applicable and GitHub + Notion + Google Drive are synchronized and directly re-read by ChatGPT.

## Historical release records

Detailed historical facts remain in their dedicated release records, including:

- `docs/ACCOUNT_MANAGEMENT_PRODUCTION_RELEASE_2026-08-29.md`
- `docs/OPERATIONAL_HOME_REDESIGN_PRODUCTION_RELEASE_2026-08-28.md`
- `docs/HOME_GOLD_SUMMARY_ALIGNMENT_PRODUCTION_RELEASE_2026-08-27.md`
- prior Phase 1–4A records and ADR/decision files.