# Current Project State

Last reviewed: 2026-09-06

## StoryBuilder Compact redesign — final production release

- Production strategy remains the owner-accepted legacy application SHA `5241d44d3251a515a81ec6004fb6ae8447a64956` plus the isolated Story release branch `release/story-ui-legacy-2026-09-03`.
- Release base: `eb612133e1985ce7f696d6094f8bd3a250a7c4f1` (documentation-only follow-up preserved).
- Final Story release commit: `7f33016280ffdc3acc2d8212f9f2fc63f0075f07`.
- Compact and Full remain dynamic `1080×1920` PNGs. Compact now uses the owner-approved final layout: compact navy header, hero 21K card, RTL supporting cards 18K / 24K / silver, ivory trust card, compact CTA, refined footer, and brand-accurate WhatsApp/Facebook vector marks.
- Compact disclaimer/contact wording remains owner-approved; dynamic date/time, Story buy spread, pricingConfig, derived 18K/24K buy prices, silver prices, Full variant, PNG generation, native share, and save fallback are preserved.
- Validation: focused Story + StoryPricing `15/15 PASS`; TypeScript PASS; Balance Contract Guard PASS; Production build PASS; `git diff --check` PASS.
- Firebase Hosting-only deploy to project `makka-central-accounting` succeeded.
- Production assets: `/assets/index-D-jE4nUo.js`; Story chunk `/assets/StoryBuilderView-D8EJIvEw.js` HTTP 200 and matched the local build.
- Production smoke PASS: React startup clean, Story Builder opens, Compact and Full generate at 1080×1920, share/save available, CTA/footer and RTL/LTR verified, official WhatsApp/Facebook marks present in deployed asset.
- No Central Accounting code, unrelated owner changes, Firestore Data/Rules/Indexes/Functions/Storage/Auth, backend, pricing/business/accounting logic, WAC/COGS, Balance Engine, Entry contract, or Golden Baseline change.

## Production baseline

- Repository: `goldmaka2007-netizen/mo-golf`
- Production: https://makka-central-accounting.web.app
- Firebase project: `makka-central-accounting`
- Daily Production application: legacy SHA `5241d44d3251a515a81ec6004fb6ae8447a64956` plus Story release commit `7f33016280ffdc3acc2d8212f9f2fc63f0075f07`.
- Latest release family: StoryBuilder Compact final redesign.
- Deployment scope: Firebase Hosting only.
- Current release status: `COMPLETED / PRODUCTION DEPLOYED / OWNER VISUAL ACCEPTED / SYNC VERIFIED`.

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