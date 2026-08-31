# Current Project State

Last reviewed: 2026-08-31

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

The Smart Sale release changed none of these surfaces and made no Production Firestore data write during deployment or verification.

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
