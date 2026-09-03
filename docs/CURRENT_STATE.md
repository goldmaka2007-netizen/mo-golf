# Current Project State

Last reviewed: 2026-08-29

## Latest local StoryBuilder visual redesign — not deployed

- Baseline: `release/story-ui-legacy-2026-09-03` at `7642c22b76b316966cfe67490c8992ebff13a6f2`.
- Compact and Full Story renderers remain dynamic 1080×1920 PNGs; this local change updates presentation only.
- The Canvas visual system now uses warm ivory, deep navy, and restrained metallic-gold accents, with cream price/product panels, navy CTA/footer, improved ribbons, spacing, hierarchy, and readability.
- Compact and Full preserve their existing business sections, data sources, pricing semantics, sharing, and download behavior. Compact establishment text is `تأسس منذ 2003`.
- No production deployment or Firebase/Firestore surface change was made.

## Production baseline

- Repository: `goldmaka2007-netizen/mo-golf`
- Production: https://makka-central-accounting.web.app
- Firebase project: `makka-central-accounting`
- Current deployed application commit: `1fa1da6bc8be0f0dd8b6583cd9edb944a5567e82`
- Latest release family: Account Management + Safe Account Uses + Firestore read-quota follow-up.
- Deployment scope: Firebase Hosting only.
- Current release status: `COMPLETED / PRODUCTION DEPLOYED / OWNER MANUAL ACCEPTED / CROSS-SYSTEM VERIFIED`.

## Current production behavior — account management

- Settings → Accounts opens the operational Chart of Accounts.
- Account creation remains clone-only through “إنشاء حساب مشابه”.
- Account-level current operational uses are visible through “إدارة استخدامات الحساب”.
- Protected/system/inventory/merchant-sensitive accounts remain read-only for Add Use.
- Add Use is derived only from one unambiguous existing operational pattern; no free debit/credit editor exists.
- Persistence independently re-validates canonical identity and the safe candidate, writes independent deterministic-ID rules, does not mutate existing rules, and rejects effective duplicates.
- Mobile clone modal layering, safe-area/keyboard behavior, and mobile account-row layout are owner-accepted on Production.

Primary record: `docs/ACCOUNT_MANAGEMENT_PRODUCTION_RELEASE_2026-08-29.md`.

## Firestore read-quota follow-up — 2026-08-29

- Production clone creation exposed Firestore `Quota exceeded` while Firebase usage showed read pressure (`~38k` current reads versus `4` writes).
- `useDataSync` already maintained realtime listeners, including the full entries history.
- A separate global header refresh also called `getDocsFromServer(...)` on the complete entries history, creating redundant server reads.
- Accepted limited fix removed that full-history manual refresh path from `App.tsx`.
- `AppHeader` now exposes a passive automatic-sync indicator with no click handler and no Firestore read action.
- The underlying realtime/history loading strategy was intentionally not redesigned in this limited-risk change.
- Clone errors now remain visible inside the active clone modal; quota/resource exhaustion maps to clear Arabic copy.
- Verification: focused `3 files / 12 tests PASS`; TypeScript PASS; Balance Contract Guard PASS; `git diff --check` PASS; build PASS; Hosting deploy PASS; root/main asset HTTP 200 and deployed asset matched generated build.
- Owner Production acceptance: quota error displayed correctly inside the modal and no account was created while quota was exhausted.

## Protected accounting/data invariants

Do not change without a separate explicit owner decision and approval:

- Posting Matrix.
- WAC / COGS.
- Balance Engine semantics.
- Entry save contract/schema outside an explicitly approved scope.
- Historical Firestore records.
- Firestore Rules / Indexes / Functions / Storage / Auth.
- Golden Baseline.

The current release and read-quota follow-up changed none of these surfaces and made no Production Firestore data write during deployment or verification.

## Known accepted UX limitations

- Existing operation labels can still appear in Add Use when a safe pattern exists even if that operation is already represented in current uses; persistence independently re-derives the candidate and rejects effective duplicates. Owner accepted this limitation on 2026-08-29; future UI filtering is separate work.
- On the narrowest mobile layout, the passive automatic-sync header control may show only the refresh-style icon while the “المزامنة تلقائية” text is hidden. It has no click handler and cannot trigger a Firestore read. Owner accepted the current presentation; future label-visibility polish is separate work.

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
