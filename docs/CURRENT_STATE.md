# Current Project State

Last reviewed: 2026-09-11

## Makka 1 — Production Save Recovery — FINAL CLOSE — 2026-09-11

- Status: `CLOSED / PRODUCTION DEPLOYED / OWNER MANUAL ACCEPTANCE PASS / CROSS-SYSTEM VERIFIED`.
- The first Al-Safi Hawala price-capture Production release exposed an unsafe coupling to the Central Accounting write-cutover line through the blocker `Central Registry is not cutover-ready: accounts_needing_approval=65`.
- Safe recovery base: owner-accepted V1 application SHA `5330ccc2eb0a9e8a929889217d1ebefe6026ef43`.
- Recovery release branch: `release/v1-safe-production-recovery-2026-09-10`.
- Deployed recovery SHA: `b18c37c04e9251287edadfd68e6675635add9adc`.
- Recovery scope is intentionally narrow: legacy V1 save path + only the approved Al-Safi Hawala price-capture fix. Central Accounting write cutover is excluded.
- Application delta from the accepted V1 base is limited to `src/components/views/EntryForm.tsx`, `src/lib/merchantTransferInvoicePricing.ts`, and `src/lib/__tests__/merchantTransferInvoicePricing.test.ts`.
- Verification: isolated GitHub Actions run `34532292832` PASS; local release verification also PASS for TypeScript, Balance Contract, Vite Production build, exact SHA, clean Git state, Production Firebase project identity, and exclusion of CI dummy config.
- Firebase Hosting-only deployment completed to project `makka-central-accounting`; live Production asset after recovery: `/assets/index-C-gYHDJa.js`.
- Safe Production smoke PASS. No Production test transaction was created during technical smoke verification.
- Owner manual Production acceptance PASS on 2026-09-11 after a real normal Hawala save succeeded without the Central Registry blocker recurring.
- Posting Matrix, Inventory WAC/COGS, Merchant Metal WAC, Balance Engine, Firestore data, Firebase backend/config, Golden Baseline, and the existing Al-Safi immutable-price accounting rule were not changed.
- Final GitHub + Notion + Google Drive sync was completed and re-verified after owner acceptance.

## Makka 1 — Current Live Production

- Repository: `goldmaka2007-netizen/mo-golf`.
- Production: `https://makka-central-accounting.web.app`.
- Firebase project: `makka-central-accounting`.
- Current accepted Production application is the safe recovery release SHA `b18c37c04e9251287edadfd68e6675635add9adc` from branch `release/v1-safe-production-recovery-2026-09-10`.
- Current live asset: `/assets/index-C-gYHDJa.js`.
- The earlier PR #33 deployment SHA `98fe8336f8b7ae3a08281f3a0f8deb595acc6c8d` and asset `/assets/index-CSgM94uv.js` are historical and superseded as the accepted Production target.
- Do not deploy current `main` application state as a substitute for this accepted recovery line unless a separate change workflow and owner approval explicitly authorize it.

## Al-Safi Hawala Price Capture — 2026-09-11

- Status: `CLOSED / PRODUCTION DEPLOYED / OWNER MANUAL ACCEPTANCE PASS`.
- Problem: `حوالة` between a gold merchant and Al-Safi could reach save without `marketPrice` because the EntryForm gold-price capture path previously depended on the word `ذهب` appearing in the operation/account labels.
- Confirmed scenario: `علاء صالح -> الصافي`, 21K.
- Fix: EntryForm recognizes the approved Al-Safi gold merchant Hawala through account metadata plus the stable Al-Safi transfer-hub account ID and captures the required price snapshot while preserving the previous gold-label behavior for other operations.
- The existing Al-Safi immutable-price accounting save guard remains authoritative and unchanged.
- Ordinary merchant-to-merchant transfers that do not involve the approved Al-Safi hub are not broadened into this price-capture path.
- Owner acceptance on the deployed safe recovery line confirms the real Hawala save path works without the Central Registry cutover blocker.

## Makka 1 — Other current operational notes

- The 2026-09-10 Backdated-Day Recovery incident is closed after owner-approved recovery and manual re-entry. Detailed record: `docs/INCIDENT_2026-09-10_BACKDATED_DAY_RECOVERY.md`.
- Earlier StoryBuilder and Smart Sale releases remain historical release records; where an older document identifies an older Production asset/SHA, the current sections above supersede it for present Production identity.
- 2026 remains an open operating year. Year-close / closed-period authority and the 2027 transition remain deferred until the separate year-end workflow.

## Makka V2 — Separation and current gate

- Makka V2 is a separate project and repository: `goldmaka2007-netizen/makka-v2`.
- V2 Stage 6 is closed, independently accepted, merged, and cross-system verified on isolated development only.
- Stage 7 remains a separate owner-approval gate.
- No V2 Production deployment, real-2026-data migration, application cutover, or V2 Production integration is authorized by the Makka 1 recovery above.

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

## Mandatory source order for future Makka work

1. Read Notion `Makka Change Workflow — مسار أي تعديل جديد`.
2. Read Google Drive `Makka — Current Reviewer Context`.
3. Verify the relevant GitHub repository and current branch/commit.
4. Use live GitHub code/tests as executable truth, Notion for workflow/decisions/change log, and Google Drive for reviewer/accounting/operational context.
5. Do not treat older Historical checkpoints as current Production state when they conflict with the current sections above.

## Source roles

- GitHub = executable/source/test/current technical truth.
- Notion = mandatory workflow, approved decisions/status, and Project Change Log.
- Google Drive = reviewer-facing/accounting/operational references and `Makka — Current Reviewer Context`.
